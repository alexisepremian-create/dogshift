export default function AuthCenteredWrapper({ children }: { children: React.ReactNode }) {
  return (
    <main className="w-full">
      <div
        className={
          "flex w-full justify-center px-4" +
          " min-h-[calc(100vh-120px)]" +
          " pt-[clamp(8px,2vh,24px)]" +
          " pb-[clamp(24px,6vh,72px)]" +
          " items-start"
        }
      >
        {children}
      </div>
    </main>
  );
}
