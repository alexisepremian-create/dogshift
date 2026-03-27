import { readFile } from "fs/promises";
import path from "path";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { formatSwissDateTimeHuman } from "@/lib/datetime/formatSwissDateTime";
import { prisma } from "@/lib/prisma";
import { presignGetObject, presignPutObject } from "@/lib/r2";

export const runtime = "nodejs";

/** DogShift brand — aligned with --dogshift-blue */
const BRAND = rgb(47 / 255, 77 / 255, 107 / 255);
const TEXT = rgb(30 / 255, 41 / 255, 59 / 255);
const TEXT_MUTED = rgb(71 / 255, 85 / 255, 105 / 255);
const RULE = rgb(226 / 255, 232 / 255, 240 / 255);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGIN = 54;
const FOOTER_MIN_CLEARANCE = 76;

function formatSignedAtFr(iso: string) {
  return formatSwissDateTimeHuman(iso);
}

async function tryLoadLogoPngBytes(): Promise<Uint8Array | null> {
  try {
    const p = path.join(process.cwd(), "public", "dogshift-logo.png");
    const buf = await readFile(p);
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

/** Greedy wrap: returns lines as word arrays (for justification). */
function wrapWords(wordsIn: string[], maxWidth: number, font: PDFFont, fontSize: number): string[][] {
  const words = wordsIn.filter((w) => w.length > 0);
  const lines: string[][] = [];
  let current: string[] = [];
  for (const word of words) {
    const test = current.length ? [...current, word] : [word];
    const lineStr = test.join(" ");
    if (font.widthOfTextAtSize(lineStr, fontSize) <= maxWidth || !current.length) {
      current = test;
      continue;
    }
    lines.push(current);
    current = [word];
  }
  if (current.length) lines.push(current);
  return lines;
}

function splitIntoWords(text: string): string[] {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

function drawJustifiedLine(
  page: PDFPage,
  words: string[],
  x: number,
  y: number,
  maxWidth: number,
  font: PDFFont,
  fontSize: number,
  color = TEXT,
) {
  if (!words.length) return;
  if (words.length === 1) {
    page.drawText(words[0], { x, y, size: fontSize, font, color });
    return;
  }
  let natural = 0;
  for (let i = 0; i < words.length; i++) {
    natural += font.widthOfTextAtSize(words[i], fontSize);
    if (i < words.length - 1) natural += font.widthOfTextAtSize(" ", fontSize);
  }
  const gaps = words.length - 1;
  const extra = Math.max(0, maxWidth - natural);
  const addPerGap = gaps > 0 ? extra / gaps : 0;
  let cx = x;
  for (let i = 0; i < words.length; i++) {
    page.drawText(words[i], { x: cx, y, size: fontSize, font, color });
    cx += font.widthOfTextAtSize(words[i], fontSize);
    if (i < words.length - 1) cx += font.widthOfTextAtSize(" ", fontSize) + addPerGap;
  }
}

function drawLeftLine(page: PDFPage, text: string, x: number, y: number, font: PDFFont, fontSize: number, color = TEXT) {
  page.drawText(text, { x, y, size: fontSize, font, color });
}

function drawCenteredLines(
  page: PDFPage,
  lines: string[],
  yStart: number,
  font: PDFFont,
  fontSize: number,
  lineGap: number,
  color = BRAND,
): number {
  let y = yStart;
  for (const line of lines) {
    const w = font.widthOfTextAtSize(line, fontSize);
    const x = (PAGE_W - w) / 2;
    page.drawText(line, { x, y, size: fontSize, font, color });
    y -= lineGap;
  }
  return y;
}

type ContentBlock = { kind: "intro"; text: string } | { kind: "clause"; heading: string; body: string };

function parseContractContent(content: string): ContentBlock[] {
  const chunks = String(content ?? "")
    .split(/\n\n+/)
    .map((c) => c.trim())
    .filter(Boolean);
  const blocks: ContentBlock[] = [];
  for (const chunk of chunks) {
    const nl = chunk.indexOf("\n");
    const firstLine = (nl === -1 ? chunk : chunk.slice(0, nl)).trim();
    const rest = nl === -1 ? "" : chunk.slice(nl + 1).trim();
    if (/^\d+\.\s+/.test(firstLine)) {
      blocks.push({ kind: "clause", heading: firstLine, body: rest });
    } else {
      blocks.push({ kind: "intro", text: chunk });
    }
  }
  return blocks;
}

class PdfLayout {
  pdfDoc: PDFDocument;
  page: PDFPage;
  cursorY: number;
  helv: PDFFont;
  helvBold: PDFFont;
  usableWidth: number;

  constructor(
    pdfDoc: PDFDocument,
    page: PDFPage,
    helv: PDFFont,
    helvBold: PDFFont,
  ) {
    this.pdfDoc = pdfDoc;
    this.page = page;
    this.helv = helv;
    this.helvBold = helvBold;
    this.usableWidth = PAGE_W - MARGIN * 2;
    this.cursorY = PAGE_H - MARGIN;
  }

  needSpace(height: number): void {
    if (this.cursorY - height < MARGIN + FOOTER_MIN_CLEARANCE) {
      this.page = this.pdfDoc.addPage([PAGE_W, PAGE_H]);
      this.cursorY = PAGE_H - MARGIN;
    }
  }

  advance(delta: number) {
    this.cursorY -= delta;
  }

  drawParagraphJustified(
    paragraph: string,
    fontSize: number,
    lineHeight: number,
    paragraphGapAfter: number,
  ) {
    const words = splitIntoWords(paragraph);
    if (!words.length) {
      this.advance(paragraphGapAfter);
      return;
    }
    const wordLines = wrapWords(words, this.usableWidth, this.helv, fontSize);
    for (let i = 0; i < wordLines.length; i++) {
      const isLast = i === wordLines.length - 1;
      this.needSpace(lineHeight);
      const line = wordLines[i];
      if (isLast && line.length > 1) {
        const lineStr = line.join(" ");
        drawLeftLine(this.page, lineStr, MARGIN, this.cursorY, this.helv, fontSize, TEXT);
      } else if (isLast && line.length === 1) {
        drawLeftLine(this.page, line[0], MARGIN, this.cursorY, this.helv, fontSize, TEXT);
      } else {
        drawJustifiedLine(this.page, line, MARGIN, this.cursorY, this.usableWidth, this.helv, fontSize, TEXT);
      }
      this.advance(lineHeight);
    }
    this.advance(paragraphGapAfter);
  }
}

async function drawFooterAsync(pdfDoc: PDFDocument, helv: PDFFont, logoBytes: Uint8Array | null) {
  const pages = pdfDoc.getPages();
  const page = pages[pages.length - 1];
  const siteBaseline = MARGIN + 16;
  const tw = helv.widthOfTextAtSize("dogshift.ch", 9);
  page.drawText("dogshift.ch", {
    x: (PAGE_W - tw) / 2,
    y: siteBaseline,
    size: 9,
    font: helv,
    color: TEXT_MUTED,
  });

  if (!logoBytes?.length) return;

  try {
    const img = await pdfDoc.embedPng(logoBytes);
    const maxW = 88;
    const scale = maxW / img.width;
    const w = img.width * scale;
    const h = img.height * scale;
    const x = (PAGE_W - w) / 2;
    const logoBottomY = siteBaseline + 22;
    page.drawImage(img, {
      x,
      y: logoBottomY,
      width: w,
      height: h,
    });
  } catch {
    /* skip invalid image */
  }
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
  const helv = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helvBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const logoBytes = await tryLoadLogoPngBytes();

  let page = pdfDoc.addPage([PAGE_W, PAGE_H]);
  const lay = new PdfLayout(pdfDoc, page, helv, helvBold);

  const titleSize = 20;
  const titleLineGap = titleSize * 1.35;
  const titleLines = wrapWords(splitIntoWords(title), lay.usableWidth * 0.92, helvBold, titleSize).map((ws) =>
    ws.join(" "),
  );
  lay.needSpace(24 + titleLines.length * titleLineGap);
  lay.advance(8);
  let ty = lay.cursorY;
  ty = drawCenteredLines(lay.page, titleLines, ty, helvBold, titleSize, titleLineGap, BRAND);
  lay.cursorY = ty;
  lay.advance(20);

  // Meta + proof (bold block, date regular)
  const metaLeading = 15;
  const metaLines: { text: string; bold: boolean }[] = [
    { text: `Version du contrat: ${version}`, bold: true },
    { text: "Signature électronique DogShift", bold: true },
    { text: "Signé électroniquement par:", bold: true },
    { text: contractSignerName, bold: true },
    { text: "", bold: true },
    { text: `Le: ${formatSignedAtFr(contractSignedAt)}`, bold: false },
  ];
  for (const { text, bold } of metaLines) {
    if (text === "") {
      lay.needSpace(6);
      lay.advance(6);
      continue;
    }
    lay.needSpace(metaLeading);
    const font = bold ? helvBold : helv;
    const color = bold ? TEXT : TEXT_MUTED;
    const size = bold ? 11 : 10.5;
    lay.page.drawText(text, { x: MARGIN, y: lay.cursorY, size, font, color });
    lay.advance(metaLeading);
  }

  lay.advance(8);
  lay.needSpace(2);
  lay.page.drawLine({
    start: { x: MARGIN, y: lay.cursorY },
    end: { x: PAGE_W - MARGIN, y: lay.cursorY },
    thickness: 0.6,
    color: RULE,
  });
  lay.advance(22);

  const blocks = parseContractContent(content);
  const introSize = 11;
  const introLineH = 16;
  const introParaGap = 12;
  const clauseTitleSize = 12;
  const clauseTitleGap = 18;
  const bodySize = 10.75;
  const bodyLineH = 15.5;
  const bodyParaGap = 11;
  const sectionTopGap = 16;

  for (const block of blocks) {
    if (block.kind === "intro") {
      const parts = block.text.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
      for (const p of parts) {
        lay.drawParagraphJustified(p, introSize, introLineH, introParaGap);
      }
    } else {
      lay.needSpace(sectionTopGap + clauseTitleGap);
      lay.advance(sectionTopGap);
      lay.page.drawText(block.heading, {
        x: MARGIN,
        y: lay.cursorY,
        size: clauseTitleSize,
        font: helvBold,
        color: BRAND,
      });
      lay.advance(clauseTitleGap);
      const bodyParts = block.body.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
      for (const p of bodyParts) {
        lay.drawParagraphJustified(p, bodySize, bodyLineH, bodyParaGap);
      }
    }
  }

  if (lay.cursorY < MARGIN + FOOTER_MIN_CLEARANCE) {
    pdfDoc.addPage([PAGE_W, PAGE_H]);
    lay.cursorY = PAGE_H - MARGIN;
  }

  await drawFooterAsync(pdfDoc, helv, logoBytes);

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
