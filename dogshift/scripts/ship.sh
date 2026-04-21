#!/usr/bin/env bash
# ship: one-command "push my changes and let CI auto-merge them".
#
# Creates a branch, commits every tracked/untracked change in the repo, pushes
# it, opens a Pull Request and enables GitHub auto-merge so the PR merges
# itself the moment CI goes green (lint + typecheck + unit tests + Next build
# + Playwright smoke tests).
#
# Usage:
#   npm run ship -- "fix: whatever I just changed"
#   npm run ship                      # interactive: prompts for a message
#
# Requirements (first-time setup):
#   brew install gh
#   gh auth login
#
# Why a script and not `git push`? GitHub's auto-merge feature is gated on
# a PR existing. This script is the shortest path from "save file" to "live
# in prod" while still keeping every safety net (CI) in place.

set -euo pipefail

DOGSHIFT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
GIT_ROOT="$(git -C "$DOGSHIFT_ROOT" rev-parse --show-toplevel)"
cd "$GIT_ROOT"

RED="\033[0;31m"; GREEN="\033[0;32m"; YELLOW="\033[1;33m"; BLUE="\033[0;34m"; NC="\033[0m"
info()  { printf "${BLUE}›${NC} %s\n" "$*"; }
ok()    { printf "${GREEN}✓${NC} %s\n" "$*"; }
warn()  { printf "${YELLOW}!${NC} %s\n" "$*"; }
fail()  { printf "${RED}✗${NC} %s\n" "$*" >&2; exit 1; }

command -v gh >/dev/null 2>&1 || fail "GitHub CLI not found. Install with: brew install gh && gh auth login"
gh auth status >/dev/null 2>&1 || fail "GitHub CLI not authenticated. Run: gh auth login"

DEFAULT_BRANCH="$(gh repo view --json defaultBranchRef -q .defaultBranchRef.name 2>/dev/null || echo "main")"

CURRENT_BRANCH="$(git branch --show-current)"
if [ "$CURRENT_BRANCH" != "$DEFAULT_BRANCH" ]; then
  warn "You are on '$CURRENT_BRANCH'. ship works best from '$DEFAULT_BRANCH'."
  warn "Continuing — your current branch will be reused."
fi

if [ -z "$(git status --porcelain)" ]; then
  fail "Nothing to ship. Make some changes first."
fi

MESSAGE="${1:-}"
if [ -z "$MESSAGE" ]; then
  printf "%s" "Commit message: "
  read -r MESSAGE
fi
[ -z "$MESSAGE" ] && fail "A commit message is required."

SLUG="$(printf "%s" "$MESSAGE" | tr '[:upper:]' '[:lower:]' | tr -c 'a-z0-9' '-' | tr -s '-' | sed -e 's/^-//' -e 's/-$//' | cut -c1-40)"
[ -z "$SLUG" ] && SLUG="changes"
TIMESTAMP="$(date +%Y%m%d-%H%M%S)"
BRANCH="ship/${TIMESTAMP}-${SLUG}"

if [ "$CURRENT_BRANCH" = "$DEFAULT_BRANCH" ]; then
  info "Creating branch: $BRANCH"
  git checkout -b "$BRANCH"
else
  # Reuse the existing feature branch — don't start nested ship/ branches.
  BRANCH="$CURRENT_BRANCH"
  info "Reusing current branch: $BRANCH"
fi

info "Staging all changes"
git add -A

info "Committing"
git commit -m "$MESSAGE" --no-verify=false

info "Pushing to origin/$BRANCH"
git push -u origin "$BRANCH"

info "Opening PR"
PR_URL="$(gh pr create --base "$DEFAULT_BRANCH" --head "$BRANCH" --title "$MESSAGE" --body "Shipped via \`npm run ship\`. CI-gated auto-merge enabled." 2>/dev/null || gh pr view --json url -q .url)"
ok "PR: $PR_URL"

info "Enabling auto-merge (squash)"
if gh pr merge --auto --squash --delete-branch 2>/dev/null; then
  ok "Auto-merge enabled. The PR will merge itself as soon as CI is green."
else
  warn "Could not enable auto-merge automatically."
  warn "Open $PR_URL and click 'Enable auto-merge (squash)'."
  warn "(Make sure auto-merge is enabled in repo Settings → General → Pull Requests.)"
fi

ok "Done. You can close the terminal — the PR takes over from here."
