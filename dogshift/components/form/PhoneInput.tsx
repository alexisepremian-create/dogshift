"use client";

import { forwardRef, useCallback } from "react";
import type { ChangeEvent } from "react";

import {
  formatSwissPhoneDisplay,
  normalizeSwissPhone,
} from "@/lib/sitterApplication/options";

import TextInput from "./TextInput";

type Props = {
  id?: string;
  name?: string;
  value: string;
  onChange: (normalized: string) => void;
  onBlur?: () => void;
  invalid?: boolean;
  disabled?: boolean;
  placeholder?: string;
};

/**
 * Swiss phone input:
 *  - Displays a visual mask like `+41 79 123 45 67`.
 *  - Stores the normalized form `+41XXXXXXXXX` in the RHF field.
 *
 * The input is controlled by the normalized value held by RHF. We re-render
 * the display by formatting that normalized string — this keeps the component
 * simple and avoids a second local state.
 */
const PhoneInput = forwardRef<HTMLInputElement, Props>(function PhoneInput(
  { id, name, value, onChange, onBlur, invalid, disabled, placeholder },
  ref,
) {
  const handleChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // If the user cleared everything, keep "+41" as anchor for UX.
      if (raw.trim() === "") {
        onChange("");
        return;
      }
      // If the user is deleting a space, drop digits accordingly.
      const normalized = normalizeSwissPhone(raw);
      // Cap at +41 + 9 digits (12 chars) to prevent typing past the mask.
      const capped = normalized.startsWith("+41")
        ? `+41${normalized.slice(3).slice(0, 9)}`
        : normalized.slice(0, 12);
      onChange(capped);
    },
    [onChange],
  );

  const display = value ? formatSwissPhoneDisplay(value) : "";

  return (
    <TextInput
      ref={ref}
      id={id}
      name={name}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={display}
      onChange={handleChange}
      onBlur={onBlur}
      invalid={invalid}
      disabled={disabled}
      placeholder={placeholder ?? "+41 79 123 45 67"}
    />
  );
});

export default PhoneInput;
