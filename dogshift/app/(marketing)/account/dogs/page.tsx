"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { useUser } from "@clerk/nextjs";
import { Plus, Pencil, Trash2, Star, Dog, X, Check, Camera, Loader2 } from "lucide-react";
import PageLoader from "@/components/ui/PageLoader";
import { publicDogPhotoPath } from "@/lib/dogPhotoMedia";

type DogItem = {
  id: string;
  name: string;
  breed: string | null;
  birthYear: number | null;
  weightKg: number | null;
  medications: string | null;
  allergies: string | null;
  vetContact: string | null;
  behaviorNotes: string | null;
  feedingNotes: string | null;
  sitterInstructions: string | null;
  photoUrl: string | null;
  isDefault: boolean;
};

const EMPTY_FORM = {
  name: "",
  breed: "",
  birthYear: "",
  weightKg: "",
  medications: "",
  allergies: "",
  vetContact: "",
  behaviorNotes: "",
  feedingNotes: "",
  sitterInstructions: "",
  photoUrl: "",
};

const CURRENT_YEAR = new Date().getFullYear();

const INPUT =
  "w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[var(--dogshift-blue)] focus:ring-4 focus:ring-[color-mix(in_srgb,var(--dogshift-blue),transparent_85%)]";
const LABEL = "block text-xs font-semibold text-slate-600 mb-1";

function dogInitial(name: string) {
  return (name ?? "").trim().slice(0, 1).toUpperCase() || "?";
}

