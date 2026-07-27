import { prisma } from "@/lib/prisma";

/**
 * Who is allowed to touch an application.
 *
 * Every application-scoped endpoint goes through this rather than repeating the
 * join: the cédant is reachable only via `listing.userId`, which is exactly the
 * kind of two-hop check that gets forgotten once and leaks a dossier.
 */
export type ApplicationAccess = {
  application: {
    id: string;
    listingId: string;
    userId: string;
    status: string;
    amicusConfirmedAt: Date | null;
    listing: { id: string; userId: string; dogName: string; status: string };
    thread: { id: string } | null;
  };
  isAdopter: boolean;
  isCedant: boolean;
};

export async function loadApplicationAccess(
  applicationId: string,
  viewerUserId: string
): Promise<ApplicationAccess | null> {
  const application = await prisma.adoptionApplication.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      listingId: true,
      userId: true,
      status: true,
      amicusConfirmedAt: true,
      listing: { select: { id: true, userId: true, dogName: true, status: true } },
      thread: { select: { id: true } },
    },
  });
  if (!application) return null;

  const isAdopter = application.userId === viewerUserId;
  const isCedant = application.listing.userId === viewerUserId;
  if (!isAdopter && !isCedant) return null;

  return { application, isAdopter, isCedant };
}
