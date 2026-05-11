/**
 * Auth.js v5 catch-all route handler.
 *
 * Auth.js v5 exposes `handlers` as an object with GET/POST from the main
 * config file (auth.ts). We re-export them here so /api/auth/* (signin,
 * callback, session, csrf, etc.) is wired automatically.
 */
import { handlers } from "@/auth";

export const runtime = "nodejs";

export const { GET, POST } = handlers;
