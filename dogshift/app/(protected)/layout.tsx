import TransitOverlay from "@/components/TransitOverlay";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <TransitOverlay>{children}</TransitOverlay>;
}
