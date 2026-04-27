"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import AdminNotesPanel from "@/components/admin/AdminNotesPanel";
import { formatSwissDateTimeCompact, formatSwissDateTimeHuman } from "@/lib/datetime/formatSwissDateTime";
import type { SitterLifecycleStatus } from "@/lib/sitterContract";
import {
  availabilityToRows,
  describeOtherAnimals,
  labelForDogSize,
  labelForGardeExperienceLevel,
  labelForGardeType,
  labelForHousingType,
  labelForLinkAnimalProfession,
  type DaySlotsShape,
  type OtherAnimalsShape,
} from "@/lib/sitterApplication/labels";

type AppStatus = "PENDING" | "CONTACTED" | "ACCEPTED" | "ACTIVATED" | "REJECTED";

type ApplicationItem = {
  id: string;
  firstName: string;
  lastName: string;
  city: string;
  email: string;
  phone: string;
  age: number | null;
  experienceText: string;
  hasDogExperience: boolean;
  motivationText: string;
  availabilityText: string;
  consentInterview: boolean;
  consentPrivacy: boolean;
  status: AppStatus;
  // Structured fields from the v2 form. All nullable for backward compat
  // with legacy rows that predate the structured schema.
  npa: string | null;
  cityOther: string | null;
  linkAnimalProfession: string | null;
  linkAnimalProfessionOther: string | null;
  gardeExperienceLevel: string | null;
  availabilityStructured: Record<string, DaySlotsShape> | null;
  gardeTypes: string[];
  dogSizes: string[];
  housingType: string | null;
  housingTypeOther: string | null;
  otherAnimals: OtherAnimalsShape | null;
  otherAnimalsDogCount: number | null;
  hasCarLicense: boolean | null;
  allergies: string | null;
  calendlyLink: string | null;
  acceptedEmailSentAt: string | null;
  acceptedEmailSource: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referrer: string | null;
  userAgent: string | null;
  ip: string | null;
  linkedUserId: string | null;
  sitterProfileId: string | null;
  sitterLifecycleStatus: SitterLifecycleStatus | null;
  contractAccessTokenIssuedAt: string | null;
  contractAccessTokenExpiresAt: string | null;
  contractSignedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ContractDetailsPayload = {
  ok?: boolean;
  currentContract?: { title?: string; version?: string; content?: string };
  profile?: {
    userId?: string | null;
    sitterId?: string | null;
    profileId?: string;
    contractVersion?: string | null;
    contractAccessTokenVersion?: string | null;
    contractAccessTokenIssuedAt?: string | null;
    contractAccessTokenExpiresAt?: string | null;
    contractAccessTokenUsedAt?: string | null;
    contractSignerName?: string | null;
    contractSignedAt?: string | null;
    lifecycleStatus?: string | null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- contract snapshot is a JSON blob produced by legacy signed contracts; typing it would require generating a schema and is out of scope for this change.
    contractSnapshot?: any;
  } | null;
  error?: string;
};

function contractStatusLabel(item: ApplicationItem) {
  if (item.contractSignedAt || item.sitterLifecycleStatus === "contract_signed" || item.sitterLifecycleStatus === "activated") {
    return "contrat signé";
  }
  if (item.contractAccessTokenIssuedAt || item.sitterLifecycleStatus === "contract_to_sign") {
    return "contrat envoyé";
  }
  return "contrat non envoyé";
}

function statusLabel(status: AppStatus) {
  if (status === "PENDING") return "En attente";
  if (status === "CONTACTED") return "Contacté";
  if (status === "ACCEPTED") return "Accepté";
  if (status === "ACTIVATED") return "Activé";
  return "Refusé";
}

function statusTone(status: AppStatus) {
  if (status === "ACCEPTED") return "border-emerald-200 bg-emerald-50 text-emerald-900";
  if (status === "ACTIVATED") return "border-violet-200 bg-violet-50 text-violet-950";
  if (status === "CONTACTED") return "border-sky-200 bg-sky-50 text-sky-900";
  if (status === "REJECTED") return "border-rose-200 bg-rose-50 text-rose-900";
  return "border-slate-200 bg-slate-50 text-slate-800";
}

function formatFrCh(iso: string) {
  return formatSwissDateTimeCompact(iso);
}

function formatSignedAtHumanFrCh(iso: string) {
  return formatSwissDateTimeHuman(iso);
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <span className="text-xs font-semibold text-slate-500">{label}</span>
      <span className="text-right text-xs text-slate-800">{value}</span>
    </div>
  );
}

