export const SERVICE_COLORS = {
  promenade:  { dot: 'bg-sky-400', tint: 'bg-sky-50', text: 'text-sky-900', ring: 'border-sky-500', fill: 'bg-sky-500', activeBorder: 'border-sky-200', label: 'Promenade' },
  dogsitting: { dot: 'bg-violet-400', tint: 'bg-violet-50', text: 'text-violet-900', ring: 'border-violet-500', fill: 'bg-violet-500', activeBorder: 'border-violet-200', label: 'Dogsitting' },
  pension:    { dot: 'bg-emerald-400', tint: 'bg-emerald-50', text: 'text-emerald-900', ring: 'border-emerald-500', fill: 'bg-emerald-500', activeBorder: 'border-emerald-200', label: 'Pension' },
} as const;

export type ServiceKey = keyof typeof SERVICE_COLORS;

export function getServiceColors(serviceType: "PROMENADE" | "DOGSITTING" | "PENSION") {
  if (serviceType === "PROMENADE") return SERVICE_COLORS.promenade;
  if (serviceType === "DOGSITTING") return SERVICE_COLORS.dogsitting;
  return SERVICE_COLORS.pension;
}
