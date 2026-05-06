import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getRequestAdminAccess } from "@/lib/adminAuth";

export const runtime = "nodejs";

const REPO = "alexisepremian-create/dogshift";
const GH_API = "https://api.github.com";

type GithubPR = {
  number: number;
  title: string;
  body: string | null;
  merged_at: string | null;
  html_url: string;
  labels: { name: string }[];
  user: { login: string } | null;
};

type PRType = "feat" | "fix" | "perf" | "refactor" | "security";
type PRArea = "owner" | "sitter" | "admin" | "core" | "infra";

function parseType(title: string): PRType {
  const lower = title.toLowerCase();
  if (lower.startsWith("fix:") || lower.startsWith("fix(")) return "fix";
  if (lower.startsWith("feat:") || lower.startsWith("feat(")) return "feat";
  if (lower.startsWith("perf:") || lower.startsWith("perf(")) return "perf";
  if (lower.startsWith("security:") || lower.startsWith("sec:")) return "security";
  return "refactor";
}

function parseTitle(raw: string): string {
  return raw
    .replace(/^(feat|fix|perf|refactor|chore|docs|style|test|security|sec|build|ci)\s*(\([^)]*\))?\s*:\s*/i, "")
    .replace(/\s*\(#\d+\)\s*$/, "")
    .trim();
}

function inferAreas(title: string, labels: string[]): PRArea[] {
  const all = (title + " " + labels.join(" ")).toLowerCase();
  const areas: PRArea[] = [];

  if (/owner|account|booking|reservation|r[eé]servation|payment|checkout|dog profile/.test(all)) areas.push("owner");
  if (/sitter|host|dogsitter|pension|promenade|garde|availability|disponibilit/.test(all)) areas.push("sitter");
  if (/admin|panel|verification|v[eé]rif|changelog|candidature/.test(all)) areas.push("admin");
  if (/stripe|webhook|payment|email|sms|message|notification/.test(all) && !areas.includes("owner")) areas.push("core");
  if (/ci|deploy|vercel|infra|build|migration|schema|prisma|cron/.test(all)) areas.push("infra");

  return areas.length > 0 ? [...new Set(areas)] : ["core"];
}

function extractDetails(body: string | null): string[] {
  if (!body) return [];

  const lines = body.split("\n");
  const details: string[] = [];

  for (const line of lines) {
    const clean = line.replace(/^[-*•]\s*/, "").trim();
    if (
      clean.length > 10 &&
      clean.length < 200 &&
      !clean.startsWith("#") &&
      !clean.startsWith("<!--") &&
      !clean.toLowerCase().includes("checklist") &&
      !clean.toLowerCase().includes("test plan") &&
      !clean.toLowerCase().includes("summary")
    ) {
      details.push(clean);
      if (details.length >= 5) break;
    }
  }

  return details;
}

export async function GET(req: NextRequest) {
  const access = await getRequestAdminAccess(req);
  if (!access.isAdmin) {
    return NextResponse.json({ ok: false, error: "FORBIDDEN" }, { status: 403 });
  }

  const token = process.env.GITHUB_TOKEN;
  const headers: HeadersInit = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "dogshift-admin",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  try {
    const res = await fetch(
      `${GH_API}/repos/${REPO}/pulls?state=closed&sort=updated&direction=desc&per_page=50`,
      { headers, next: { revalidate: 120 } },
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("[admin/changelog] GitHub API error", res.status, text);
      return NextResponse.json({ ok: false, error: "GITHUB_ERROR", status: res.status }, { status: 502 });
    }

    const prs = (await res.json()) as GithubPR[];
    const merged = prs
      .filter((pr) => pr.merged_at !== null)
      .map((pr) => ({
        pr: pr.number,
        date: pr.merged_at!.slice(0, 10),
        type: parseType(pr.title),
        title: parseTitle(pr.title),
        summary: pr.body ? pr.body.split("\n").find((l) => l.trim().length > 20)?.trim() ?? pr.title : pr.title,
        details: extractDetails(pr.body),
        area: inferAreas(pr.title, pr.labels.map((l) => l.name)),
        url: pr.html_url,
      }));

    return NextResponse.json({ ok: true, entries: merged });
  } catch (err) {
    console.error("[admin/changelog] fetch error", err);
    return NextResponse.json({ ok: false, error: "FETCH_ERROR" }, { status: 500 });
  }
}
