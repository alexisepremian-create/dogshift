import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { anthropic } from "@ai-sdk/anthropic";

import { prisma } from "@/lib/prisma";
import { checkAgentActive } from "@/lib/agent-guard";
import { sendEmail } from "@/lib/email/sendEmail";
import { renderZootherapieEmail } from "@/lib/email/templates/zootherapieEmail";

// ====================================================================
// AGENT ZOOTHERAPIE EVALUATION
// Triggered when a visitor submits the zootherapy wellbeing form.
// Checks for duplicate email, saves to LeadMagnet, calls Claude to
// generate a personalized evaluation, sends it by email, logs + Telegram.
// ====================================================================

export const runtime = "nodejs";

import { sendTelegramMessage } from "@/lib/telegram/sendTelegramMessage";

async function sendTelegram(text: string) {
  await sendTelegramMessage(text, { bot: "relances" }).catch(() => {});
}

interface EvaluationResult {
  titre: string;
  analyse: string;
  conseil: string;
  conclusion: string;
}

function buildUserPrompt(prenom: string, reponses: Record<string, string>): string {
  const lines = [
    `Prénom : ${prenom}`,
    ``,
    `Réponses au questionnaire bien-être :`,
    `1. Temps quotidien avec le chien : ${reponses.q1 ?? "non renseigné"}`,
    `2. Ressenti après une balade : ${reponses.q2 ?? "non renseigné"}`,
    `3. Aide à décompresser : ${reponses.q3 ?? "non renseigné"}`,
    `4. Sentiment de solitude réduit : ${reponses.q4 ?? "non renseigné"}`,
    `5. Gestion de la garde pendant les vacances : ${reponses.q5 ?? "non renseigné"}`,
    ``,
    `Génère une évaluation personnalisée en JSON strict (sans markdown, sans commentaire) avec exactement ces clés :`,
    `{ "titre": "...", "analyse": "...", "conseil": "...", "conclusion": "..." }`,
    ``,
    `- titre : titre personnalisé incluant le prénom (ex: "Votre profil bien-être, ${prenom}")`,
    `- analyse : 2-3 paragraphes d'analyse bienveillante basée sur les réponses (séparés par \\n\\n)`,
    `- conseil : 1 conseil pratique concret pour renforcer le lien avec leur chien`,
    `- conclusion : 1 phrase de conclusion chaleureuse mentionnant DogShift comme partenaire de confiance pour la garde de leur chien`,
  ];
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  const guard = await checkAgentActive("zootherapie-evaluation");
  if (guard) return guard;

  const start = Date.now();

  try {
    const body = await req.json() as {
      prenom?: string;
      email?: string;
      reponses?: Record<string, string>;
    };

    const { prenom, email, reponses } = body;

    if (!prenom || !email || !reponses) {
      return NextResponse.json(
        { error: "prenom, email et reponses sont requis" },
        { status: 400 }
      );
    }

    const baseUrl = (
      process.env.NEXT_PUBLIC_APP_URL ??
      process.env.NEXT_PUBLIC_BASE_URL ??
      "https://dogshift.ch"
    ).replace(/\/$/, "");

    // 1. Check for duplicate — save only if new
    const existing = await prisma.leadMagnet.findUnique({ where: { email } });
    if (!existing) {
      await prisma.leadMagnet.create({
        data: {
          email,
          prenom,
          source: "zootherapie",
        },
      });
    }

    // 2. Call Claude to generate personalized evaluation
    let evaluation: EvaluationResult = {
      titre: `Votre profil bien-être, ${prenom}`,
      analyse:
        "Votre relation avec votre chien témoigne d'un lien authentique et précieux. Chaque moment partagé contribue à votre équilibre émotionnel.\n\nLa science confirme ce que vous ressentez : la présence animale réduit le cortisol et favorise la sécrétion d'ocytocine, l'hormone du bien-être.\n\nContinuez à cultiver ce lien — il vous nourrit autant que vous le nourrissez.",
      conseil:
        "Instaurez un rituel quotidien dédié, même 10 minutes : une séance de jeu, une balade en pleine nature ou simplement un moment de câlins conscients. La régularité renforce le lien et ancre la sérénité dans votre routine.",
      conclusion: `Chez DogShift, nous veillons à ce que votre compagnon soit entre de bonnes mains même quand vous n'êtes pas là. Parce qu'un chien heureux, c'est un maître apaisé. 🐾`,
    };

    try {
      const { text } = await generateText({
        model: anthropic("claude-sonnet-4-5"),
        system:
          "Tu es un expert en zoothérapie et bien-être animal. Tu rédiges une évaluation personnalisée, chaleureuse et bienveillante en français pour un propriétaire de chien. Ton ton est doux, scientifiquement ancré mais accessible. Tu termines toujours avec un message positif sur le lien unique entre un humain et son chien. Tu réponds UNIQUEMENT en JSON strict, sans markdown, sans backticks, sans commentaire.",
        prompt: buildUserPrompt(prenom, reponses),
      });

      const parsed = JSON.parse(text.trim()) as EvaluationResult;
      if (parsed.titre && parsed.analyse && parsed.conseil && parsed.conclusion) {
        evaluation = parsed;
      }
    } catch {
      // Claude failed — use the fallback evaluation above
    }

    // 3. Build and send email
    const analyseRows = evaluation.analyse
      .split(/\n\n+/)
      .filter(Boolean)
      .map((para, i) => ({
        label: i === 0 ? "Analyse" : "↓",
        value: para.trim(),
      }));

    const { html } = renderZootherapieEmail({
      baseUrl,
      prenom,
      titre: evaluation.titre,
      analyseRows,
      conseil: evaluation.conseil,
      conclusion: evaluation.conclusion,
    });

    const text =
      `${evaluation.titre}\n\n` +
      `${evaluation.analyse}\n\n` +
      `Conseil : ${evaluation.conseil}\n\n` +
      `${evaluation.conclusion}\n\n` +
      `— L'équipe DogShift\n${baseUrl}\n`;

    await sendEmail(
      {
        to: email,
        subject: "Votre évaluation bien-être personnalisée",
        text,
        html,
      },
      {
        templateName: "zootherapie-evaluation",
        context: "agent:zootherapie-evaluation",
      },
    );

    const durationMs = Date.now() - start;

    // 4. Agent log
    await prisma.agentLog.create({
      data: {
        agentName: "zootherapie-evaluation",
        actionType: "evaluation_sent",
        summary: `Évaluation envoyée à ${email}`,
        details: { email, prenom, reponses },
        durationMs,
        status: "success",
      },
    });

    // 5. Telegram
    await sendTelegram(`🧘 Nouvelle évaluation zoothérapie : ${prenom} (${email})`);

    return NextResponse.json({ success: true, agent: "zootherapie-evaluation" });
  } catch (error) {
    const durationMs = Date.now() - start;
    await prisma.agentLog
      .create({
        data: {
          agentName: "zootherapie-evaluation",
          actionType: "error",
          summary: `Erreur: ${(error as Error).message}`,
          details: { error: String(error) },
          durationMs,
          status: "error",
        },
      })
      .catch(() => {});
    return NextResponse.json({ error: "Zootherapie evaluation agent error" }, { status: 500 });
  }
}
