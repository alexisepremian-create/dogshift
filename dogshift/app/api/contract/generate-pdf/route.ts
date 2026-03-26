import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { presignGetObject, presignPutObject } from "@/lib/r2";

export const runtime = "nodejs";

function formatSignedAtFr(iso: string) {
  const dt = new Date(iso);
  if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-CH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
}

function wrapText(text: string, maxWidth: number, font: any, fontSize: number) {
  const words = String(text ?? "").replace(/\s+/g, " ").trim().split(" ");
  const lines: string[] = [];
  let current = "";
  for (const w of words) {
    const test = current ? `${current} ${w}` : w;
    const width = font.widthOfTextAtSize(test, fontSize);
    if (width <= maxWidth) {
      current = test;
      continue;
    }
    if (current) lines.push(current);
    current = w;
  }
  if (current) lines.push(current);
  return lines;
}

async function generateContractSignedPdfBytes(args: {
  contractSnapshot: any;
  contractSignerName: string;
  contractSignedAt: string;
  contractVersion: string;
}) {
  const { contractSnapshot, contractSignerName, contractSignedAt, contractVersion } = args;
  const content = typeof contractSnapshot?.content === "string" ? contractSnapshot.content : "";
  const title = typeof contractSnapshot?.title === "string" ? contractSnapshot.title : "Contrat DogShift";
  const version = contractVersion || (typeof contractSnapshot?.version === "string" ? contractSnapshot.version : "—");

  const pdfDoc = await PDFDocument.create();
  const pageMargin = 48;
  const pageWidth = 595.28; // A4 points
  const pageHeight = 841.89; // A4 points
  const usableWidth = pageWidth - pageMargin * 2;

  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const fontSizeTitle = 18;
  const fontSizeH = 12;
  const fontSizeBody = 11;
  const lineHeight = 14;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let cursorY = pageHeight - pageMargin;

  const drawLines = (lines: string[], opts: { x: number; y: number; size: number; font: any }) => {
    let y = opts.y;
    for (const line of lines) {
      page.drawText(line, { x: opts.x, y, size: opts.size, font: opts.font, color: rgb(0, 0, 0) });
      y -= lineHeight;
    }
  };

  // Title
  page.drawText(title, { x: pageMargin, y: cursorY, size: fontSizeTitle, font: helvBold, color: rgb(0, 0, 0) });
  cursorY -= 28;

  page.drawText(`Version du contrat: ${version}`, { x: pageMargin, y: cursorY, size: fontSizeH, font: helv, color: rgb(0, 0, 0) });
  cursorY -= 18;

  // Signature proof block
  const signedAtHuman = formatSignedAtFr(contractSignedAt);
  const proofLines = [
    "Signature électronique DogShift",
    "Signé électroniquement par:",
    contractSignerName,
    "",
    `Le: ${signedAtHuman}`,
  ];
  drawLines(proofLines, { x: pageMargin, y: cursorY, size: fontSizeH, font: helv });
  cursorY -= proofLines.length * lineHeight + 10;

  // Contract content (snapshot)
  const paragraphs = String(content ?? "").split(/\n\n+/);
  for (const paragraph of paragraphs) {
    const p = String(paragraph ?? "").trim();
    if (!p) {
      cursorY -= lineHeight;
      continue;
    }

    const rawLines = wrapText(p, usableWidth, helv, fontSizeBody);
    for (const rawLine of rawLines) {
      if (cursorY - lineHeight < pageMargin) {
        page = pdfDoc.addPage([pageWidth, pageHeight]);
        cursorY = pageHeight - pageMargin;
      }
      page.drawText(rawLine, { x: pageMargin, y: cursorY, size: fontSizeBody, font: helv, color: rgb(0, 0, 0) });
      cursorY -= lineHeight;
    }
    cursorY -= lineHeight / 2;
  }

  return pdfDoc.save();
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => null)) as
      | {
          contractSnapshot?: any;
          contractSignerName?: string;
          contractSignedAt?: string;
          contractVersion?: string;
        }
      | null;

    const contractSnapshot = body?.contractSnapshot;
    const contractSignerName = typeof body?.contractSignerName === "string" ? body.contractSignerName.trim() : "";
    const contractSignedAt = typeof body?.contractSignedAt === "string" ? body.contractSignedAt.trim() : "";
    const contractVersion = typeof body?.contractVersion === "string" ? body.contractVersion.trim() : "";

    const sitterId = typeof contractSnapshot?.sitterId === "string" ? contractSnapshot.sitterId : null;
    if (!sitterId) {
      return NextResponse.json({ ok: false, error: "MISSING_SITTER_ID" }, { status: 400 });
    }
    if (!contractSignerName) {
      return NextResponse.json({ ok: false, error: "MISSING_SIGNER_NAME" }, { status: 400 });
    }
    if (!contractSignedAt) {
      return NextResponse.json({ ok: false, error: "MISSING_SIGNED_AT" }, { status: 400 });
    }
    if (!contractVersion) {
      return NextResponse.json({ ok: false, error: "MISSING_CONTRACT_VERSION" }, { status: 400 });
    }

  // Basic immutability/coherence checks: if the snapshot carries those fields,
  // ensure they match what we received (prevents accidental mixing versions).
  const snapshotSignerName = typeof contractSnapshot?.signerName === "string" ? contractSnapshot.signerName : null;
  const snapshotSignedAt = typeof contractSnapshot?.signedAt === "string" ? contractSnapshot.signedAt : null;
  const snapshotVersion = typeof contractSnapshot?.version === "string" ? contractSnapshot.version : null;
  if (snapshotSignerName && snapshotSignerName !== contractSignerName) {
    return NextResponse.json({ ok: false, error: "INCONSISTENT_SIGNER_NAME" }, { status: 400 });
  }
  if (snapshotSignedAt && snapshotSignedAt !== contractSignedAt) {
    return NextResponse.json({ ok: false, error: "INCONSISTENT_SIGNED_AT" }, { status: 400 });
  }
  if (snapshotVersion && snapshotVersion !== contractVersion) {
    return NextResponse.json({ ok: false, error: "INCONSISTENT_CONTRACT_VERSION" }, { status: 400 });
  }

    const profile = await prisma.sitterProfile.findUnique({
      where: { sitterId },
      select: { id: true, contractSignedPdfUrl: true },
    });
    if (!profile?.id) {
      return NextResponse.json({ ok: false, error: "NOT_FOUND" }, { status: 404 });
    }

    // If we already generated a PDF for this sitter+latest signature, reuse it.
    if (profile.contractSignedPdfUrl) {
      try {
        const presigned = await presignGetObject({ key: profile.contractSignedPdfUrl, expiresInSeconds: 600 });
        return NextResponse.json({ ok: true, pdfUrl: presigned.url }, { status: 200 });
      } catch {
        // If R2 isn't configured in this environment, fall back to regenerating.
      }
    }

    const pdfBytes = await generateContractSignedPdfBytes({
      contractSnapshot,
      contractSignerName,
      contractSignedAt,
      contractVersion,
    });

    const key = `contract-signed/${sitterId}/${encodeURIComponent(contractVersion)}.pdf`;

    // Upload to R2 (best-effort). If R2 is not configured, return the PDF bytes directly.
    try {
      const put = await presignPutObject({
        key,
        contentType: "application/pdf",
        expiresInSeconds: 600,
      });

      const putRes = await fetch(put.url, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: Buffer.from(pdfBytes),
      });
      if (!putRes.ok) {
        throw new Error(`R2 put failed: ${putRes.status}`);
      }

      await prisma.sitterProfile.update({
        where: { sitterId },
        data: { contractSignedPdfUrl: key },
        select: { id: true, contractSignedPdfUrl: true },
      });

      const presigned = await presignGetObject({ key, expiresInSeconds: 600 });
      return NextResponse.json({ ok: true, pdfUrl: presigned.url }, { status: 200 });
    } catch {
      // No R2 in local/dev: return the PDF directly.
      return new NextResponse(Buffer.from(pdfBytes), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="dogshift-contrat-signe-${encodeURIComponent(contractVersion)}.pdf"`,
        },
        status: 200,
      });
    }
  } catch (err) {
    console.error("[api][contract][generate-pdf][POST] error", err);
    return NextResponse.json({ ok: false, error: "INTERNAL_ERROR" }, { status: 500 });
  }
}

