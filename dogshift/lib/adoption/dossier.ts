// Freezing the adopter dossier into an application.
//
// nLPD reasoning: `AdoptionApplication.answers` is a snapshot, not a join. The
// cédant must be able to see exactly what was disclosed to them at submission
// time, and a later profile edit must not rewrite an application they already
// read and answered.
//
// Pure module (no imports) so `node --test` runs it directly.

export type AdopterDossierSource = {
  housingType: string;
  isHomeOwner: boolean;
  landlordApproval: boolean | null;
  hasGarden: boolean;
  gardenFenced: boolean | null;
  householdAdults: number;
  householdChildren: number;
  youngestChildAge: number | null;
  hasOtherDogs: boolean;
  hasCats: boolean;
  otherPetsNote: string | null;
  hoursAlonePerDay: number | null;
  experienceLevel: number;
  previousDogsNote: string | null;
  activityLevel: number | null;
  canton: string | null;
  city: string | null;
  motivation: string | null;
  consentSharedAt: Date | null;
};

export type AdopterDossierSnapshot = Omit<AdopterDossierSource, "consentSharedAt"> & {
  /** ISO timestamp of the consent that made this disclosure lawful. */
  consentSharedAt: string | null;
  /** When the snapshot was taken — not when the profile was last edited. */
  snapshotAt: string;
};

export function snapshotAdopterDossier(
  profile: AdopterDossierSource,
  now: Date = new Date()
): AdopterDossierSnapshot {
  return {
    housingType: profile.housingType,
    isHomeOwner: profile.isHomeOwner,
    landlordApproval: profile.landlordApproval,
    hasGarden: profile.hasGarden,
    gardenFenced: profile.gardenFenced,
    householdAdults: profile.householdAdults,
    householdChildren: profile.householdChildren,
    youngestChildAge: profile.youngestChildAge,
    hasOtherDogs: profile.hasOtherDogs,
    hasCats: profile.hasCats,
    otherPetsNote: profile.otherPetsNote,
    hoursAlonePerDay: profile.hoursAlonePerDay,
    experienceLevel: profile.experienceLevel,
    previousDogsNote: profile.previousDogsNote,
    activityLevel: profile.activityLevel,
    canton: profile.canton,
    city: profile.city,
    motivation: profile.motivation,
    consentSharedAt: profile.consentSharedAt ? profile.consentSharedAt.toISOString() : null,
    snapshotAt: now.toISOString(),
  };
}
