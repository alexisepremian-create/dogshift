"use client";

import { useId } from "react";

import Checkbox from "./Checkbox";

type Option = { value: string; label: string; description?: string };

type Props = {
  name?: string;
  value: readonly string[];
  onChange: (next: string[]) => void;
  options: readonly Option[];
  columns?: 1 | 2;
  disabled?: boolean;
};

export default function MultiCheckboxGroup({
  name,
  value,
  onChange,
  options,
  columns = 1,
  disabled,
}: Props) {
  const groupId = useId();

  function toggle(v: string) {
    if (value.includes(v)) onChange(value.filter((x) => x !== v));
    else onChange([...value, v]);
  }

  return (
    <div
      role="group"
      aria-labelledby={name ? `${name}-label` : undefined}
      className={`grid gap-2 ${columns === 2 ? "sm:grid-cols-2" : ""}`}
    >
      {options.map((o) => {
        const inputId = `${groupId}-${o.value}`;
        const checked = value.includes(o.value);
        return (
          <Checkbox
            key={o.value}
            id={inputId}
            name={name}
            cardStyle
            checked={checked}
            disabled={disabled}
            onChange={() => toggle(o.value)}
            label={o.label}
            description={o.description}
          />
        );
      })}
    </div>
  );
}
