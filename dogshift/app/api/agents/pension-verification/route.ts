/* eslint-disable @typescript-eslint/no-explicit-any */
import { generateObject } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { presignGetObject } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 60;

const PensionVerifSchema = z.object({
  verdict: z.enum(["approved", "rejected"]).describe("Décision finale"),
  score: z.number().min(0).max(100).describe("Score global de 0 à 100"),
  criteria: z.object({
    espaceSuffisant: z.number().min(0).max(5).describe("Espace suffisant pour un chien (0-5)"),
    hygiene: z.number().min(0).max(5).describe("Propreté et hygiène (0-5)"),
    securite: z.number().min(0).max(5).describe("Absence de dangers visibles (0-5)"),
    adequatChien: z.number().min(0).max(5).describe("Environnement adapté à un chien (0-5)"),
    coherenceDeclaration: z.number().min(0).max(5).describe("Cohérence avec le type de logement déclaré (0-5)"),
  }),
  forces: z.array(z.string()).max(3).describe("Points positifs observés"),
  problemes: z.array(z.string()).max(5).describe("Problèmes ou points d'attention"),
  recommandation: z.string().describe("Recommandation détaillée pour l'admin"),
});

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as null | { sitterId?: string };
    const sitterId = typeof body?.sitterId === "string" ? body.sitterId.trim() : "";
    if (!sitterId) return NextResponse.json({ ok: false, error: "INVALID_BODY" }, { status: 400 });

    const db = prisma as any;
    const profile = await db.sitterProfile.findFirst({
      where: { sitterId },
      select: {
        id: true,
        sitterId: true,
        pensionVerifStatus: true,
        pensionPhotoUrls: true,
      },
    });

    if (!profile) return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });

    const photoKeys: string[] = Array.isArray(profile.pensionPhotoUrls) ? profile.pensionPhotoUrls : [];
    if (photoKeys.length < 3) {
      return NextResponse.json({ ok: false, error: "INSUFFICIENT_PHOTOS" }, { status: 400 });
    }

    // Mark as ai_reviewing
    await db.sitterProfile.update({
      where: { id: profile.id },
      data: { pensionVerifStatus: "ai_reviewing" },
    });

    // Generate presigned GET URLs for each photo and fetch as binary
    const imageContents: { type: "image"; image: string; mimeType: string }[] = [];
    for (const key of photoKeys.slice(0, 6)) {
      try {
        const { url } = await presignGetObject({ key, expiresInSeconds: 120 });
        const imgRes = await fetch(url);
        if (imgRes.ok) {
          const buffer = await imgRes.arrayBuffer();
          const b64 = Buffer.from(buffer).toString("base64");
          const ct = imgRes.headers.get("content-type") ?? "image/jpeg";
          const mime = ct.split(";")[0].trim();
          imageContents.push({ type: "image", image: b64, mimeType: mime });
        }
      } catch {
        // skip failed images
      }
    }

    if (imageContents.length === 0) {
      await db.sitterProfile.update({
        where: { id: profile.id },
        data: { pensionVerifStatus: "pending" },
      });
      return NextResponse.json({ ok: false, error: "PHOTOS_UNAVAILABLE" }, { status: 500 });
    }

    const { object: analyse } = await generateObject({
      model: anthropic("claude-opus-4-5"),
      schema: PensionVerifSchema,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Tu es un expert en sécurité pour DogShift, plateforme de dogsitting premium en Suisse romande.

Analyse ces ${imageContents.length} photos du logement d'un sitter qui veut activer l'option Pension (garde à domicile de chiens chez lui).

CRITÈRES D'ÉVALUATION (score 0-5 par critère) :
1. Espace suffisant : le chien aura de la place pour se déplacer, pas d'encombrement excessif
2. Hygiène : logement visiblement propre, pas de saleté apparente
3. Sécurité : absence d'éléments dangereux visibles (câbles traînants, produits chimiques accessibles, hauteurs non sécurisées, balcons sans barrières pour un chien)
4. Adéquat pour un chien : présence d'espaces confortables, lumière naturelle, pas d'environnement hostile
5. Cohérence : les photos sont réalistes et correspondent à un vrai logement habité

SEUIL D'APPROBATION : score global >= 70/100
- APPROUVÉ si le logement est clairement sain et sécurisé
- REFUSÉ si des risques évidents pour la sécurité du chien sont présents

Sois objectif et bienveillant mais rigoureux sur la sécurité.`,
            },
            ...imageContents,
          ],
        },
      ],
    });

    const finalStatus = analyse.score >= 70 ? "approved" : "ai_rejected";

    await db.sitterProfile.update({
      where: { id: profile.id },
      data: {
        pensionVerifStatus: finalStatus,
        pensionAiScore: analyse.score,
        pensionAiVerdict: analyse.verdict,
        pensionAiReasoning: analyse,
        pensionAiReviewedAt: new Date(),
        pensionPhotoReviewedAt: new Date(),
      },
    });

    return NextResponse.json({
      ok: true,
      sitterId,
      verdict: analyse.verdict,
      score: analyse.score,
      status: finalStatus,
    });
  } catch (err) {
    console.error("[agents][pension-verification]", err);
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 });
  }
}
