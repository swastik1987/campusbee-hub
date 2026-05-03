# CampusBee v2 — Phased Implementation Plan

> Companion to `CLAUDE.md` (v2). Sequenced phases for migrating CampusBee from apartment-scoped marketplace to location-based, subscription-tiered, AI-moderated marketplace.
> Each phase ends in a deployable, demo-able state. Phases that can run in parallel are marked.

---

## Guiding principles

1. **Wipe-and-rebuild on a feature branch.** Cut a branch `v2/baseline`. Archive existing migrations, write new `001_baseline_v2.sql`, run on a fresh Supabase project (or branch DB). Old `main` stays operational until v2 is feature-complete.
2. **Schema first, then RLS, then hooks, then UI.** Every phase respects this order so backend never lags frontend.
3. **One migration per logical concern.** Keep migrations small enough to roll back individually.
4. **Type generation after every migration.** Run `supabase gen types typescript --linked > src/integrations/supabase/types.ts` so hooks compile.
5. **Demo at the end of every phase.** No phase merges until it's demoable.

---

## Pre-work (Day 0) — *complete*

- [x] Create branch `v2/baseline` off `main`.
- [x] **Decision: keep the existing Supabase project** and wipe its `public` schema rather than spinning up a new one. Auth users, storage schema, realtime stay intact.
- [x] Move v1 migrations → `supabase/migrations/_archive_v1/`.
- [x] Add `000_wipe_v1.sql` — atomic `DROP SCHEMA public CASCADE` + restore grants + wipe v1 storage buckets/objects + clear v1 storage policies. Runs once at the start of Phase 1.
- [x] Update `CLAUDE.md` and write this plan.
- [x] Add `.env.example` documenting client + edge-function secrets.
- [ ] **User action: take a Supabase Dashboard backup before running `000_wipe_v1.sql`.** Wipe is irreversible.
- [ ] **User action: provision API keys & set Supabase secrets:**
  - `VITE_MAPPLS_API_KEY` (client) + `MAPPLS_REST_KEY` (secret) — mappls.com
  - `SIGHTENGINE_API_USER`, `SIGHTENGINE_API_SECRET` — sightengine.com
  - `GEMINI_API_KEY` — aistudio.google.com (Gemini API, free tier — used for text moderation via `gemini-2.0-flash`)
  - Set via `supabase secrets set KEY=VALUE` for the existing project.

**Exit criteria:** branch in place, wipe migration ready, secrets configured by user, backup taken.

---

## Phase 1 — Schema & RLS Baseline (Backend foundation)

**Goal:** existing Supabase project is wiped and reprovisioned with PostGIS, all v2 tables, RLS, helpers, seed categories. No frontend wired yet.

### Migrations (in order)
- `000_wipe_v1.sql` *(prepared in Phase 0; apply first)* — drops public schema cascade, restores grants, wipes v1 storage buckets + policies. Atomic. Take a backup first.
- `001_baseline_v2.sql`
  - `CREATE EXTENSION IF NOT EXISTS postgis;`
  - All v2 tables per `CLAUDE.md` § Database Schema
  - GIST indexes on every `geography(Point, 4326)` column
  - Compound indexes: `(category_id, status, moderation_status)` on classes, `(provider_id)` on subscriptions
- `002_rls_v2.sql`
  - Policies for every table — seeker-readable / provider-owned / platform-admin / premium-gated patterns
- `003_storage_buckets_v2.sql`
  - Buckets + storage RLS (public read on approved images, owner-write)
- `004_subscription_helpers.sql`
  - `is_premium(provider_id) RETURNS boolean` SECURITY DEFINER
  - `is_provider_owner(provider_id) RETURNS boolean`
  - `request_premium_upgrade(p_notes, p_payment_ref)` RPC
  - `approve_subscription_request(p_request_id, p_valid_until)` RPC (admin only)
  - `reject_subscription_request(p_request_id, p_reason)` RPC (admin only)
- `005_moderation_helpers.sql`
  - `submit_for_moderation(p_ref_type, p_ref_id, p_content, p_image_url)` RPC
  - `resolve_moderation_flag(p_flag_id, p_status, p_notes)` RPC
  - Trigger on `moderation_flags` UPDATE that mirrors status to source row
