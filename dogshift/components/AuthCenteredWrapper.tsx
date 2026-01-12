export default function AuthCenteredWrapper({ children }: { children: React.ReactNode }) {
  return (
    <main className="w-full">
      <div
        className={
          "flex w-full justify-center px-4" +
          " min-h-[calc(100vh-120px)]" +
          " pt-[clamp(16px,4vh,40px)]" +
          " pb-[clamp(24px,6vh,72px)]" +
          " items-start"
        }
      >
        {children}
      </div>
    </main>
  );
}
