export default function BecomeSitterFormPreview() {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-40px_rgba(2,6,23,0.35)] sm:p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Aperçu du formulaire</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">Créer votre profil dogsitter</h3>
          <p className="mt-2 text-sm text-slate-600">Informations, services, disponibilité, tarifs.</p>
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="h-4 w-24 rounded bg-slate-200" />
          <div className="mt-2 h-11 w-full rounded-2xl border border-slate-300 bg-slate-50" />
        </div>
        <div>
          <div className="h-4 w-24 rounded bg-slate-200" />
          <div className="mt-2 h-11 w-full rounded-2xl border border-slate-300 bg-slate-50" />
        </div>
        <div className="sm:col-span-2">
          <div className="h-4 w-32 rounded bg-slate-200" />
          <div className="mt-2 h-24 w-full rounded-2xl border border-slate-300 bg-slate-50" />
        </div>
      </div>

      <div className="mt-8">
        <div className="h-4 w-40 rounded bg-slate-200" />
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="h-11 rounded-2xl border border-slate-300 bg-slate-50" />
          <div className="h-11 rounded-2xl border border-slate-300 bg-slate-50" />
          <div className="h-11 rounded-2xl border border-slate-300 bg-slate-50" />
        </div>
      </div>

      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <div className="h-11 w-full rounded-2xl bg-slate-900/10 sm:w-40" />
        <div className="h-11 w-full rounded-2xl bg-slate-900/5 sm:w-40" />
      </div>
    </div>
  );
}
