import PaymentSuccessClient from "./PaymentSuccessClient";

export default function PaymentSuccessPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const raw = searchParams?.bookingId;
  const bookingId = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] ?? "" : "";

  return <PaymentSuccessClient bookingId={bookingId} />;
}
