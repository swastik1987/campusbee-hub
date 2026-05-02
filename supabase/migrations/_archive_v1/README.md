# Archived v1 migrations

These 27 migration files were the schema lineage of CampusBee v1 (apartment-scoped marketplace, Apartment Admin role, registration-based commercial terms).

**They are NOT applied to fresh databases.** v2 starts from a clean baseline at `supabase/migrations/001_baseline_v2.sql` (created in Phase 1 of `IMPLEMENTATION_PLAN_V2.md`).

## Why kept?

1. **Historical reference** — debugging legacy data issues during the cutover window.
2. **Reverse-engineering** — if a v1 RLS policy or helper turns out to still be useful, lift it from here.
3. **Audit trail** — proves what was running in production prior to the v2 wipe.

## DO NOT

- Run these against a v2 database. The schema they create has been completely replaced.
- Add new migrations into this folder. New migrations belong in `supabase/migrations/`.
- Mix-and-match individual files into v2 — the v2 baseline is intentionally a clean slate.

## v1 → v2 mapping (for the curious)

| v1 concept | v2 replacement |
|---|---|
| `apartment_complexes`, `apartment_admins`, `provider_apartment_registrations` | Removed entirely. Provider has direct relationship to classes. |
| Apartment-scoped RLS (`get_user_apartment_ids()` etc.) | Location-based + subscription-aware RLS |
| Provider commercial terms on registration | Classes carry their own location; Premium tier replaces commission negotiation |
| `featured_class_listings` | Split into `sponsored_listings` + `featured_banners` |
| `admin_fee_payments`, `platform_fee_config` | Removed (track-only payments in MVP) |
| Apartment Admin role | Removed; oversight absorbed by Platform Admin |

See `CLAUDE.md` (root) for the v2 schema and `IMPLEMENTATION_PLAN_V2.md` for the cutover phases.
