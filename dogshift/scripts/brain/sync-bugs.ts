#!/usr/bin/env node
/**
 * Mirror docs/bugs/*.md → brain/🐛 Bugs/<Friendly Name>.md
 *
 * Why this exists:
 *  - docs/bugs/ is the canonical, versioned bug playbook (read by Claude
 *    via CLAUDE.md).
 *  - brain/🐛 Bugs/ is the personal Obsidian view — each bug has its own
 *    note in the sidebar, browsable with wikilinks.
 *  - Keeping them in sync manually is tedious. This script does it
 *    idempotently: each brain note carries an `auto_synced: true`
 *    frontmatter flag; if a note doesn't have it (i.e. you've added
 *    personal notes by removing the flag), it is left untouched.
 *
 * Run:
 *   npx tsx scripts/brain/sync-bugs.ts
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SOURCE_DIR = join(process.cwd(), "docs", "bugs");
const TARGET_DIR = join(process.cwd(), "brain", "🐛 Bugs");

/** Convert a kebab-case slug into a Title Case label suitable as Obsidian filename. */
function slugToTitle(slug: string): string {
  return slug
    .replace(/\.md$/, "")
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

mkdirSync(TARGET_DIR, { recursive: true });

const files = readdirSync(SOURCE_DIR).filter((f) => f.endsWith(".md"));
let created = 0;
let updated = 0;
let preserved = 0;

for (const filename of files) {
  // README has its own role in docs/; brain has [[Bugs]] as its index.
  if (filename === "README.md") continue;

  const sourcePath = join(SOURCE_DIR, filename);
  const sourceContent = readFileSync(sourcePath, "utf8");

  const targetName = `${slugToTitle(filename)}.md`;
  const targetPath = join(TARGET_DIR, targetName);

  // Honor manual edits: only overwrite files marked `auto_synced: true`.
  if (existsSync(targetPath)) {
    const existing = readFileSync(targetPath, "utf8");
    if (!/^auto_synced:\s*true/m.test(existing)) {
      preserved++;
      continue;
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const content = [
    "---",
    "auto_synced: true",
    `synced_at: ${today}`,
    `canonical: docs/bugs/${filename}`,
    "---",
    "",
    `> 📄 Source de vérité versionnée : \`docs/bugs/${filename}\` (lue par Claude). Pour conserver des notes manuelles ici, supprime la ligne \`auto_synced: true\` du frontmatter.`,
    "",
    sourceContent,
    "",
    "## Liens",
    "",
    "- [[Bugs]] — index parent",
    "- [[DogShift Brain]]",
    "",
  ].join("\n");

  const isNew = !existsSync(targetPath);
  writeFileSync(targetPath, content, "utf8");
  if (isNew) created++;
  else updated++;
}

console.log(`✓ Fiches bugs : ${created} créées, ${updated} resynchronisées, ${preserved} préservées (custom).`);
