export default function AuthCenteredWrapper({ children }: { children: React.ReactNode }) {
  return (
    <main className="w-full">
      <div
        className={
          "flex w-full justify-center px-4" +
          " min-h-[calc(100vh-var(--header-h,96px))]" +
          " pt-[clamp(24px,6vh,72px)]" +
          " pb-[clamp(24px,6vh,72px)]" +
          " items-start"
        }
      >
        {children}
      </div>
    </main>
  );
}
