import { prisma } from "@/lib/prisma";

export type ActiveContractAmendment = {
  id: string;
  title: string;
  content: string;
  version: string;
  createdAt: string;
  activatedAt: string | null;
  isActive: boolean;
};

export type HostContractAmendmentState = {
  activeAmendment: ActiveContractAmendment | null;
  isUpToDate: boolean;
  acceptedAt: string | null;
  acceptedVersion: string | null;
  needsAcceptance: boolean;
};

export function normalizeContractVersion(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function compareContractVersions(a: unknown, b: unknown) {
  const left = normalizeContractVersion(a);
  const right = normalizeContractVersion(b);
  if (!left && !right) return 0;
  if (!left) return -1;
  if (!right) return 1;
  return left.localeCompare(right, "fr-CH", { numeric: true, sensitivity: "base" });
}

export function isContractVersionAtLeast(current: unknown, minimum: unknown) {
  return compareContractVersions(current, minimum) >= 0;
}

export async function getActiveContractAmendment(): Promise<ActiveContractAmendment | null> {
  const amendment = await (prisma as any).contractAmendment.findFirst({
    where: { isActive: true },
    orderBy: [{ activatedAt: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      content: true,
      version: true,
      createdAt: true,
      activatedAt: true,
      isActive: true,
    },
  });

  if (!amendment?.id) return null;

  return {
    id: amendment.id,
    title: amendment.title,
    content: amendment.content,
    version: amendment.version,
    createdAt: amendment.createdAt instanceof Date ? amendment.createdAt.toISOString() : new Date(amendment.createdAt).toISOString(),
    activatedAt: amendment.activatedAt instanceof Date ? amendment.activatedAt.toISOString() : amendment.activatedAt ? new Date(amendment.activatedAt).toISOString() : null,
    isActive: Boolean(amendment.isActive),
  };
}

export async function getHostContractAmendmentState(args: {
  sitterProfileId: string | null;
  contractVersion: string | null;
}): Promise<HostContractAmendmentState> {
  const activeAmendment = await getActiveContractAmendment();
  if (!activeAmendment || !args.sitterProfileId) {
    return {
      activeAmendment,
      isUpToDate: true,
      acceptedAt: null,
      acceptedVersion: null,
      needsAcceptance: false,
    };
  }

  if (isContractVersionAtLeast(args.contractVersion, activeAmendment.version)) {
    return {
      activeAmendment,
      isUpToDate: true,
      acceptedAt: null,
      acceptedVersion: activeAmendment.version,
      needsAcceptance: false,
    };
  }

  const acceptance = await (prisma as any).sitterContractAmendmentAcceptance.findUnique({
    where: {
      amendmentId_sitterProfileId: {
        amendmentId: activeAmendment.id,
        sitterProfileId: args.sitterProfileId,
      },
    },
    select: {
      acceptedAt: true,
      amendmentVersion: true,
    },
  });

  const acceptedAt = acceptance?.acceptedAt instanceof Date ? acceptance.acceptedAt.toISOString() : acceptance?.acceptedAt ? new Date(acceptance.acceptedAt).toISOString() : null;
  const acceptedVersion = typeof acceptance?.amendmentVersion === "string" ? acceptance.amendmentVersion : null;
  const isUpToDate = Boolean(acceptedAt && acceptedVersion === activeAmendment.version);

  return {
    activeAmendment,
    isUpToDate,
    acceptedAt,
    acceptedVersion,
    needsAcceptance: !isUpToDate,
  };
}
