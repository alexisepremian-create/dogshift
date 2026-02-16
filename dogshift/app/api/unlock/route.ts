import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const sitePassword = process.env.SITE_PASSWORD;
  if (!sitePassword) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  let body: unknown;
  try {
    body = (await req.json()) as unknown;
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const password = typeof (body as any)?.password === "string" ? ((body as any).password as string) : "";
  const next = typeof (body as any)?.next === "string" ? ((body as any).next as string) : "/";

  if (password !== sitePassword) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, next }, { status: 200 });
  res.cookies.set({
    name: "site_unlocked",
    value: "1",
    httpOnly: true,
    domain: process.env.NODE_ENV === "production" ? ".dogshift.ch" : undefined,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