- `006_geo_helpers.sql`
  - `nearby_classes(p_seeker_loc geography, p_radius_km numeric, p_category_id uuid DEFAULT NULL)` RPC SECURITY DEFINER
  - `effective_class_location(p_class_id)` helper that returns class location or provider home if `is_home_based`
- `007_seed_categories.sql`
  - Reseed category tree (sports, dance, arts, academics, music, fitness, wellness + subcategories)

### Deliverables
- New DB provisioned and queryable
- All RLS policies pass `pgTAP` smoke tests (write a thin test suite in `supabase/tests/`)
- Type generation produces clean `types.ts`

### Verification
- `SELECT * FROM nearby_classes(ST_MakePoint(77.5946,12.9716)::geography, 5)` runs (returns empty until seeded)
- Manually insert one provider + one class → it appears in nearby_classes within 5 km
- RLS denies seeker writes to others' rows

**Exit criteria:** clean DB, all 7 migrations applied, RLS smoke tests green.

---

## Phase 2 — Auth, UserContext, Onboarding (Identity layer)

**Goal:** users can sign up, complete onboarding (with location picker), see persona switcher.

### Backend
- No new migrations.

### Integrations
- New folder `src/integrations/mappls/`
  - `client.ts` — loads MapMyIndia SDK script tag once, exposes `mappls` global
  - `geocode.ts` — `geocodeAddress(address)`, `reverseGeocode(lat, lng)` REST helpers

### Components
- `src/components/location/MapplsPicker.tsx` — autocomplete input + map preview, returns `{address, lat, lng}`
- `src/components/onboarding/StepLocation.tsx` — wraps MapplsPicker, writes to `users.seeker_home_address` and `seeker_home_location`
- Drop `src/components/onboarding/StepApartment.tsx`

### Pages
- `Auth.tsx` — unchanged
- `Onboarding.tsx` — replace StepApartment with StepLocation in step order

### Hooks
- `useOnboarding.ts` — drop apartment selection, add location update mutation
- `useLocation.ts` — NEW; `geocodeAddress`, `reverseGeocode`, `formatDistance`

### Context
- `UserContext.tsx` — remove `currentApartment`, `apartments`; add `providerSubscription` (lazy-loaded for providers)

### Routes
- Drop `/admin/*` routes from `App.tsx`
- Drop apartment-related guards

### Verification
- New user signs up → onboarding completes with location → `users.seeker_home_location` is non-null
- PersonaSwitcher only shows Seeker + (if applicable) Provider + Platform Admin

**Exit criteria:** new user reaches `/explore` with location set; legacy admin routes 404.

---

## Phase 3 — Content Moderation Pipeline (Cross-cutting)

**Goal:** the `ai-moderate-content` edge function is live; image and text submissions get auto-moderated; rejections notify owners.