function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: "slate" | "blue" | "emerald" }) {
  const classes =
    tone === "blue"
      ? "border-sky-200 bg-sky-50 text-sky-900"
      : tone === "emerald"
        ? "border-emerald-200 bg-emerald-50 text-emerald-900"
        : "border-slate-200 bg-white text-slate-700";
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${classes}`}>
      {children}
    </span>
  );
}

function ApplicationProfileDetails({ item }: { item: ApplicationItem }) {
  const displayCity = item.city === "Autre" && item.cityOther ? `${item.cityOther} (Autre)` : item.city;
  const profession = labelForLinkAnimalProfession(item.linkAnimalProfession);
  const professionExtra = item.linkAnimalProfession === "other" ? item.linkAnimalProfessionOther : null;
  const experienceLevel = labelForGardeExperienceLevel(item.gardeExperienceLevel);
  const housing = labelForHousingType(item.housingType);
  const housingExtra = item.housingType === "other" ? item.housingTypeOther : null;
  const otherAnimalsText = describeOtherAnimals(item.otherAnimals, item.otherAnimalsDogCount);

  // When the row predates the structured form entirely, hide the block so we
  // don't pollute the admin view with a grid of "—".
  const hasAnyStructuredField =
    item.npa ||
    item.linkAnimalProfession ||
    item.gardeExperienceLevel ||
    item.gardeTypes.length > 0 ||
    item.dogSizes.length > 0 ||
    item.housingType ||
    item.otherAnimals ||
    item.hasCarLicense != null ||
    item.allergies ||
    item.age != null;

  if (!hasAnyStructuredField) return null;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold text-slate-700">Profil détaillé</p>

      <div className="mt-3 grid gap-6 md:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Identité</p>
          <div className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-slate-50 px-3">
            <InfoRow label="Âge" value={item.age != null ? `${item.age} ans` : "—"} />
            <InfoRow label="NPA" value={item.npa ?? "—"} />
            <InfoRow label="Ville" value={displayCity} />
            <InfoRow label="Permis B" value={item.hasCarLicense == null ? "—" : item.hasCarLicense ? "Oui" : "Non"} />
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Profil dogsitter</p>
          <div className="mt-2 divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-slate-50 px-3">
            <InfoRow
              label="Métier animalier"
              value={
                profession ? (
                  <span>
                    {profession}
                    {professionExtra ? <span className="text-slate-500"> — {professionExtra}</span> : null}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <InfoRow label="Expérience de garde" value={experienceLevel ?? "—"} />
            <InfoRow
              label="Logement"
              value={
                housing ? (
                  <span>
                    {housing}
                    {housingExtra ? <span className="text-slate-500"> — {housingExtra}</span> : null}
                  </span>
                ) : (
                  "—"
                )
              }
            />
            <InfoRow label="Autres animaux" value={otherAnimalsText} />
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Types de garde</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {item.gardeTypes.length === 0 ? (
              <span className="text-xs text-slate-500">—</span>
            ) : (
              item.gardeTypes.map((g) => (
                <Badge key={g} tone="blue">
                  {labelForGardeType(g)}
                </Badge>
              ))
            )}
          </div>
        </div>

        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Tailles de chiens</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {item.dogSizes.length === 0 ? (
              <span className="text-xs text-slate-500">—</span>
            ) : (
              item.dogSizes.map((s) => (
                <Badge key={s} tone="emerald">
                  {labelForDogSize(s)}
                </Badge>
              ))
            )}
          </div>
        </div>
      </div>

      {item.allergies ? (
        <div className="mt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Allergies / remarques santé</p>
          <p className="mt-1 text-sm text-slate-800 whitespace-pre-wrap">{item.allergies}</p>
        </div>
      ) : null}
    </div>
  );
}

function ApplicationAvailabilityBlock({ item }: { item: ApplicationItem }) {
  const rows = availabilityToRows(item.availabilityStructured);
  const hasStructured = rows.some((r) => r.hasSlot);
  const hasLegacyText = Boolean(item.availabilityText && item.availabilityText.trim());

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold text-slate-700">Disponibilités</p>

      {hasStructured ? (
        <div className="mt-3 grid grid-cols-7 gap-1 text-center">
          {rows.map((row) => (
            <div
              key={row.day}
              className={
                "rounded-xl border px-1 py-2 text-[11px] " +
                (row.hasSlot
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : "border-slate-200 bg-white text-slate-400")
              }
            >
              <p className="text-[10px] font-semibold uppercase tracking-wide">{row.shortLabel}</p>
              <p className="mt-1 text-[10px] leading-tight">{row.description}</p>
            </div>
          ))}
        </div>
      ) : null}

      {hasLegacyText ? (
        <p className={(hasStructured ? "mt-3 " : "mt-2 ") + "text-sm text-slate-800 whitespace-pre-wrap"}>
          {item.availabilityText}
        </p>
      ) : hasStructured ? null : (
        <p className="mt-2 text-sm text-slate-500">—</p>
      )}
    </div>
  );
}

export default function AdminSitterApplicationsClient({ adminCode }: { adminCode?: string }) {
  const [items, setItems] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | AppStatus>("ALL");

  const router = useRouter();
  const searchParams = useSearchParams();
  const applicationIdFromUrl = searchParams.get("applicationId") ?? "";

  const filteredItems = useMemo(() => {
    const needle = searchTerm.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (!needle) return true;
      const haystack = `${item.firstName} ${item.lastName} ${item.city}`.toLowerCase();
      return haystack.includes(needle);
    });
  }, [items, searchTerm, statusFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: items.length };
    for (const it of items) {
      counts[it.status] = (counts[it.status] ?? 0) + 1;
    }
    return counts as Record<"ALL" | AppStatus, number>;
  }, [items]);

  const [selectedId, setSelectedId] = useState<string>(applicationIdFromUrl);
  useEffect(() => {
    if (applicationIdFromUrl && applicationIdFromUrl !== selectedId) {
      setSelectedId(applicationIdFromUrl);
    }
  }, [applicationIdFromUrl, selectedId]);
  const selected = useMemo(() => filteredItems.find((i) => i.id === selectedId) ?? items.find((i) => i.id === selectedId) ?? filteredItems[0] ?? null, [filteredItems, items, selectedId]);

  const [actionLoading, setActionLoading] = useState(false);
  const [contractActionLoading, setContractActionLoading] = useState(false);
  const [calendlySaveLoading, setCalendlySaveLoading] = useState(false);
  const [interviewEmailLoading, setInterviewEmailLoading] = useState(false);
  const [activationCodeLoading, setActivationCodeLoading] = useState(false);
  const [calendlyDraft, setCalendlyDraft] = useState<string>("");
  const [success, setSuccess] = useState<string | null>(null);
  const [contractDetails, setContractDetails] = useState<ContractDetailsPayload | null>(null);
  const [contractDetailsLoading, setContractDetailsLoading] = useState(false);
  const [contractModal, setContractModal] = useState<
    null | {
      kind: "current" | "signed";
      title: string;
      version: string;
      content: string;
      meta?: ReactNode;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors ContractDetailsPayload.profile.contractSnapshot (same legacy JSON blob).
      contractSnapshot?: any;
      contractSignerName?: string | null;
      contractSignedAt?: string | null;
      signedAtHuman?: string | null;
    }
  >(null);

  function adminHeaders(base?: Record<string, string>) {
    return {
      ...(base ?? {}),
      ...(adminCode ? { "x-admin-code": adminCode } : {}),
    };
  }

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/pilot-sitter-applications", {
        method: "GET",
        headers: adminHeaders(),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic JSON shape; narrowed by runtime checks below.
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok || !Array.isArray(payload?.applications)) {
        setError("Impossible de charger les candidatures.");
        return;
      }
      const rows = payload.applications as ApplicationItem[];
      setItems(rows);
      if (rows.length && !selectedId) setSelectedId(rows[0].id);
    } catch {
      setError("Impossible de charger les candidatures.");
    } finally {
      setLoading(false);
    }
  }

  async function sendContract() {
    const item = selected;
    const canSend = Boolean(item) && (item.status === "ACCEPTED" || item.status === "ACTIVATED");
    if (!canSend || contractActionLoading) return;
    setContractActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/pilot-sitter-applications/contract", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id: selected.id }),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic JSON shape; narrowed by runtime checks below.
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok) {
        if (payload?.error === "CONTRACT_LINK_INVALID_STATE") {
          setError("Renvoi impossible: état du profil incohérent pour la gestion du contrat.");
        } else {
          setError("Impossible d’envoyer le contrat.");
        }
        return;
      }
      setSuccess("Contrat envoyé avec lien sécurisé.");
      await load();
    } catch {
      setError("Impossible d’envoyer le contrat.");
    } finally {
      setContractActionLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setCalendlyDraft(selected?.calendlyLink ?? "");
  }, [selected?.id, selected?.calendlyLink]);

  function isHttpUrl(value: string) {
    try {
      const u = new URL(value);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }

  async function saveCalendlyLink() {
    if (!selected || calendlySaveLoading) return;
    const trimmed = calendlyDraft.trim();
    if (trimmed && !isHttpUrl(trimmed)) {
      setError("Lien Calendly invalide (URL http(s) requise).");
      return;
    }
    setCalendlySaveLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/pilot-sitter-applications/calendly-link", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id: selected.id, calendlyLink: trimmed }),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic JSON shape; narrowed by runtime checks below.
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok) {
        setError("Impossible d’enregistrer le lien Calendly.");
        return;
      }
      setSuccess(trimmed ? "Lien Calendly enregistré." : "Lien Calendly supprimé.");
      await load();
    } catch {
      setError("Impossible d’enregistrer le lien Calendly.");
    } finally {
      setCalendlySaveLoading(false);
    }
  }

  async function sendInterviewEmailAction() {
    if (!selected || interviewEmailLoading) return;
    const trimmed = (selected.calendlyLink ?? "").trim();
    if (!trimmed) {
      setError("Ajoute d’abord un lien Calendly à cette candidature.");
      return;
    }
    if (selected.acceptedEmailSentAt) {
      const sentAt = formatFrCh(selected.acceptedEmailSentAt);
      const source = selected.acceptedEmailSource === "n8n" ? "automatiquement (n8n)" : "manuellement";
      const ok = window.confirm(
        `Un email d’entretien a déjà été envoyé ${source} le ${sentAt}.\nRenvoyer quand même ?`,
      );
      if (!ok) return;
    }
    setInterviewEmailLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/pilot-sitter-applications/send-interview-email", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id: selected.id }),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic JSON shape; narrowed by runtime checks below.
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok) {
        if (payload?.error === "MISSING_CALENDLY_LINK") {
          setError("Lien Calendly manquant sur la candidature.");
        } else {
          setError("Impossible d’envoyer l’email d’entretien.");
        }
        return;
      }
      setSuccess("Email d’entretien envoyé (lien Calendly).");
      await load();
    } catch {
      setError("Impossible d’envoyer l’email d’entretien.");
    } finally {
      setInterviewEmailLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    if (!selected?.id) {
      setContractDetails(null);
      return;
    }

    void (async () => {
      try {
        setContractDetailsLoading(true);
        const res = await fetch(`/api/admin/pilot-sitter-applications/contract-details?applicationId=${encodeURIComponent(selected.id)}`, {
          method: "GET",
          headers: adminHeaders(),
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => null)) as ContractDetailsPayload | null;
        if (cancelled) return;
        if (!res.ok || !payload?.ok) {
          setContractDetails({ ok: false, error: payload?.error || "LOAD_FAILED" });
          return;
        }
        setContractDetails(payload);
      } catch {
        if (cancelled) return;
        setContractDetails({ ok: false, error: "LOAD_FAILED" });
      } finally {
        if (!cancelled) setContractDetailsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `adminHeaders` is a stable closure over `adminCode`; adding it would cause needless re-runs.
  }, [adminCode, selected?.id]);

  function openCurrentContractPreview() {
    const current = contractDetails?.currentContract;
    const title = (current?.title ?? "").trim() || "Contrat dogsitter";
    const version = (current?.version ?? "").trim() || "—";
    const content = (current?.content ?? "").trim() || "";
    setContractModal({ kind: "current", title, version, content });
  }

  async function openSignedContractSnapshot() {
    // Refresh once at click-time so we don't depend on a potentially stale payload.
    let latest = contractDetails;
    if (selected?.id) {
      try {
        const res = await fetch(`/api/admin/pilot-sitter-applications/contract-details?applicationId=${encodeURIComponent(selected.id)}`, {
          method: "GET",
          headers: adminHeaders(),
          cache: "no-store",
        });
        const payload = (await res.json().catch(() => null)) as ContractDetailsPayload | null;
        if (res.ok && payload?.ok) {
          latest = payload;
          setContractDetails(payload);
        }
      } catch {
        // keep latest (best effort)
      }
    }

    const profile = latest?.profile ?? null;
    const snap = profile?.contractSnapshot;
    const title = typeof snap?.title === "string" && snap.title.trim() ? snap.title.trim() : "Contrat signé";
    const version =
      (typeof snap?.version === "string" && snap.version.trim()) || (typeof profile?.contractVersion === "string" && profile.contractVersion.trim())
        ? (snap?.version as string) || (profile?.contractVersion as string)
        : "—";
    const content =
      typeof snap?.content === "string" ? snap.content : typeof latest?.currentContract?.content === "string" ? latest.currentContract.content : "";
    const signerName = typeof snap?.signerName === "string" ? snap.signerName : typeof profile?.contractSignerName === "string" ? profile.contractSignerName : null;
    const signedAt = typeof snap?.signedAt === "string" ? snap.signedAt : typeof profile?.contractSignedAt === "string" ? profile.contractSignedAt : null;
    const signedAtHuman = signedAt ? formatSignedAtHumanFrCh(signedAt) : null;

    const meta =
      signerName && signedAtHuman ? (
        <div className="mt-2 whitespace-pre-line text-xs text-slate-600">
          {`Signé électroniquement par:\n${signerName}\n\nLe: ${signedAtHuman}`}
        </div>
      ) : null;

    setContractModal({
      kind: "signed",
      title,
      version,
      content,
      meta,
      contractSnapshot: snap ?? latest?.profile?.contractSnapshot ?? null,
      contractSignerName: signerName,
      contractSignedAt: signedAt,
      signedAtHuman,
    });
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function downloadSignedContractPdf() {
    if (!contractModal || contractModal.kind !== "signed") return;
    if (!contractModal.contractSnapshot || !contractModal.contractSignerName || !contractModal.contractSignedAt) return;

    try {
      const res = await fetch("/api/contract/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contractSnapshot: contractModal.contractSnapshot,
          contractSignerName: contractModal.contractSignerName,
          contractSignedAt: contractModal.contractSignedAt,
          contractVersion: contractModal.version,
        }),
      });

      const contentType = res.headers.get("content-type") ?? "";
      if (contentType.includes("application/pdf")) {
        const blob = await res.blob();
        downloadBlob(blob, `dogshift-contrat-signe-${contractModal.version}.pdf`);
        return;
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic JSON shape; narrowed by runtime checks below.
      const data = (await res.json().catch(() => null)) as any;
      const pdfUrl = data?.pdfUrl;
      if (!pdfUrl) return;
      const pdfRes = await fetch(pdfUrl);
      const blob = await pdfRes.blob();
      downloadBlob(blob, `dogshift-contrat-signe-${contractModal.version}.pdf`);
    } catch {
      // ignore
    }
  }

  async function sendActivationCode() {
    const item = selected;
    if (!item || activationCodeLoading) return;
    if (!item.linkedUserId) {
      setError("Pas de compte lié à cette candidature. Le profil sitter doit exister en base.");
      return;
    }
    const canSend = item.sitterLifecycleStatus === "contract_signed" || item.sitterLifecycleStatus === "activated";
    if (!canSend) {
      setError("Le code d'activation n'est disponible qu'après signature du contrat.");
      return;
    }
    setActivationCodeLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/admin/sitters/${item.linkedUserId}/actions`, {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ action: "send_activation_code" }),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic JSON shape
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok) {
        setError("Impossible d'envoyer le code d'activation.");
        return;
      }
      setSuccess("Code d'activation envoyé par email.");
    } catch {
      setError("Impossible d'envoyer le code d'activation.");
    } finally {
      setActivationCodeLoading(false);
    }
  }

  async function setStatus(next: AppStatus) {
    if (!selected) return;
    if (actionLoading) return;
    setActionLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/admin/pilot-sitter-applications/status", {
        method: "POST",
        headers: adminHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ id: selected.id, status: next }),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic JSON shape; narrowed by runtime checks below.
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || !payload?.ok) {
        setError("Impossible d’enregistrer le statut.");
        return;
      }
      await load();
    } catch {
      setError("Impossible d’enregistrer le statut.");
    } finally {
      setActionLoading(false);
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // ignore
    }
  }

  return (
    <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.20)] sm:p-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Candidatures (phase pilote)</h2>
          <p className="mt-2 text-sm text-slate-600">Sélection manuelle. Statut modifiable.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
        >
          Rafraîchir
        </button>
      </div>

      {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}
      {success ? <p className="mt-4 text-sm font-medium text-emerald-700">{success}</p> : null}

      {loading ? (
        <p className="mt-4 text-sm text-slate-600">Chargement…</p>
      ) : items.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="text-sm font-semibold text-slate-900">Aucune candidature</p>
          <p className="mt-2 text-sm text-slate-600">Tout est à jour.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[320px_1fr]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold text-slate-600">Liste</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(
                [
                  { key: "ALL" as const, label: "Toutes" },
                  { key: "PENDING" as const, label: "En attente" },
                  { key: "CONTACTED" as const, label: "Contactées" },
                  { key: "ACCEPTED" as const, label: "Acceptées" },
                  { key: "ACTIVATED" as const, label: "Activées" },
                  { key: "REJECTED" as const, label: "Refusées" },
                ] as const
              ).map((opt) => {
                const active = statusFilter === opt.key;
                const count = statusCounts[opt.key] ?? 0;
                return (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setStatusFilter(opt.key)}
                    className={
                      "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold transition " +
                      (active
                        ? "border-[var(--dogshift-blue)] bg-white text-[var(--dogshift-blue)]"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")
                    }
                  >
                    <span>{opt.label}</span>
                    <span className={"rounded-full px-2 py-0.5 text-[11px] " + (active ? "bg-[color-mix(in_srgb,var(--dogshift-blue),white_86%)]" : "bg-slate-100")}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="relative mt-3">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-slate-400" aria-hidden="true">
                <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14.1667 14.1667L17.5 17.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <circle cx="8.75" cy="8.75" r="5.83333" stroke="currentColor" strokeWidth="1.8" />
                </svg>
              </span>
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Rechercher par nom ou ville…"
                className="h-11 w-full rounded-2xl border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
              />
            </div>
            <div className="mt-3 grid gap-2">
              {filteredItems.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-4 py-5 text-sm font-medium text-slate-600">
                  Aucun candidat trouvé
                </div>
              ) : filteredItems.map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(a.id);
                    const next = new URLSearchParams(searchParams.toString());
                    next.set("applicationId", a.id);
                    void router.push(`/admin/sitters/applications?${next.toString()}`);
                  }}
                  className={
                    "w-full rounded-2xl border px-4 py-3 text-left transition " +
                    (a.id === selectedId ? "border-[var(--dogshift-blue)] bg-white" : "border-slate-200 bg-white hover:bg-slate-50")
                  }
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{a.firstName} {a.lastName}</p>
                    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusTone(a.status)}`}>{statusLabel(a.status)}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600">{a.city}</p>
                  <p className="mt-1 text-xs text-slate-500">{formatFrCh(a.createdAt)}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5">
            {selected ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-900">{selected.firstName} {selected.lastName}</p>
                    <p className="mt-1 text-sm text-slate-600">{selected.city}</p>
                    <div className="mt-3 grid gap-1 text-sm text-slate-700">
                      <button type="button" onClick={() => void copy(selected.email)} className="text-left font-semibold text-[var(--dogshift-blue)]">{selected.email}</button>
                      <button type="button" onClick={() => void copy(selected.phone)} className="text-left font-semibold text-[var(--dogshift-blue)]">{selected.phone}</button>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${statusTone(selected.status)}`}>{statusLabel(selected.status)}</span>
                    <p className="text-xs text-slate-500">Reçu: {formatFrCh(selected.createdAt)}</p>
                    <p className="text-xs text-slate-500">{contractStatusLabel(selected)}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4">
                  <ApplicationProfileDetails item={selected} />

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-700">Expérience</p>
                    <p className="mt-2 text-sm text-slate-800 whitespace-pre-wrap">{selected.experienceText}</p>
                    <p className="mt-2 text-xs text-slate-600">A déjà gardé des chiens: {selected.hasDogExperience ? "Oui" : "Non"}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold text-slate-700">Motivation</p>
                    <p className="mt-2 text-sm text-slate-800 whitespace-pre-wrap">{selected.motivationText}</p>
                  </div>

                  <ApplicationAvailabilityBlock item={selected} />

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Lien Calendly (entretien)</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Envoyé au candidat quand tu cliques sur « Accepté ». Un lien unique par candidature.
                        </p>
                      </div>
                      {selected.acceptedEmailSentAt ? (
                        <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-900">
                          Email envoyé le {formatFrCh(selected.acceptedEmailSentAt)}
                          {selected.acceptedEmailSource ? ` (${selected.acceptedEmailSource})` : ""}
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                          Aucun email envoyé
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <input
                        type="url"
                        value={calendlyDraft}
                        onChange={(e) => setCalendlyDraft(e.target.value)}
                        placeholder="https://calendly.com/ton-compte/entretien-dogshift"
                        className="h-11 min-w-0 flex-1 rounded-2xl border border-slate-300 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--dogshift-blue)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_80%)]"
                      />
                      <button
                        type="button"
                        disabled={calendlySaveLoading || (calendlyDraft.trim() === (selected.calendlyLink ?? "").trim())}
                        onClick={() => void saveCalendlyLink()}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {calendlySaveLoading ? "Enregistrement…" : "Enregistrer"}
                      </button>
                      <button
                        type="button"
                        disabled={interviewEmailLoading || !(selected.calendlyLink ?? "").trim()}
                        onClick={() => void sendInterviewEmailAction()}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {interviewEmailLoading ? "Envoi…" : selected.acceptedEmailSentAt ? "Renvoyer l’email" : "Envoyer l’email"}
                      </button>
                    </div>
                    {!(selected.calendlyLink ?? "").trim() ? (
                      <p className="mt-2 text-xs text-amber-700">
                        Ajoute un lien avant de cliquer sur « Accepté » — sinon l’email ne partira pas.
                      </p>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold text-slate-700">Statut</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => void setStatus("PENDING")}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        En attente
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => void setStatus("CONTACTED")}
                        className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
                      >
                        Contacté
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => void setStatus("ACCEPTED")}
                        className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
                      >
                        Accepté
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => void setStatus("ACTIVATED")}
                        className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:opacity-60"
                      >
                        Activé
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading}
                        onClick={() => void setStatus("REJECTED")}
                        className="inline-flex items-center justify-center rounded-2xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:opacity-60"
                      >
                        Refusé
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Gestion du contrat</p>
                        <p className="mt-1 text-sm text-slate-600">Prévisualisation du contrat actuel + accès au contrat signé.</p>
                      </div>
                      <button
                        type="button"
                        disabled={(selected.status !== "ACCEPTED" && selected.status !== "ACTIVATED") || contractActionLoading}
                        onClick={() => void sendContract()}
                        className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {contractActionLoading ? "En cours…" : selected.contractAccessTokenIssuedAt ? "Renvoyer le contrat" : "Envoyer le contrat"}
                      </button>
                    </div>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-slate-700">Contrat actuel</p>
                            <p className="mt-1 text-xs text-slate-500">
                              Version : {contractDetails?.currentContract?.version ?? "—"}
                              {contractDetailsLoading ? " (chargement…)" : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={contractDetailsLoading || !(contractDetails?.currentContract?.content || "").trim()}
                            onClick={() => openCurrentContractPreview()}
                            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Prévisualiser le contrat
                          </button>
                        </div>
                        <p className="mt-3 text-xs text-slate-600">
                          Le contenu affiché correspond au modèle actuellement actif (celui qui serait envoyé aujourd’hui).
                        </p>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-slate-700">Contrats envoyés / signés</p>
                            <p className="mt-1 text-xs text-slate-500">Statut : {contractStatusLabel(selected)}.</p>
                          </div>
                          <button
                            type="button"
                            disabled={
                              !contractDetails?.profile?.contractSignedAt &&
                              contractDetails?.profile?.lifecycleStatus !== "contract_signed"
                            }
                            onClick={() => void openSignedContractSnapshot()}
                            className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Voir le contrat signé
                          </button>
                        </div>

                        <div className="mt-3 grid gap-1 text-xs text-slate-600">
                          {selected.sitterLifecycleStatus ? <p>Lifecycle sitter : {selected.sitterLifecycleStatus}.</p> : null}
                          {selected.contractAccessTokenIssuedAt ? <p>Lien envoyé le : {formatFrCh(selected.contractAccessTokenIssuedAt)}.</p> : null}
                          {selected.contractAccessTokenExpiresAt ? <p>Expiration prévue le : {formatFrCh(selected.contractAccessTokenExpiresAt)}.</p> : null}
                          {selected.contractSignedAt ? <p>Contrat signé le : {formatFrCh(selected.contractSignedAt)}.</p> : null}
                          {selected.status !== "ACCEPTED" && selected.status !== "ACTIVATED" ? (
                            <p>Le contrat est disponible après acceptation ou activation de la candidature.</p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Code d'activation</p>
                        <p className="mt-1 text-xs text-slate-600">
                          Génère un nouveau code et l'envoie par email au sitter. Disponible après signature du contrat.
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={
                          activationCodeLoading ||
                          !selected.linkedUserId ||
                          (selected.sitterLifecycleStatus !== "contract_signed" && selected.sitterLifecycleStatus !== "activated")
                        }
                        onClick={() => void sendActivationCode()}
                        className="inline-flex items-center justify-center rounded-2xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {activationCodeLoading ? "En cours…" : "Envoyer code d'activation"}
                      </button>
                    </div>
                    {!selected.linkedUserId ? (
                      <p className="mt-2 text-xs text-slate-500">Pas de profil sitter lié à cette candidature.</p>
                    ) : selected.sitterLifecycleStatus !== "contract_signed" && selected.sitterLifecycleStatus !== "activated" ? (
                      <p className="mt-2 text-xs text-slate-500">Disponible une fois le contrat signé.</p>
                    ) : null}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <p className="text-xs font-semibold text-slate-700">Tracking (si dispo)</p>
                    <div className="mt-2 grid gap-1 text-xs text-slate-600">
                      <p>utm_source: {selected.utmSource ?? "—"}</p>
                      <p>utm_campaign: {selected.utmCampaign ?? "—"}</p>
                      <p>referrer: {selected.referrer ?? "—"}</p>
                    </div>
                  </div>

                  <AdminNotesPanel targetType="PILOT_SITTER_APPLICATION" targetId={selected.id} title="Notes internes – candidature" />
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}

      {contractModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-46px_rgba(2,6,23,0.45)]">
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-600">{contractModal.kind === "signed" && contractModal.contractSignerName ? "Contrat signé" : "Contrat dogsitter"}</p>
                {contractModal.kind === "signed" && contractModal.contractSignerName && contractModal.signedAtHuman ? (
                  <p className="mt-1 text-sm text-slate-600">{`Signé le ${contractModal.signedAtHuman}`}</p>
                ) : null}
                <p className="mt-1 truncate text-base font-semibold text-slate-900">{contractModal.title}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1">Version : {contractModal.version}</span>
                  {contractModal.kind === "signed" ? (
                    <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 font-semibold text-emerald-900">
                      Snapshot signé (figé)
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 font-semibold text-sky-900">
                      Contrat actuel (prévisualisation)
                    </span>
                  )}
                </div>
                {contractModal.meta ?? null}
              </div>
              <button
                type="button"
                onClick={() => setContractModal(null)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-slate-300 bg-white text-slate-900 shadow-sm transition hover:bg-slate-50"
                aria-label="Fermer"
              >
                ✕
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                <p className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{contractModal.content}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2 border-t border-slate-200 px-6 py-4">
              {contractModal.kind === "signed" && contractModal.contractSignerName && contractModal.contractSignedAt && contractModal.contractSnapshot ? (
                <button
                  type="button"
                  onClick={() => void downloadSignedContractPdf()}
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
                >
                  Télécharger le contrat signé (PDF)
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setContractModal(null)}
                className="inline-flex items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
