export default function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={["block rounded-full border-[3px] border-current/20 border-t-current", className].filter(Boolean).join(" ")}
      style={{ animation: "spin 0.7s linear infinite" }}
      aria-hidden="true"
    />
  );
}
