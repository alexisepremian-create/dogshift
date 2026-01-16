import AdminHostClient from "./AdminHostClient";

export default async function AdminHostPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const expected = (process.env.HOST_ADMIN_CODE ?? "").trim();
  const supplied = typeof searchParams?.code === "string" ? searchParams.code.trim() : "";
  const authorized = expected.length > 0 && supplied.length > 0 && supplied === expected;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <main className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <div className="mx-auto max-w-4xl rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_18px_60px_-44px_rgba(2,6,23,0.25)] sm:p-10">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Admin – Host</h1>

          {!authorized ? (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">Accès protégé</p>
              <p className="mt-2 text-sm text-slate-600">
                Ajoutez <span className="font-mono text-xs">?code=...</span> (valeur définie dans{" "}
                <span className="font-mono text-xs">HOST_ADMIN_CODE</span>).
              </p>
            </div>
          ) : (
            <AdminHostClient />
          )}
        </div>
      </main>
    </div>
  );
}
