import { notFound } from "next/navigation";

import ReservationClient from "./reservation-client";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export default async function ReservationPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const resolvedParams = (await Promise.resolve(params)) as { id: string };
  const sitterId = resolvedParams?.id;

  if (!sitterId) notFound();

  const sitterProfile = await prisma.sitterProfile.findFirst({
    where: { sitterId, published: true },
    select: {
      sitterId: true,
      displayName: true,
      city: true,
      postalCode: true,
      bio: true,
      avatarUrl: true,
      services: true,
      pricing: true,
      user: { select: { name: true, image: true } },
    },
  });

  if (!sitterProfile) notFound();

  const services = Array.isArray(sitterProfile.services) ? sitterProfile.services.filter((s): s is string => typeof s === "string") : [];
  const pricing = sitterProfile.pricing && typeof sitterProfile.pricing === "object" ? (sitterProfile.pricing as Record<string, unknown>) : {};

  const sitter = {
    sitterId: sitterProfile.sitterId,
    name: sitterProfile.displayName ?? sitterProfile.user?.name ?? "Sitter",
    city: sitterProfile.city ?? "",
    postalCode: sitterProfile.postalCode ?? "",
    bio: sitterProfile.bio ?? "",
    avatarUrl: sitterProfile.avatarUrl ?? sitterProfile.user?.image ?? "",
    services,
    pricing,
  };

  return <ReservationClient sitter={sitter} />;
}
