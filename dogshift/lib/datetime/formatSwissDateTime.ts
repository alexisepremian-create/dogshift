const SWISS_TIME_ZONE = "Europe/Zurich";

export function formatSwissDateTimeHuman(iso: string) {
  const dt = new Date(iso);
  if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return iso;
  const datePart = new Intl.DateTimeFormat("fr-CH", {
    timeZone: SWISS_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(dt);
  const timePart = new Intl.DateTimeFormat("fr-CH", {
    timeZone: SWISS_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(dt);
  return `${datePart} à ${timePart}`;
}

export function formatSwissDateTimeCompact(iso: string) {
  const dt = new Date(iso);
  if (!(dt instanceof Date) || Number.isNaN(dt.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-CH", {
    timeZone: SWISS_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(dt)
    .replaceAll(".", "-");
}

