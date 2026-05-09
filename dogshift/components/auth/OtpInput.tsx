"use client";

import { useRef, KeyboardEvent, ClipboardEvent, ChangeEvent } from "react";

interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  length?: number;
}

export default function OtpInput({ value, onChange, disabled = false, length = 6 }: OtpInputProps) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);

  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function focusAt(index: number) {
    const el = inputs.current[Math.max(0, Math.min(index, length - 1))];
    el?.focus();
    // Move cursor to end of the single-char input
    if (el) setTimeout(() => el.setSelectionRange(1, 1), 0);
  }

  function handleChange(index: number, e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/\D/g, "");
    if (!raw) return;

    const char = raw[raw.length - 1]!;
    const next = digits.map((d, i) => (i === index ? char : d));
    onChange(next.join(""));

    if (index < length - 1) focusAt(index + 1);
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      if (digits[index]) {
        const next = digits.map((d, i) => (i === index ? "" : d));
        onChange(next.join(""));
      } else if (index > 0) {
        const next = digits.map((d, i) => (i === index - 1 ? "" : d));
        onChange(next.join(""));
        focusAt(index - 1);
      }
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusAt(index - 1);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      focusAt(index + 1);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;

    const next = Array.from({ length }, (_, i) => pasted[i] ?? digits[i] ?? "");
    onChange(next.join(""));
    focusAt(Math.min(pasted.length, length - 1));
  }

  function handleFocus(e: React.FocusEvent<HTMLInputElement>) {
    e.target.select();
  }

  return (
    <div className="flex items-center justify-center gap-2.5" role="group" aria-label="Code de vérification à 6 chiffres">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { inputs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={1}
          value={digit}
          disabled={disabled}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Chiffre ${index + 1}`}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={handleFocus}
          className={[
            "h-14 w-11 rounded-2xl border text-center text-xl font-semibold text-slate-900 shadow-sm outline-none transition-all",
            "placeholder:text-slate-300 caret-transparent",
            digit
              ? "border-slate-900 bg-white ring-2 ring-slate-900/10"
              : "border-slate-300 bg-white",
            "focus:border-slate-800 focus:ring-4 focus:ring-slate-200",
            "disabled:cursor-not-allowed disabled:opacity-50",
          ].join(" ")}
        />
      ))}
    </div>
  );
}
