import ProtectedOverlay from "./ProtectedOverlay";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      {children}
      <ProtectedOverlay />
    </>
  );
}
