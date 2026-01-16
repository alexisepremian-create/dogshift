import Spinner from "@/components/ui/Spinner";

export default function PageLoader({ label = "Chargement…" }: { label?: string }) {
  return (
    <div
      className="ds-viewport fixed inset-0 z-50 flex w-full items-center justify-center bg-white font-sans"
      aria-busy="true"
      aria-live="polite"
    >
      <div className="flex h-[120px] w-[260px] flex-col items-center justify-center text-center">
        <Spinner className="h-12 w-12 animate-spin motion-reduce:animate-none text-slate-700" />
        <p className="mt-4 h-5 text-sm font-medium leading-5 text-slate-700">{label}</p>
      </div>
    </div>
  );
}
