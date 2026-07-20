// Booking statuses that count as a REAL upcoming reservation on the owner
// dashboard's "Prochaine réservation" card. Unpaid drafts / abandoned Stripe
// checkouts (PENDING_PAYMENT, DRAFT) are NOT real reservations — showing one as
// the next reservation is incoherent (founder saw a fake upcoming booking from
// an unpaid test checkout). Only accepted/paid/confirmed bookings qualify.
export const DASHBOARD_UPCOMING_BOOKING_STATUSES = ["CONFIRMED", "PENDING_ACCEPTANCE", "PAID"] as const;
