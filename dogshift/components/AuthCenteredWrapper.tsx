export default function AuthCenteredWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full items-center justify-center px-4 py-10">
      {children}
    </div>
  );
}
