/**
 * Type augmentations for Auth.js v5 — DogShift.
 *
 * Adds `id` and `role` to `session.user` so consumers can `session.user.role`
 * without casting. Mirrors the Prisma User.role enum (OWNER | SITTER | ADMIN).
 */
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role?: "OWNER" | "SITTER" | "ADMIN";
    } & DefaultSession["user"];
  }
}
