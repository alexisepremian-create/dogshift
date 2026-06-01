"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Drop-in replacement for an admin search/filter form that auto-applies on
 * type (debounced 250ms) instead of requiring a click on the submit button.
 *
 * Wraps server-rendered filter pages : the inputs control URL search params
 * via the App Router, so the parent server component re-renders with fresh
 * data on every keystroke pause. No client-side fetch, no skeleton, no React
 * Query — same plumbing as a regular `<form method="get">` but instant.
 *
 * Usage :
 *   <InstantSearchForm action="/admin/impersonate" debounceMs={250}>
 *     <input name="q" defaultValue={q} placeholder="Email…" />
 *     <select name="role" defaultValue={role}>...</select>
 *   </InstantSearchForm>
 *
 * Every direct child <input>/<select>/<textarea> with a `name` attribute is
 * watched. Non-form children (labels, divs, buttons) are passed through
 * untouched.
 */
export default function InstantSearchForm({
  action,
  children,
  debounceMs = 250,
  className,
}: {
  action: string;
  children: ReactNode;
  debounceMs?: number;
  className?: string;
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function pushFromForm() {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const params = new URLSearchParams();
    for (const [k, v] of data.entries()) {
      const value = typeof v === "string" ? v.trim() : "";
      if (value) params.set(k, value);
    }
    const qs = params.toString();
    router.push(qs ? `${action}?${qs}` : action);
  }

  function scheduleUpdate(immediate = false) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    if (immediate) {
      pushFromForm();
      return;
    }
    debounceTimer.current = setTimeout(pushFromForm, debounceMs);
  }

  // Cleanup the debounce timer on unmount so a navigation away doesn't end up
  // pushing a URL after the component is gone.
  useEffect(
    () => () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    },
    [],
  );

  return (
    <form
      ref={formRef}
      action={action}
      method="get"
      onSubmit={(e) => {
        e.preventDefault();
        scheduleUpdate(true);
      }}
      onChange={() => scheduleUpdate(false)}
      onInput={() => scheduleUpdate(false)}
      className={className}
    >
      {children}
    </form>
  );
}
