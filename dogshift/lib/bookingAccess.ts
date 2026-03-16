export const BOOKING_ACCESS_COOKIE = "ds_booking_access";

export function getExpectedBookingAccessCode() {
  return (process.env.BOOKING_ACCESS_CODE ?? "").trim();
}

export function isBookingAccessCodeProtectionEnabled() {
  return getExpectedBookingAccessCode().length > 0;
}
