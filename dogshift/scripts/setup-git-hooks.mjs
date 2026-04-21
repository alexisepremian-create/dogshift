#!/usr/bin/env node
/**
 * Wires Husky hooks for this repo. Run automatically on `npm install` via the
 * `prepare` script.
 *
 * The app lives in `dogshift/` but the git repo root is one level above, so we
 * can't rely on Husky's default "hooks live in ./.husky" convention. Instead,
 * we point git at `dogshift/.husky` from whatever the real repo root is.
 *
 * No-op (and silent) when we're not inside a git working tree (e.g. CI
 * environments that use `npm ci --ignore-scripts` or Docker builds).
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dogshiftRoot = join(__dirname, "..");
const huskyDir = join(dogshiftRoot, ".husky");

function quiet(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

const gitRoot = quiet(() =>
  execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: dogshiftRoot })
    .toString()
    .trim()
);

if (!gitRoot) {
  process.exit(0);
}

if (!existsSync(huskyDir)) {
  process.exit(0);
}

const hooksPathRelToGitRoot = relative(gitRoot, huskyDir) || ".husky";

quiet(() =>
  execFileSync("git", ["config", "core.hooksPath", hooksPathRelToGitRoot], {
    cwd: gitRoot,
  })
);

console.log(`[dogshift] git hooks wired to ${hooksPathRelToGitRoot}`);
