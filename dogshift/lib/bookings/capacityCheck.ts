import { prisma } from "@/lib/prisma";
import { DOG_SIZE_WEIGHTS, dogSizeKeyFromWeight, type DogSizeKey } from "@/lib/constants/dog-sizes";

/**
 * Map French dog size labels to DogSizeKey.
 */
function toDogSizeKey(size: string): DogSizeKey | null {
  const map: Record<string, DogSizeKey> = {
    Petit: "small",
    petit: "small",
    Moyen: "medium",
    moyen: "medium",
    Grand: "large",
    grand: "large",
    small: "small",
    medium: "medium",
    large: "large",
  };
  return map[size] ?? null;
}

/**
 * Check if a sitter accepts a given dog size.
 */
export function isSizeAccepted(
  sitter: { acceptsSmall: boolean; acceptsMedium: boolean; acceptsLarge: boolean },
  dogSize: string,
): { accepted: boolean; sizeKey: DogSizeKey | null } {
  const key = toDogSizeKey(dogSize);
  if (!key) return { accepted: false, sizeKey: null };
  const accepted =
    key === "small" ? sitter.acceptsSmall :
    key === "medium" ? sitter.acceptsMedium :
    sitter.acceptsLarge;
  return { accepted, sizeKey: key };
}

/**
 * Check if the sitter has enough capacity for a new booking in a date range.
 * Returns { ok: true } or { ok: false, availablePlaces, requiredPlaces }.
 */
export async function checkCapacityForBooking(args: {
  sitterId: string;
  capacityPlaces: number;
  dogSizeKey: DogSizeKey;
  startDate: string; // ISO yyyy-mm-dd
  endDate: string;   // ISO yyyy-mm-dd
  excludeBookingId?: string;
}): Promise<
  | { ok: true }
  | { ok: false; availablePlaces: number; requiredPlaces: number }
> {
  const { sitterId, capacityPlaces, dogSizeKey, startDate, endDate, excludeBookingId } = args;
  const requiredPlaces = DOG_SIZE_WEIGHTS[dogSizeKey].weight;

  const overlapping = await prisma.booking.findMany({
    where: {
      sitterId,
      status: { in: ["CONFIRMED", "PAID", "PENDING_PAYMENT", "PENDING_ACCEPTANCE"] },
      startDate: { lte: new Date(`${endDate}T23:59:59.999Z`) },
      endDate: { gte: new Date(`${startDate}T00:00:00.000Z`) },
      ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
    },
    select: { id: true, selectedDog: { select: { weightKg: true } } },
  });

  let usedPlaces = 0;
  for (const booking of overlapping) {
    const key = dogSizeKeyFromWeight(booking.selectedDog?.weightKg);
    // Legacy unknown weights must not under-count a large dog.
    usedPlaces += key ? DOG_SIZE_WEIGHTS[key].weight : DOG_SIZE_WEIGHTS.large.weight;
  }

  const available = capacityPlaces - usedPlaces;
  if (available >= requiredPlaces) {
    return { ok: true };
  }
  return { ok: false, availablePlaces: Math.max(0, available), requiredPlaces };
}
