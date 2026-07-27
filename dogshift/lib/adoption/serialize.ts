import { publicDogPhotoPath } from "@/lib/dogPhotoMedia";
import { cantonName } from "@/lib/adoption/cantons";
import { checkBreedRestriction } from "@/lib/adoption/breedRestrictions";
import { formatAdoptionFee } from "@/lib/adoption/legal";
import { formatAgeFR, ageInMonths } from "@/lib/adoption/feed";

/**
 * Shapes returned to the client. Two levels on purpose:
 *  - card: what the feed needs (cheap, no legal text, no cédant identity)
 *  - detail: the full sheet, which is also where the OPAn art. 76d disclosure
 *    and the cantonal breed warning must appear.
 *
 * The cédant's name + address are legally required *on the ad*, so they are
 * part of the detail payload — but never of the card, to keep them off a
 * scrapeable list endpoint.
 */

export type ListingCardRow = {
  id: string;
  dogName: string;
  breed: string | null;
  secondaryBreed: string | null;
  isCrossbreed: boolean;
  sex: string;
  birthDate: Date;
  sizeCategory: string;
  canton: string;
  city: string;
  lat: number | null;
  lng: number | null;
  photos: string[];
  feeAmount: number;
  goodWithChildren: boolean | null;
  goodWithDogs: boolean | null;
  goodWithCats: boolean | null;
  status: string;
  publishedAt: Date | null;
  createdAt: Date;
  organization?: { id: string; name: string; status: string; logoUrl: string | null } | null;
  _count?: { applications: number };
};

export function serializeListingCard(row: ListingCardRow, now: Date, distanceKm: number | null = null) {
  return {
    id: row.id,
    dogName: row.dogName,
    breed: row.breed,
    secondaryBreed: row.secondaryBreed,
    isCrossbreed: row.isCrossbreed,
    sex: row.sex,
    ageLabel: formatAgeFR(row.birthDate, now),
    ageMonths: ageInMonths(row.birthDate, now),
    sizeCategory: row.sizeCategory,
    canton: row.canton,
    cantonLabel: cantonName(row.canton),
    city: row.city,
    distanceKm,
    coverPhotoUrl: row.photos.length > 0 ? publicDogPhotoPath(row.photos[0]) : null,
    photoCount: row.photos.length,
    feeAmount: row.feeAmount,
    feeLabel: formatAdoptionFee(row.feeAmount),
    goodWithChildren: row.goodWithChildren,
    goodWithDogs: row.goodWithDogs,
    goodWithCats: row.goodWithCats,
    status: row.status,
    publishedAt: row.publishedAt,
    organization: row.organization
      ? {
          id: row.organization.id,
          name: row.organization.name,
          verified: row.organization.status === "VERIFIED",
          logoUrl: row.organization.logoUrl,
        }
      : null,
    applicationCount: row._count?.applications ?? null,
  };
}

export type ListingDetailRow = ListingCardRow & {
  userId: string;
  weightKg: number | null;
  neutered: boolean | null;
  vaccinated: boolean | null;
  dewormed: boolean | null;
  microchipNumber: string | null;
  provenance: string;
  breedingCountry: string;
  cedantFullName: string;
  cedantAddress: string;
  cedantPostalCode: string;
  cedantCity: string;
  reason: string | null;
  description: string;
  idealHome: string | null;
  houseTrained: boolean | null;
  energyLevel: number | null;
  specialNeeds: string | null;
  lastConfirmedAt: Date | null;
  adoptedAt: Date | null;
  archivedAt: Date | null;
  acceptedTermsAt: Date | null;
  updatedAt: Date;
};

/**
 * `viewerCanton` is the *adopter's* canton, not the dog's: a breed that is
 * legal in VD can be banned where the adopter lives, and that is the warning
 * that actually matters to them. Falls back to the listing's canton.
 */
export function serializeListingDetail(
  row: ListingDetailRow,
  now: Date,
  options: { viewerCanton?: string | null; isOwner?: boolean; distanceKm?: number | null } = {}
) {
  const card = serializeListingCard(row, now, options.distanceKm ?? null);
  const canton = options.viewerCanton?.trim().toUpperCase() || row.canton;
  const restriction = checkBreedRestriction({
    canton,
    breed: row.breed,
    secondaryBreed: row.secondaryBreed,
    isCrossbreed: row.isCrossbreed,
  });

  return {
    ...card,
    isOwner: options.isOwner ?? false,
    weightKg: row.weightKg,
    neutered: row.neutered,
    vaccinated: row.vaccinated,
    dewormed: row.dewormed,
    // Only the last 4 digits: the full chip number identifies the dog in AMICUS
    // and belongs in the cession contract, not on a public page.
    microchipLast4: row.microchipNumber ? row.microchipNumber.slice(-4) : null,
    microchipNumber: options.isOwner ? row.microchipNumber : null,
    provenance: row.provenance,
    breedingCountry: row.breedingCountry,
    // OPAn art. 76d al. 1 — mandatory on the ad itself.
    cedant: {
      fullName: row.cedantFullName,
      address: row.cedantAddress,
      postalCode: row.cedantPostalCode,
      city: row.cedantCity,
    },
    reason: row.reason,
    description: row.description,
    idealHome: row.idealHome,
    houseTrained: row.houseTrained,
    energyLevel: row.energyLevel,
    specialNeeds: row.specialNeeds,
    photoUrls: row.photos.map((key) => publicDogPhotoPath(key)),
    breedRestriction: restriction.level === "NONE" ? null : restriction,
    lastConfirmedAt: row.lastConfirmedAt,
    adoptedAt: row.adoptedAt,
    archivedAt: row.archivedAt,
    acceptedTermsAt: row.acceptedTermsAt,
    updatedAt: row.updatedAt,
  };
}
