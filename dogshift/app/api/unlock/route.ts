import { NextResponse } from "next/server";

export async function POST(req: Request) {
  void req;
  return NextResponse.json({ ok: true, disabled: true, next: "/" }, { status: 200 });
}
