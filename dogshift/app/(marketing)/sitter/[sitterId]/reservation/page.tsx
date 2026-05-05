/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { notFound } from "next/navigation";
import { auth, currentUser } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import ReservationClient from "./reservation-client";
import { prisma } from "@/lib/prisma";
import { ensureDbUserByClerkUserId } from "@/lib/auth/resolveDbUserId";
export const runtime = "nodejs";

export default async function ReservationPage({
  params,
  searchParams,
}: {
  params: Promise<{ sitterId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const sitterId = resolvedParams?.sitterId;
  const modeRaw = resolvedSearchParams?.mode;
  const mode = typeof modeRaw === "string" ? modeRaw : Array.isArray(modeRaw) ? modeRaw[0] : "";

  if (!sitterId) notFound();

  const cookieStore = await cookies();

  let allowPreviewAccess = false;
  if (mode === "preview") {
    const { userId } = await auth();
    if (userId) {
      const clerkUser = await currentUser();
      const email = clerkUser?.primaryEmailAddress?.emailAddress ?? "";
      if (email) {
        const ensured = await ensureDbUserByClerkUserId({
          clerkUserId: userId,
          email,
          name: typeof clerkUser?.fullName === "string" ? clerkUser.fullName : null,
        });
        if (ensured?.id) {
          const ownSitterProfile = await prisma.sitterProfile.findUnique({
            where: { userId: ensured.id },
            select: { sitterId: true },
          });
          allowPreviewAccess = ownSitterProfile?.sitterId === sitterId;
        }
      }
    }
  }

  const sitterProfile = await (prisma as any).sitterProfile.findFirst({
    where: allowPreviewAccess ? { sitterId } : { sitterId, published: true },
    select: {
      sitterId: true,
      displayName: true,
      city: true,
      postalCode: true,
      bio: true,
      avatarUrl: true,
      services: true,
      pricing: true,
      lat: true,
      lng: true,
      pensionVerifStatus: true,
      pensionAcceptedSizes: true,
      user: { select: { name: true, image: true } },
    },
  });

  if (!sitterProfile) notFound();

  const pricing = sitterProfile.pricing && typeof sitterProfile.pricing === "object" ? (sitterProfile.pricing as Record<string, unknown>) : {};
  const rawServices = Array.isArray(sitterProfile.services) ? (sitterProfile.services as unknown[]).filter((s): s is string => typeof s === "string") : [];
  const allowedServiceLabels = new Set(["Promenade", "Garde", "Pension"]);
  const pricedServices = Object.entries(pricing)
    .filter(
      ([key, value]) =>
        allowedServiceLabels.has(key) && typeof value === "number" && Number.isFinite(value) && value > 0
    )
    .map(([key]) => key);
  const services = Array.from(new Set([...rawServices, ...pricedServices])).filter((service) => allowedServiceLabels.has(service));

  const sitterLat = typeof sitterProfile.lat === "number" && Number.isFinite(sitterProfile.lat) ? sitterProfile.lat : null;
  const sitterLng = typeof sitterProfile.lng === "number" && Number.isFinite(sitterProfile.lng) ? sitterProfile.lng : null;

  const isPensionApproved = sitterProfile.pensionVerifStatus === "approved" || sitterProfile.pensionVerifStatus === "ai_approved";
  const pensionAcceptedSizes: string[] = isPensionApproved && Array.isArray(sitterProfile.pensionAcceptedSizes) && sitterProfile.pensionAcceptedSizes.length > 0
    ? sitterProfile.pensionAcceptedSizes
    : [];

  const sitter = {
    sitterId: sitterProfile.sitterId,
    name: sitterProfile.displayName ?? sitterProfile.user?.name ?? "Sitter",
    city: sitterProfile.city ?? "",
    postalCode: sitterProfile.postalCode ?? "",
    bio: sitterProfile.bio ?? "",
    avatarUrl: sitterProfile.avatarUrl ?? sitterProfile.user?.image ?? "",
    services,
    pricing,
    lat: sitterLat,
    lng: sitterLng,
    hasAddress: sitterLat != null && sitterLng != null,
    pensionAcceptedSizes,
  };

  return <ReservationClient sitter={sitter} />;
}
