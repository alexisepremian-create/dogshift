import PaymentSuccessClient from "./PaymentSuccessClient";

export default async function PaymentSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = sp?.bookingId;
  const bookingId = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] ?? "" : "";

  return <PaymentSuccessClient bookingId={bookingId} />;
}
