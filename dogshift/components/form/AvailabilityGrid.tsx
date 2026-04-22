"use client";

import {
  DAY_KEYS,
  DAY_LABELS,
  countFullDays,
  type AvailabilityGridValue,
  type DayKey,
  type DaySlots,
} from "@/lib/sitterApplication/options";

type Props = {
  value: AvailabilityGridValue;
  onChange: (next: AvailabilityGridValue) => void;
  disabled?: boolean;
};

type SlotKey = keyof DaySlots;

const COLUMN_LABELS: Array<{ key: SlotKey; label: string }> = [
  { key: "matin", label: "Matin" },
  { key: "apresMidi", label: "Après-midi" },
  { key: "journeeEntiere", label: "Journée entière" },
];

/**
 * Compute the next slots for a day after toggling one cell.
 *
 * Rules:
 *  - Toggling "journeeEntiere" ON sets matin + apresMidi ON.
 *  - Toggling "journeeEntiere" OFF leaves matin + apresMidi as-is (so the
 *    sitter can fall back to a half-day without losing previous selection).
 *  - If both "matin" and "apresMidi" end up ON, "journeeEntiere" is set ON.
 *  - If any of them is OFF, "journeeEntiere" is OFF.
 */
function toggleSlot(current: DaySlots, slot: SlotKey): DaySlots {
  const next: DaySlots = { ...current };
  const newVal = !current[slot];

  if (slot === "journeeEntiere") {
    next.journeeEntiere = newVal;
    if (newVal) {
      next.matin = true;
      next.apresMidi = true;
    }
    return next;
  }

  next[slot] = newVal;
  next.journeeEntiere = next.matin && next.apresMidi;
  return next;
}

export default function AvailabilityGrid({ value, onChange, disabled }: Props) {
  const fullDays = countFullDays(value);

  const update = (day: DayKey, slot: SlotKey) => {
    if (disabled) return;
    onChange({ ...value, [day]: toggleSlot(value[day], slot) });
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left">
              <th className="py-2 pr-3 text-xs font-semibold text-slate-500">Jour</th>
              {COLUMN_LABELS.map((c) => (
                <th
                  key={c.key}
                  className="py-2 px-2 text-center text-xs font-semibold text-slate-500"
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAY_KEYS.map((day) => {
              const slots = value[day];
              return (
                <tr key={day} className="border-t border-slate-100">
                  <td className="py-2 pr-3 text-sm font-medium text-slate-800">
                    {DAY_LABELS[day]}
                  </td>
                  {COLUMN_LABELS.map((c) => {
                    const checked = slots[c.key];
                    const inputId = `avail-${day}-${c.key}`;
                    return (
                      <td key={c.key} className="py-2 px-2 text-center">
                        <label
                          htmlFor={inputId}
                          className={`inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-xl border transition ${
                            checked
                              ? "border-[var(--dogshift-blue)] bg-[var(--dogshift-blue)] text-white shadow-sm"
                              : "border-slate-200 bg-white text-slate-400 hover:border-slate-300"
                          } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
                        >
                          <input
                            id={inputId}
                            type="checkbox"
                            className="sr-only"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => update(day, c.key)}
                            aria-label={`${DAY_LABELS[day]} – ${c.label}`}
                          />
                          <span aria-hidden="true" className="text-xs font-semibold">
                            {checked ? "✓" : ""}
                          </span>
                        </label>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs leading-relaxed text-slate-600">
        Nous recherchons des sitters disponibles minimum 3 jours par semaine en
        journée entière. Les autres profils sont aussi étudiés.
        {fullDays > 0 ? (
          <span className="ml-1 font-semibold text-slate-800">
            Actuellement sélectionné&nbsp;: {fullDays} journée{fullDays > 1 ? "s" : ""} entière{fullDays > 1 ? "s" : ""}.
          </span>
        ) : null}
      </p>
    </div>
  );
}
