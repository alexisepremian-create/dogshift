# Mobile: first touch on splash / modals / header requires two taps

**Status:** Fixed (PRs #78 / #79, with a revert in between)

## Symptom

On mobile (iOS Safari and Android Chrome), the very first touch on
interactive elements like the splash screen, modals, or the header didn't
trigger the action. The user had to tap twice.

## Root cause

iOS "ghost click" behavior / 300 ms tap delay on elements without
`touch-action: manipulation`. A layout root change had removed the CSS
rule that neutralized this delay.

## Fix

Apply `touch-action: manipulation` to the affected elements. Tested on
both iOS Safari and Android Chrome.

## How to recognize a regression

- "I have to tap twice to open the menu / close the modal" on mobile
- Most noticeable on the first interaction in a fresh session
- Works fine after the first successful interaction (the delay only
  affects the *first* tap in some browser states)

## Related PRs

- PR #78 — initial fix
- PR #79 — revert
- Reintegrated later
- Commits: `de38b9a` (fix), `716502b` (revert)
