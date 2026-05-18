# Sitter not visible on map — Penthaz / small Swiss villages

**Status:** Mitigated (hardcoded fallback). Root cause not solved.

## Symptom

Sitter Sydney (city = Penthaz, NPA 1303) doesn't appear on the homepage
map or the search pages. Her marker is simply absent.

## Root cause

MapTiler's geocoder doesn't return valid coordinates for "Penthaz" (a
small Vaudois village, ~1500 inhabitants). `SitterProfile.lat` /
`SitterProfile.lng` stay `null` after the batch geocoding job runs.

## Fix (partial)

Hardcoded fallback in the lib root: if `lat`/`lng` is null and the city
matches "Penthaz" or NPA matches "1303", inject
`lat: 46.6297, lng: 6.5973` (centre de Penthaz, VD).

## Open

- Other small Swiss villages likely affected. Audit:
  `SELECT * FROM "SitterProfile" WHERE lat IS NULL AND published = true`
- Long-term fix: switch from hardcoded village fallback to an NPA-based
  reference table, or use a Swiss-native geocoding API (e.g.
  geo.admin.ch).

## How to recognize a regression / new occurrence

- A published sitter doesn't show up on the map
- Console / Sentry: no error, just silent missing marker
- Check the DB: `lat` and `lng` are NULL
- Try the batch geocoding (`POST /api/admin/geocode-sitters`) — if it
  doesn't fix it, MapTiler doesn't know the village

## Related commits

- `087e74c`, `0c9abf0` (branch `fix/map`)

## 🤖 Automated detection

```json
{
  "type": "sql",
  "query": "SELECT COUNT(*)::int AS value FROM \"SitterProfile\" WHERE \"published\" = true AND (\"lat\" IS NULL OR \"lng\" IS NULL)",
  "expect_max": 0,
  "auto_fix": { "complexity": "simple" }
}
```

Counts published sitters with missing GPS coordinates. Any > 0 means a new
sitter slipped through without geocoding. Auto-fix **simple** in principle
(re-run `POST /api/admin/geocode-sitters` for the affected rows), but for now
we mark the regression and let a human kick it off.