function DogAvatar({ photoUrl, name, size = 48 }: { photoUrl: string | null; name: string; size?: number }) {
  const src = photoUrl ? publicDogPhotoPath(photoUrl) : null;
  if (src) {
    return (
      <div className={`relative shrink-0 overflow-hidden rounded-2xl bg-slate-100`} style={{ width: size, height: size }}>
        <Image src={src} alt={name} fill className="object-cover" sizes={`${size}px`} />
      </div>
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-blue-100 font-semibold text-slate-600"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {dogInitial(name)}
    </div>
  );
}

export default function DogsPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [dogs, setDogs] = useState<DogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<DogItem | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    void fetchDogs();
  }, [isLoaded, isSignedIn]);

  async function fetchDogs() {
    setLoading(true);
    try {
      const res = await fetch("/api/account/dogs");
      const data = (await res.json()) as { dogs?: DogItem[] };
      setDogs(data.dogs ?? []);
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setForm(EMPTY_FORM);
    setEditing(null);
    setAdding(true);
    setError(null);
  }

  function openEdit(dog: DogItem) {
    setForm({
      name: dog.name,
      breed: dog.breed ?? "",
      birthYear: dog.birthYear ? String(dog.birthYear) : "",
      weightKg: dog.weightKg ? String(dog.weightKg) : "",
      medications: dog.medications ?? "",
      allergies: dog.allergies ?? "",
      vetContact: dog.vetContact ?? "",
      behaviorNotes: dog.behaviorNotes ?? "",
      feedingNotes: dog.feedingNotes ?? "",
      sitterInstructions: dog.sitterInstructions ?? "",
      photoUrl: dog.photoUrl ?? "",
    });
    setEditing(dog);
    setAdding(false);
    setError(null);
  }

  function closeForm() {
    setAdding(false);
    setEditing(null);
    setError(null);
  }

  function field(key: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [key]: e.target.value }));
  }

  async function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setError(null);
    try {
      // 1. Presign
      const presignRes = await fetch("/api/account/dogs/photo/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contentType: file.type, sizeBytes: file.size }),
      });
      const presignData = (await presignRes.json()) as { ok?: boolean; uploadUrl?: string; key?: string; error?: string };
      if (!presignRes.ok || !presignData.uploadUrl || !presignData.key) {
        setError(presignData.error ?? "Impossible d'uploader la photo.");
        return;
      }
      // 2. PUT to R2
      const uploadRes = await fetch(presignData.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!uploadRes.ok) {
        setError("Échec de l'upload. Réessaie.");
        return;
      }
      // 3. Store key in form state
      setForm((f) => ({ ...f, photoUrl: presignData.key! }));
    } finally {
      setUploadingPhoto(false);
      if (photoInputRef.current) photoInputRef.current.value = "";
    }
  }

  function buildPayload() {
    return {
      name: form.name.trim(),
      breed: form.breed.trim() || null,
      birthYear: form.birthYear ? parseInt(form.birthYear, 10) : null,
      weightKg: form.weightKg ? parseFloat(form.weightKg) : null,
      medications: form.medications.trim() || null,
      allergies: form.allergies.trim() || null,
      vetContact: form.vetContact.trim() || null,
      behaviorNotes: form.behaviorNotes.trim() || null,
      feedingNotes: form.feedingNotes.trim() || null,
      sitterInstructions: form.sitterInstructions.trim() || null,
      photoUrl: form.photoUrl.trim() || null,
    };
  }

  async function save() {
    if (!form.name.trim()) { setError("Le nom est requis."); return; }
    setSaving(true); setError(null);
    try {
      const payload = buildPayload();
      const res = editing
        ? await fetch(`/api/account/dogs/${editing.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/account/dogs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) {
        const d = (await res.json()) as { error?: string };
        setError(d.error ?? "Erreur serveur.");
        return;
      }
      await fetchDogs();
      closeForm();
    } finally {
      setSaving(false);
    }
  }

  async function setDefault(id: string) {
    await fetch(`/api/account/dogs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isDefault: true }) });
    await fetchDogs();
  }

  async function deleteDog(id: string) {
    await fetch(`/api/account/dogs/${id}`, { method: "DELETE" });
    setDeleteConfirm(null);
    await fetchDogs();
  }

  if (!isLoaded || !isSignedIn) return <PageLoader static />;

  return (
    <div className="grid gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Mes chiens</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gérez les profils de vos chiens. Ces informations seront visibles par vos dogsitters.
          </p>
        </div>
        {!adding && !editing && (
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 rounded-2xl bg-[var(--dogshift-blue)] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)]"
          >
            <Plus className="h-4 w-4" />
            Ajouter un chien
          </button>
        )}
      </div>

      {/* Form (add or edit) */}
      {(adding || editing) && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_18px_60px_-46px_rgba(2,6,23,0.16)] sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">
              {editing ? `Modifier ${editing.name}` : "Nouveau chien"}
            </h2>
            <button type="button" onClick={closeForm} className="rounded-lg p-1.5 text-slate-400 hover:text-slate-700">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Photo upload */}
          <div className="mb-6 flex items-center gap-4">
            <div className="relative">
              <DogAvatar photoUrl={form.photoUrl || null} name={form.name || "?"} size={72} />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[var(--dogshift-blue)] text-white shadow transition hover:bg-[var(--dogshift-blue-hover)] disabled:opacity-60"
                aria-label="Changer la photo"
              >
                {uploadingPhoto ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
              </button>
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">Photo de profil</p>
              <p className="text-xs text-slate-500">JPG, PNG ou WebP · max 8 Mo</p>
              {form.photoUrl && (
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, photoUrl: "" }))}
                  className="mt-1 text-xs text-rose-500 hover:text-rose-700"
                >
                  Supprimer la photo
                </button>
              )}
            </div>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => void handlePhotoChange(e)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className={LABEL} htmlFor="dog-name">Nom du chien *</label>
              <input id="dog-name" className={INPUT} value={form.name} onChange={field("name")} placeholder="Ex. Milo" maxLength={60} />
            </div>
            <div>
              <label className={LABEL} htmlFor="dog-breed">Race</label>
              <input id="dog-breed" className={INPUT} value={form.breed} onChange={field("breed")} placeholder="Ex. Labrador" maxLength={80} />
            </div>
            <div>
              <label className={LABEL} htmlFor="dog-weight">Poids (kg)</label>
              <input id="dog-weight" className={INPUT} type="number" min={0} max={200} step={0.1} value={form.weightKg} onChange={field("weightKg")} placeholder="Ex. 28" />
            </div>
            <div>
              <label className={LABEL} htmlFor="dog-year">Année de naissance</label>
              <input id="dog-year" className={INPUT} type="number" min={2000} max={CURRENT_YEAR} value={form.birthYear} onChange={field("birthYear")} placeholder={String(CURRENT_YEAR - 3)} />
            </div>
            <div>
              <label className={LABEL} htmlFor="dog-vet">Contact vétérinaire</label>
              <input id="dog-vet" className={INPUT} value={form.vetContact} onChange={field("vetContact")} placeholder="Dr. Martin — 079 000 00 00" maxLength={200} />
            </div>
            <div>
              <label className={LABEL} htmlFor="dog-allergies">Allergies</label>
              <input id="dog-allergies" className={INPUT} value={form.allergies} onChange={field("allergies")} placeholder="Ex. plumes de volaille" maxLength={500} />
            </div>
            <div>
              <label className={LABEL} htmlFor="dog-meds">Médicaments</label>
              <input id="dog-meds" className={INPUT} value={form.medications} onChange={field("medications")} placeholder="Ex. Frontline 1x/mois" maxLength={200} />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL} htmlFor="dog-behavior">Comportement & habitudes</label>
              <textarea id="dog-behavior" className={`${INPUT} resize-none`} rows={3} value={form.behaviorNotes} onChange={field("behaviorNotes")} placeholder="Peur des orages, adore jouer au fetch, câlin avec les enfants…" maxLength={1000} />
            </div>
            <div className="sm:col-span-2">
              <label className={LABEL} htmlFor="dog-feeding">Alimentation</label>
              <textarea id="dog-feeding" className={`${INPUT} resize-none`} rows={2} value={form.feedingNotes} onChange={field("feedingNotes")} placeholder="2x/jour, croquettes Royal Canin Maxi Adult, 300g par repas" maxLength={500} />
            </div>

            {/* Sitter instructions section */}
            <div className="sm:col-span-2">
              <div className="mb-3 mt-2 border-t border-slate-100 pt-4">
                <p className="text-sm font-semibold text-slate-900">Instructions pour le dogsitter</p>
                <p className="mt-0.5 text-xs text-slate-500">Consignes spécifiques : routine, interdictions, contacts d&apos;urgence, etc.</p>
              </div>
              <textarea
                id="dog-sitter-instructions"
                className={`${INPUT} resize-none`}
                rows={4}
                value={form.sitterInstructions}
                onChange={field("sitterInstructions")}
                placeholder="Ex. Ne pas le laisser seul plus de 3h. Toujours utiliser une laisse courte en rue. En cas d'urgence, appeler le Dr. Martin au 079 000 00 00 avant tout déplacement…"
                maxLength={2000}
              />
              <p className="mt-1 text-xs text-slate-400">{form.sitterInstructions.length}/2000</p>
            </div>
          </div>

          {error && <p className="mt-4 text-sm font-medium text-rose-600">{error}</p>}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || uploadingPhoto}
              className="inline-flex items-center gap-2 rounded-2xl bg-[var(--dogshift-blue)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)] disabled:opacity-60"
            >
              <Check className="h-4 w-4" />
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
            <button type="button" onClick={closeForm} className="rounded-2xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50">
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Dog list */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="animate-pulse rounded-3xl border border-slate-200 bg-white p-6">
              <div className="h-5 w-32 rounded bg-slate-100" />
              <div className="mt-2 h-4 w-48 rounded bg-slate-100" />
            </div>
          ))}
        </div>
      ) : dogs.length === 0 && !adding ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
          <Dog className="mx-auto h-10 w-10 text-slate-300" />
          <p className="mt-3 text-sm font-semibold text-slate-700">Aucun chien enregistré</p>
          <p className="mt-1 text-sm text-slate-500">Ajoutez votre chien pour que les sitters aient toutes les infos.</p>
          <button
            type="button"
            onClick={openAdd}
            className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[var(--dogshift-blue)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--dogshift-blue-hover)]"
          >
            <Plus className="h-4 w-4" />
            Ajouter mon chien
          </button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {dogs.map((dog) => (
            <div
              key={dog.id}
              className={`relative rounded-3xl border bg-white p-6 shadow-[0_4px_20px_-8px_rgba(2,6,23,0.08)] transition ${
                dog.isDefault ? "border-[var(--dogshift-blue)]/40 ring-2 ring-[var(--dogshift-blue)]/10" : "border-slate-200"
              }`}
            >
              {dog.isDefault && (
                <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-[var(--dogshift-blue)]/10 px-2.5 py-1 text-[11px] font-semibold text-[var(--dogshift-blue)]">
                  <Star className="h-3 w-3 fill-current" />
                  Principal
                </span>
              )}

              <div className="flex items-start gap-3">
                <DogAvatar photoUrl={dog.photoUrl} name={dog.name} size={48} />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">{dog.name}</p>
                  <p className="text-sm text-slate-500">
                    {[dog.breed, dog.birthYear ? `né en ${dog.birthYear}` : null, dog.weightKg ? `${dog.weightKg} kg` : null]
                      .filter(Boolean)
                      .join(" · ") || "Aucune info de base"}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-2 text-sm">
                {dog.medications && (
                  <div>
                    <span className="font-medium text-slate-700">Médicaments : </span>
                    <span className="text-slate-600">{dog.medications}</span>
                  </div>
                )}
                {dog.allergies && (
                  <div>
                    <span className="font-medium text-slate-700">Allergies : </span>
                    <span className="text-slate-600">{dog.allergies}</span>
                  </div>
                )}
                {dog.behaviorNotes && (
                  <div>
                    <span className="font-medium text-slate-700">Comportement : </span>
                    <span className="text-slate-600 line-clamp-2">{dog.behaviorNotes}</span>
                  </div>
                )}
                {dog.feedingNotes && (
                  <div>
                    <span className="font-medium text-slate-700">Alimentation : </span>
                    <span className="text-slate-600 line-clamp-1">{dog.feedingNotes}</span>
                  </div>
                )}
                {dog.sitterInstructions && (
                  <div>
                    <span className="font-medium text-slate-700">Instructions sitter : </span>
                    <span className="text-slate-600 line-clamp-2">{dog.sitterInstructions}</span>
                  </div>
                )}
                {dog.vetContact && (
                  <div>
                    <span className="font-medium text-slate-700">Vétérinaire : </span>
                    <span className="text-slate-600">{dog.vetContact}</span>
                  </div>
                )}
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => openEdit(dog)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Modifier
                </button>
                {!dog.isDefault && (
                  <button
                    type="button"
                    onClick={() => void setDefault(dog.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    <Star className="h-3.5 w-3.5" />
                    Définir comme principal
                  </button>
                )}
                {deleteConfirm === dog.id ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span className="text-xs text-slate-600">Confirmer ?</span>
                    <button
                      type="button"
                      onClick={() => void deleteDog(dog.id)}
                      className="rounded-xl bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700"
                    >
                      Supprimer
                    </button>
                    <button type="button" onClick={() => setDeleteConfirm(null)} className="text-xs text-slate-500 hover:text-slate-900">
                      Annuler
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(dog.id)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Supprimer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