### Edge Function
- `supabase/functions/ai-moderate-content/index.ts`
  - Input: `{ ref_type, ref_id, text?, image_url?, owner_user_id }`
  - **For images:** POST to Sightengine `models=nudity-2.1,offensive,weapon,recreational_drug`
    - Score thresholds: `≥ 0.85` → rejected · `0.45–0.85` → in_review · `< 0.45` → approved
  - **For text:** POST to Google Gemini API (`gemini-2.0-flash`)
    - Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=GEMINI_API_KEY`
    - Send text content as the prompt (no special system prompt needed — safety ratings are always returned)
    - Read `candidates[0].safetyRatings` from the response, checking four categories:
      - `HARM_CATEGORY_HARASSMENT`, `HARM_CATEGORY_HATE_SPEECH`, `HARM_CATEGORY_SEXUALLY_EXPLICIT`, `HARM_CATEGORY_DANGEROUS_CONTENT`
    - Probability thresholds: any `HIGH` → rejected · any `MEDIUM` → in_review · all `LOW/NEGLIGIBLE` → approved
    - Store raw `safetyRatings` array as `ai_categories` JSONB on the `moderation_flags` row
  - Apply thresholds (CLAUDE.md § Content Moderation Policy)
  - Insert `moderation_flags` row
  - Update source row's `moderation_status` (or status on `classes`/`featured_banners` etc.)
  - Send notification on `rejected` or `in_review`
  - Return `{ status, flagId? }`

### Hooks
- `useModeration.ts` — NEW
  - `useSubmitForModeration()` — calls the edge function
  - `usePendingModerationQueue()` (admin) — fetches `moderation_flags WHERE status = 'in_review'`
  - `useResolveModerationFlag()` (admin)

### Components
- `src/components/moderation/ModerationStatusBadge.tsx`
- `src/lib/moderation.ts` — client helpers (e.g., wraps image uploads, deletes from bucket on reject)

### Verification
- Submit a known-NSFW test image to bucket + moderate → row gets `rejected`, notification fires, image deleted
- Submit a benign image → `approved`
- Submit borderline image → `in_review` (queue visible at `/platform/moderation` once Phase 6 ships; for now query directly)

**Exit criteria:** edge function deployed, hooks compile, smoke tests pass on three image categories.

---

## Phase 4 — Provider: Self-Serve Onboarding & Class Creation with Location (Provider core)

**Goal:** a provider can self-onboard, create a class with a location picker, publish it (subject to moderation), and see it on `/explore`.

### Pages
- `BecomeProvider.tsx` — strip apartment selection step; on submit insert `service_providers` with `subscription_tier = 'basic'`; auto-approve, redirect to `/provider/dashboard`
- `CreateClass.tsx` — replace registration selection with:
  - `<MapplsPicker>` for class address
  - `is_home_based` checkbox ("I travel to students' homes — use my home as nearby search center")
  - On Publish: upload images → submit each to moderation → submit text fields to moderation → if all auto-approve, set `status = published`; else `status = draft` with status badges
- `ProviderClasses.tsx` — show moderation badge per class
- `ProviderClassDetail.tsx` — moderation state surfacing + edit-and-resubmit

### Hooks
- `useProvider.ts` — drop registration logic; add `useCreateClass`, `useUpdateClass` that include location columns
- `useClasses.ts` — replace apartment-scoped queries with provider-scoped or location-scoped
- Drop `useAdmin.ts` (apartment admin) — confirm no remaining references

### Routes
- Drop `/provider/terms` and `/provider/terms/:classId`
- All `/admin/*` routes already gone

### Verification
- New provider creates a class with a real Bengaluru address → it appears on `/explore` (Phase 5) when seeker is within radius
- Moderation flow: bad image → rejected, can be replaced
- "Home-based" class: nearby search uses provider home location

**Exit criteria:** end-to-end provider creates a published, moderated class.

---

## Phase 5 — Seeker: Nearby Discovery & Distance UX (Seeker core)

**Goal:** seekers see nearby classes ranked by distance, with a working radius slider and category filter.

### Components
- `src/components/location/RadiusSlider.tsx` — 1–50 km, default 5 km, persists to `localStorage`
- `src/components/location/DistanceBadge.tsx`
- Update `ClassCard.tsx` to show distance + (later) Featured tag

### Hooks
- `useSeeker.ts` — replace apartment queries with `useNearbyClasses({ radiusKm, categoryId })` calling `rpc('nearby_classes', ...)`
- `useExploreFilters` — radius, category, age, search query

### Pages
- `Explore.tsx` — wire RadiusSlider, render `nearby_classes` results, distance badges
- `ClassDetail.tsx` — show distance from seeker home, "Get Directions" deep link to Mappls
- `Profile.tsx` — surface "Update home location" flow using MapplsPicker

### Verification
- Move seeker location → nearby results change immediately
- Increase radius → result count grows
- Class with `is_home_based = true` shows distance from provider's home address

**Exit criteria:** seeker can discover and view a class created in Phase 4.

---

## Phase 6 — Platform Admin Expansion (Oversight surfaces)

**Goal:** platform admin has working UI for moderation queue, premium subscription requests, sponsored slots, and providers directory.

### Pages
- `/platform/moderation` — queue tabs (in_review / approved / rejected); inline approve/reject with reason
- `/platform/subscriptions` — request queue, active subscriptions, expired; approve sheet asks for valid_until + payment ref
- `/platform/sponsored` — request queue, active slots calendar view, approve sheet asks for valid_from/until + radius_km + center_location
- `/platform/providers` — directory, suspend/reinstate, mark verified
- Drop `/platform/apartments*` pages

### Hooks
- `usePlatformAdmin.ts` — expand:
  - `useModerationQueue()`, `useResolveFlag()`
  - `useSubscriptionRequests()`, `useApproveSubscription()`, `useRejectSubscription()`
  - `useSponsoredRequests()`, `useApproveSponsored()`, `useRejectSponsored()`
  - `usePlatformProviders()`, `useSuspendProvider()`, `useReinstateProvider()`, `useVerifyProvider()`

### Verification
- Phase 3's queued flag appears in `/platform/moderation` and can be resolved
- Provider's premium request (Phase 7) flows end-to-end through `/platform/subscriptions`

**Exit criteria:** every oversight workflow has UI and is reachable from PlatformDashboard quick links.

---

## Phase 7 — Provider Subscription UX & Premium Gating (Tiering)

**Goal:** providers can request Premium; Premium-gated features are visibly upsold.

### Components
- `src/components/subscription/PremiumGate.tsx` — wraps children; if not premium, shows blurred preview + upgrade CTA
- `src/components/subscription/UpgradeRequestSheet.tsx` — payment instructions + optional payment reference field

### Pages
- `/provider/subscription` — current tier, valid_until, request history, upgrade CTA
- `/provider/dashboard` — tier badge in header, upgrade banner if Basic
- `/provider/payments` — wrap "Collect via app" action in `<PremiumGate>`
- `/provider/analytics` — wrap "Competitor Analysis" / "Growth Insights" tabs in `<PremiumGate>`

### Hooks
- `useSubscription.ts` — NEW
  - `useMySubscription()`, `useRequestPremiumUpgrade()`
  - `useIsPremium()` shorthand bool
- `useAnalytics.ts` — split into Basic (free) and Premium queries; Premium queries early-return when not premium

### Edge function update
- `generate-payment-reminders` — only fires for batches owned by Premium providers (filter at query time)

### Verification
- Basic provider sees Premium upsells, can request upgrade → request lands in admin queue
- Admin approves → provider tier flips, gates unlock immediately

**Exit criteria:** end-to-end Basic→Premium upgrade demoable.

---

## Phase 8 — Sponsored Listings & Featured Banners (Premium monetization surfaces)

**Goal:** Premium providers can request sponsored slots; sponsored classes appear in seeker explore top-3.

### Pages
- `/provider/sponsored` — request a slot (pick class, radius, valid_from/until); see request status & active slots; banner image upload (moderated)

### Edge function
- `refresh-sponsored-slots` — cron every 15 min: expire past valid_until, recalculate `slot_position` per region (deterministic by requested_at)

### Hooks
- `useSponsored.ts` — NEW
  - `useMySponsoredRequests()`, `useRequestSponsored()`
  - `useSponsoredForLocation({ lat, lng })` — fetches active sponsored listings whose region contains seeker location
- `useFeaturedBanners.ts` — provider request + admin approval + display on home

### Frontend integration
- `Explore.tsx` — merge sponsored top-3 into nearby results with "Featured" badge
- Landing/Home — surface featured banners (if any in seeker's region)

### Verification
- Premium provider requests sponsored slot → admin approves → seeker in radius sees it as #1 with Featured badge
- Banner click increments `click_count`

**Exit criteria:** seekers see a sponsored class; provider sees impression/click counts.

---

## Phase 9 — Carryover Features Verification (Stabilization)

**Goal:** confirm all carryover features still work end-to-end on the v2 baseline.

### Audit checklist
- [ ] Family + family_members CRUD (no apartment binding regression)
- [ ] Family linking invite/accept (multi-adult)
- [ ] Demo / trial sessions: provider creates, seeker registers
- [ ] Class materials: upload, seeker sees in EnrollmentDetail
- [ ] Waitlist: full batch → join waitlist → slot opens → auto-offer → accept
- [ ] In-app chat: seeker↔provider conversation, realtime
- [ ] Reviews: post, provider replies
- [ ] Announcements: post, students see
- [ ] Attendance: today + past-date marking
- [ ] Notifications: bell badge, mark read

### Test artifacts
- Playwright e2e: one happy path per feature above

**Exit criteria:** every box ticked; no v1-only references remain in codebase (`grep` for `apartment_complexes`, `apartment_id`, `is_apartment_admin`, `provider_apartment_registrations`, `/admin/`).

---

## Phase 10 — Cutover, Performance, Polish (Launch)

**Goal:** v2 replaces v1 in production.

### Cutover
- [ ] Final RLS audit (Supabase advisors clean)
- [ ] Performance: `EXPLAIN ANALYZE` on `nearby_classes` for 10k-class load test, confirm GIST index usage
- [ ] Backup v1 DB, snapshot for archive
- [ ] Promote `v2/baseline` → `main`
- [ ] Switch Lovable to v2 Supabase project
- [ ] DNS / env swap

### Polish
- [ ] Empty states for fresh accounts
- [ ] Loading skeletons everywhere
- [ ] Mobile QA at 375 px on every page
- [ ] Lighthouse pass (perf/a11y)
- [ ] Update marketing pages (Landing) to reflect new value prop ("Find classes near you")

### Documentation
- [ ] Update `README.md`
- [ ] Producer's guide: how to upgrade to Premium, request sponsored slot
- [ ] Admin runbook: handling moderation queue, granting Premium, approving sponsored slots

**Exit criteria:** v2 in production, v1 decommissioned.

---

## Parallelization map

```
Day 0:       Pre-work
Phase 1:     Backend baseline (blocking — must finish first)
Phase 2:     Identity                ──┐
Phase 3:     Moderation pipeline    ──┼─ can run in parallel after Phase 1
                                      ─┘
Phase 4:     Provider core          (depends on 2, 3)
Phase 5:     Seeker discovery       (depends on 2, 4)
Phase 6:     Platform admin         (depends on 3; benefits from 4, 5 for testing)
Phase 7:     Subscription UX        (depends on 4, 6)
Phase 8:     Sponsored & featured   (depends on 5, 6, 7)
Phase 9:     Stabilization          (after 8)
Phase 10:    Cutover                (after 9)
```

Realistic timeline (single developer, full-time): **6–8 weeks**.
With a small team (2 frontend + 1 backend): **3–4 weeks**.

---

## Risks & Mitigations

| Risk | Mitigation |
|---|---|
| MapMyIndia SDK quotas / pricing surprises | Cache geocoding results in `geocode_cache` table; debounce autocomplete; monitor request count daily |
| PostGIS query performance at scale | GIST indexes; precompute region partitions if >100k classes; consider H3 hex bucketing in v3 |
| Moderation false positives frustrate providers | Borderline → in_review queue with platform admin override; clear inline error messages with appeal CTA |
| Premium provisioning bottleneck on platform admin | SLA target 24 h response; consider semi-automation in v3 (Razorpay webhook → auto-grant) |
| Provider abandons after rejection | Track rejected providers, send re-engagement notification with specific guidance |
| Existing v1 demo data lost on wipe | Snapshot v1 DB to backup project before cutover; keep `_archive_v1/` migrations indefinitely |
| Rebuilding RLS introduces leaks | pgTAP test suite covering every persona × every table read/write |

---

## Open questions to revisit per phase

- **Phase 2:** Should seekers be able to set multiple home locations (home + office)? *Defer to v3.*
- **Phase 4:** Should the home-based "I travel to students" mode have a max travel radius? *Add `provider_home_travel_radius_km` if user feedback demands.*
- **Phase 7:** Premium pricing — defer; manually grant during MVP, observe demand.
- **Phase 8:** How many sponsored slots per region? *Default 3 globally via `platform_settings`; tune from analytics.*
- **Phase 10:** Migrate v1 user accounts? *No — wipe & rebuild means new signups required. Send re-onboard email to v1 users with a reactivation link if needed.*
