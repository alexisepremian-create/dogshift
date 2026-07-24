export type MatingGoalValue = "LITTER" | "STUD" | "EXPLORING";

export type DeckCard = {
  matingProfileId: string;
  dogName: string;
  breed: string | null;
  birthYear: number | null;
  sex: "MALE" | "FEMALE" | null;
  region: string | null;
  bio: string | null;
  goal: MatingGoalValue;
  photoUrl: string | null;
};

export type MatchSummary = {
  matchId: string;
  threadId: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  otherDog: {
    matingProfileId: string;
    dogName: string;
    breed: string | null;
    birthYear: number | null;
    sex: "MALE" | "FEMALE" | null;
    region: string | null;
    photoUrl: string | null;
  };
};

export type OwnerDog = {
  id: string;
  name: string;
  breed: string | null;
  sex: "MALE" | "FEMALE" | null;
  neutered: boolean | null;
  photoUrl: string | null;
  birthYear: number | null;
};

export function ageLabel(birthYear: number | null | undefined, now = new Date()): string | null {
  if (birthYear == null || !Number.isFinite(birthYear)) return null;
  const age = now.getFullYear() - birthYear;
  if (age < 0 || age > 30) return null;
  return age <= 1 ? "1 an" : `${age} ans`;
}
