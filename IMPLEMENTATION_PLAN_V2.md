# CampusBee v2 — Phased Implementation Plan

> Companion to `CLAUDE.md` (v2). Sequenced phases for migrating CampusBee from apartment-scoped marketplace to location-based, subscription-tiered, AI-moderated marketplace.
> Each phase ends in a deployable, demo-able state. Phases that can run in parallel are marked.

> **Status snapshot — May 17, 2026:**
> - ✅ Phases 0–7 complete.
> - ✅ Phase 11 (**Coaches for Premium academies**) complete pending manual migration application.
> - ✅ Phase 12 (**Admin-configurable subscription pricing + payment details + plan-based upgrade flow**) complete pending manual migration application + admin configuration.
> - 🟡 Phase 8 (sponsored listings & featured banners) ~30% — admin surface + read hook in place; provider-facing pages, cron edge fn, top-3 Explore merge, banner flow still missing.
> - 🟡 Phase 9 (stabilization) — partially trimmed; several cleanup items resolved, others still open (see Backlog § B).
> - ⛔ Phase 10 (cutover) blocked on Phase 8 + remaining backlog items.
>
> Three migrations and one edge function are **waiting on manual apply / deploy** before the latest features are live (Backlog § A). See "Recommended Next Steps" at the end of this file for the prioritised picklist.

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

## Phase 1 — Schema & RLS Baseline (Backend foundation) — ✅ COMPLETE

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

**Actual outcome:** Baseline 001–007 applied. Follow-on hotfix migrations 008–017 closed v1↔v2 compat gaps as they surfaced (UUID defaults, role grants, families RLS, family-members compat, categories RLS, moderation Gemini provider). See CLAUDE.md migrations table for the full chain.

---

## Phase 2 — Auth, UserContext, Onboarding (Identity layer) — ✅ COMPLETE

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

**Actual outcome:** Email + password is the primary auth path; Google + Apple OAuth added; magic links removed. `users.auth_id` is the FK to `auth.users.id`; internal `users.id` drives every other table. `ensure_self_family_member()` RPC (migration 026) seeds the seeker's self family-member row from inside StepLocation. PersonaSwitcher labels finalized as **Learner** / **Instructor** / **Platform Admin**. `/admin/*` redirects to `/`. `/home` removed entirely; `/` is the unified landing.

---

## Phase 3 — Content Moderation Pipeline (Cross-cutting) — ✅ COMPLETE

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

**Actual outcome:** `ai-moderate-content` edge function deployed. `moderation_flags.ref_type` extended to include `class_title`, `class_description`, `certification` (migration 20260513055502). Gemini provider supported in CHECK constraint (migration 017). Certification images run through the same pipeline. `ModerationStatusBadge` component used wherever moderation status is surfaced (class cards, certification gallery, provider class detail).

---

## Phase 4 — Provider: Self-Serve Onboarding & Class Creation with Location (Provider core) — ✅ COMPLETE

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

**Actual outcome (and additions):**
- CreateClass restructured into a **5-step flow**: Category → Details → Location (mandatory) → Schedule + social links → Review (commits: `faa97fe`, `6456b45`).
- `is_home_based` checkbox + `home_radius_km` column (migration 021) for "I travel to students" mode.
- Provider-initiated **Category Request workflow** (migrations 022, 028, L3, L5, L6 + `ProviderCategories` page + `CategoryRequestSheet` component + `useCategoryRequests` hook + `approve/reject/retag_category_request` RPCs). Classes can be created with `category_id = null` + `pending_category_request_id`; auto-backfilled on approval.
- **Certifications** for providers and trainers (migration 022 + `CertificationManager` + `useCertifications`) — max 5 each, image moderated, gallery on provider profile.
- **Batch grade multi-select** (`batches.grades TEXT[]`, migration L2 + `GradeMultiSelect` component).
- **Clock-style time picker** (`ClockTimePicker`) for batch start/end times.
- Edit-batch path validates duplicate batch names (PR #1–5).
- Seat-count trigger (migration 027) so the seat-availability badge is correct everywhere.
- Provider students page rewritten to use `get_provider_enrolled_student_names` RPC after the naive RLS approach (migration 018a) caused infinite recursion (fixed in 019b/020b).

---

## Phase 5 — Seeker: Nearby Discovery & Distance UX (Seeker core) — ✅ COMPLETE

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

**Actual outcome (and additions):**
- Explore redesigned: full-spectrum category pills (flex-wrap, collapse-on-scroll), unified search bar, distance badges per card (`97f6ee5`, `476baec`, `010c440`).
- **Trust markers** ("New", "Popular") with platform-settings thresholds (migration 025).
- Distance computed client-side from denormalized `location_lat`/`location_lng` (migration 021) — no server round-trip for ranking.
- **Public shareable class detail** page (`/class/:classId`) readable by anon (migration 024). Trust-marker tags rendered there too.
- "Get Directions" deep link to Mappls from ClassDetail.
- Landing page rebuilt with **live location detection + demo video modal** (`271c500`).
- Self-enrollment + stepper progress bar + full-screen success in EnrollFlow (`812757f`).

---

## Phase 6 — Platform Admin Expansion (Oversight surfaces) — ✅ COMPLETE

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

**Actual outcome:** `/platform/moderation`, `/subscriptions`, `/sponsored`, `/providers` shipped (`d976df3`). `/platform/categories` extended with the category-request review queue (`/platform/settings` added too for key-value platform settings). Admin RLS pattern hardened against the `users.id` vs `auth.uid()` confusion (migrations 20260512072126, 20260513051521, 20260513060707).

---

## Phase 7 — Provider Subscription UX & Premium Gating (Tiering) — ✅ COMPLETE

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

**Actual outcome:** `/provider/subscription`, `PremiumGate`, `UpgradeRequestSheet`, tier badge in dashboard, and Premium gates on Payments + Analytics shipped (`ea5803e`). `generate-payment-reminders` cron filters to Premium providers only.

**Subsequent evolution (May 2026):** The single-step UpgradeRequestSheet was replaced by a **3-step flow** (Benefits → Plan picker → Payment, commits `2b89af0`, `62e3957`). Plans + payment details are now admin-configurable rather than hardcoded — see **Phase 12** below for the full upgrade-flow rewrite. Phase 7's scope is unchanged; Phase 12 builds on top of it.

---

## Phase 8 — Sponsored Listings & Featured Banners (Premium monetization surfaces) — 🟡 IN PROGRESS (~30%)

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

**Current status (May 14, 2026):**
- ✅ `sponsored_listings` table + admin queue (`/platform/sponsored`) exist.
- ✅ `useActiveFeaturedListings` reads active sponsored rows by region.
- ❌ Provider-facing `/provider/sponsored` page **NOT yet built**.
- ❌ `refresh-sponsored-slots` cron edge function **NOT yet deployed**.
- ❌ Top-3 merge into Explore + "Featured" badge is **not wired** in the UI (only data path is ready).
- ❌ `featured_banners` table flow (request → approve → render on home) **NOT yet built**.
- ❌ `click_count` / `impression_count` increment instrumentation **missing**.

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

## Phase 11 — Coaches for Premium Academies (Team management) — ✅ COMPLETE (pending migration apply)

**Goal:** Academy providers on Premium can invite multiple Coaches by name + email. Each Coach logs in with that email, gets a "Coach" tag in the header, and accesses only the classes / batches they're assigned to (mark attendance, send payment reminders, manage their batches). Admins can do permanent re-assignments or temporary time-bound swaps with auto-revert.

### Schema (migration `20260515150000_coaches.sql`)
- `coaches` — auth-linkable team member rows per academy; one row per (academy, email); `status ∈ {invited, active, removed}`; `linked_user_id` set on first login.
- `coach_assignments` — `scope_type ∈ {class, batch}` with optional `is_temporary`, `original_coach_id`, `valid_from`, `valid_until`. UNIQUE partial index ensures one active coach per scope.
- `certifications.coach_id` added; values mirrored from `trainer_id` during a one-time backfill.
- `payment_reminder_log` — audit trail for the manual "Send Reminder" button (channel='in_app' for now).
- SECURITY DEFINER helpers: `current_coach_ids`, `current_academy_provider_ids`, `is_coach_of_class`, `is_coach_of_batch`, `is_academy_member`.
- RLS coach branch added (additively, OR'd with existing owner policies) to `classes`, `batches`, `attendance_records`, `payments`, `enrollments`, `class_materials`, `announcements`.
- RPCs: `invite_coach`, `assign_coach`, `end_coach_assignment`, `remove_coach`, `accept_coach_invites`, `revert_expired_coach_assignments`, `send_payment_reminder`.

### Companion migration
- `20260516120000_coach_student_names.sql` — widens `get_provider_student_names` RPC's security guard so a coach assigned to a batch can read student + seeker names for it. Defensively detects whether `is_coach_of_batch` exists before referencing it, so it's safe to apply before or after the main coaches migration.

### Frontend
- `src/pages/provider/CoachesManagement.tsx` (`/provider/coaches`) — invite by name + email, assign at class or batch scope, optional temporary swap with `valid_from` / `valid_until`, soft-remove with confirmation. Wrapped in `<PremiumGate>`.
- `src/hooks/useCoaches.ts` — `useCoaches`, `useCoachAssignments`, `useMyCoachAssignments`, `useInviteCoach`, `useAssignCoach`, `useEndCoachAssignment`, `useRemoveCoach`, `useSendPaymentReminder`, `useEffectiveProviderContext` (admin vs coach scope resolver — single source of truth for which provider_id to query against).
- `UserContext.tsx` extended with `coachProfiles`, `isCoach`; auto-runs `accept_coach_invites` on every session and fetches active coach memberships. Splash kept up until profile resolves to prevent AuthGuard bouncing /provider/* on first paint.
- `Header.tsx` shows a "Coach" badge next to the persona switcher when `isCoach && activePersona === 'provider'`.
- `PersonaSwitcher.tsx` lets coaches switch to the Instructor persona even without `is_provider`.
- `ProviderDashboard.tsx` and `ProviderStudents.tsx` use `useEffectiveProviderContext()` and apply UNION scope semantics for coaches; admin-only banners (subscription, certifications, category requests, FAB) hidden for coaches.
- `ProviderPayments.tsx` adds a manual "Send Reminder" button on every recorded-status row.
- `useSeeker.useProviderTrainers` + `useProviderProfile` now read from `coaches` (status='active') and remap `full_name → name` for back-compat. `useSeekerTrainerCertifications` queries `coach_id OR trainer_id`.

### Routes
- `/provider/coaches` (new) wrapped in `<PremiumGate>`; `/provider/trainers` 302s to it; `/provider/trainers-legacy` retains the original page for one release as a fallback.

### Edge function
- `revert-expired-coach-assignments` (`supabase/functions/...`) — calls the RPC of the same name. Schedule a daily cron (suggested `0 2 * * *` IST).

### Verification
- Academy admin invites a coach → email already maps to a learner → coach auto-activated on next login → Coach badge appears in header.
- Coach lands on /provider/dashboard → sees only assigned classes / students / payments / batches.
- Admin temporarily reassigns a batch to coach B from `2026-05-20` to `2026-05-22` → cron auto-reverts to coach A at midnight on 23rd.
- Admin OR coach taps "Send Reminder" on a pending payment → learner gets a notification; row inserted in `payment_reminder_log`.

**Exit criteria:** Premium academy can run their team end-to-end without admin intervention.

**Status (May 17, 2026):** All code committed and pushed (commits `3f04d5f` → `edf6983`, `8beeb17`, `84b4bac`). Migration `20260515150000_coaches.sql` and companion `20260516120000_coach_student_names.sql` must be applied manually in Supabase SQL editor. Edge function must be deployed + cron-scheduled.

---

## Phase 12 — Admin-Configurable Subscription Pricing & Payment Details — ✅ COMPLETE (pending migration apply + admin config)

**Goal:** Platform admin sets Monthly + Annual plan pricing (MRP + Selling Price + Active toggle) and the platform's UPI / bank payment details from `/platform/settings`. Instructors pick a plan in the upgrade sheet before paying; the request RPC validates the amount and `approve_subscription_request` derives the expiry date from the chosen plan.

### Schema (migration `20260517120000_subscription_plans.sql`)
- `subscription_plans` — one row per `billing_period ∈ {monthly, annual}` with `mrp`, `price`, `currency`, `duration_days`, `is_active`. Seeded inactive; admin enables after pricing. Public read on active rows; admin CRUD.
- `platform_payment_details` — singleton (CHECK + UNIQUE on a flag column). Columns: `upi_id`, `upi_qr_url`, `bank_account`, `ifsc`, `bank_name`, `account_holder`. Public read; admin CRUD.
- `provider_subscription_requests` extended with `billing_period TEXT CHECK IN ('monthly','annual')` + `amount_paid NUMERIC(10,2)`.
- `request_premium_upgrade` RPC rewritten to require + validate `billing_period` and `amount_paid` (±1 INR tolerance against the active plan's price). Drops the legacy 3-arg signature.
- `approve_subscription_request` RPC derives `subscription_valid_until = NOW() + (duration_days)` from the request's `billing_period` when admin doesn't pass an explicit override.

### Frontend
- `/platform/settings` gains two new admin cards:
  - **Subscription Pricing** — Monthly + Annual rows with MRP / Selling Price inputs, Active toggle, live discount % readout, per-row Save.
  - **Payment Details** — UPI ID (required), optional UPI QR upload (stored under `provider-media/platform/`), bank account, IFSC, bank name, account holder, single Save.
- `src/hooks/usePlatformAdmin.ts` — new hooks: `useAllSubscriptionPlans`, `useUpdateSubscriptionPlan`, `useAdminPlatformPaymentDetails`, `useUpdatePlatformPaymentDetails`, `useUploadPlatformQr`. `useApproveSubscription` switched to use the `approve_subscription_request` RPC (lets admin leave the date blank for auto-derived expiry).
- `src/hooks/useSubscription.ts` — public-read hooks `useActiveSubscriptionPlans`, `usePlatformPaymentDetails`; updated `useRequestPremiumUpgrade` to pass `billingPeriod` + `amountPaid` through the RPC.
- `UpgradeRequestSheet.tsx` rewritten as a **3-step flow** (Benefits → Plan Picker → Payment):
  - Benefits screen (commit `2b89af0`) — hero + 7 benefit cards (icon + title + description + real-world example) covering in-app payments, automated reminders, Coach onboarding, advanced analytics, competitor analysis, sponsored listings, featured banners.
  - Plan Picker — Monthly + Annual cards with large selling price, struck-through MRP when discounted, "Save ₹X (Y%)" emerald pill, monthly-equivalent line on annual, "Best value" pill when annual beats monthly. Auto-selects the bigger-discount plan. If no plans active, replaced with a "Premium pricing is being finalised" coming-soon card.
  - Payment — reads `platform_payment_details`, shows "Pay ₹X" headline, payment reference + notes, Submit calls the new RPC.
- `PlatformSubscriptions.tsx` request cards show a Monthly/Annual chip + ₹amount-paid pill; approve sheet's "Valid Until" date is optional.

### Verification
- Admin sets Annual to ₹6,999 (MRP ₹9,999), enables both plans → instructor sees both cards in the picker with "Save ₹3,000 (30%)" and "Best value" pills.
- Instructor pays ₹6,999 off-app, submits with UTR → admin sees Annual chip + ₹6,999 pill → approves with blank date → `subscription_valid_until` set to NOW() + 365 days automatically.
- Admin pricing-card discount auto-recomputes live; toggling Active off hides the plan from the picker.
- If admin hasn't seeded prices yet, the picker shows "Coming soon" and instructor can't submit.

**Exit criteria:** Pricing + payment are fully admin-controlled; no hardcoded UPI / bank / ₹ values remain in code.

**Status (May 17, 2026):** All code committed and pushed (commit `62e3957`). Migration `20260517120000_subscription_plans.sql` must be applied manually. Admin must then visit `/platform/settings` and:
1. Set the Monthly + Annual MRP / Selling Price and toggle Active.
2. Fill UPI ID + bank details (and optionally upload a UPI QR).

Until both are done, the upgrade sheet stays in its "Coming soon" fallback.

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

---

## Current Backlog (as of May 17, 2026)

> This section is the **single source of truth** for what's still pending. Update as items land. Items are roughly ordered by user-visible impact, not strict dependency.

### A. Manual deploy / configuration on Supabase — *blocks new features from going live*
1. **Apply migration `20260515150000_coaches.sql`** (Phase 11). Coaches feature is dead on prod until this runs.
2. **Apply migration `20260516120000_coach_student_names.sql`** (Phase 11 companion).
3. **Apply migration `20260517120000_subscription_plans.sql`** (Phase 12). Until this lands, the new upgrade sheet errors and the plan-validation RPC fails.
4. **Deploy edge function `revert-expired-coach-assignments`** and schedule daily cron (suggested `0 2 * * *` IST).
5. **Configure Monthly + Annual plans** at `/platform/settings` and flip Active. Without this, the upgrade picker shows the "Coming soon" card.
6. **Configure platform UPI ID + bank details** at `/platform/settings`. Without this, the payment screen has nothing to render.
7. **Regenerate Supabase types** (`supabase gen types typescript --linked > src/integrations/supabase/types.ts`) after the three migrations land. This removes the residual `any` shims in `useCoaches.ts`, `useSubscription.ts`, `usePlatformAdmin.ts`, `UserContext.tsx`.

### B. Phase 8 — Sponsored & Featured (highest user-visible priority — blocks full Premium monetization)
1. **`/provider/sponsored` page** — pick a class, pick region center + radius_km, valid_from/until, optional banner image upload (moderated). Status indicator + history table.
2. **Explore top-3 merge** — `useActiveFeaturedListings({lat, lng})` results merged into the first 3 cards with a "Featured" badge. Tie-break by `slot_position`.
3. **`refresh-sponsored-slots` cron edge function** — every 15 min: expire past `valid_until`, recompute `slot_position` per region (deterministic by `requested_at`).
4. **`featured_banners` flow** — table already in schema spec; build the request UI + admin approval + rotating banner on home / explore (per region).
5. **Impression / click instrumentation** — increment `sponsored_listings.impression_count` on card render and `click_count` on tap; debounced to avoid scroll spam.

### C. Coaches — known follow-ups (post-Phase 11)
1. **Drop the legacy `trainers` table** after one release of running on `coaches` in prod without issue. Pre-flight: ensure no app code reads `trainers`; the migration kept it as a safety fallback.
2. **Drop `certifications.trainer_id`** once the `coach_id` backfill is verified. `useSeekerTrainerCertifications` currently queries both columns for back-compat.
3. **Retire the `/provider/trainers-legacy` shim** after one release.
4. **CSV import for bulk coach invites** — current UI is one-at-a-time.
5. **Dedicated coach-self-view page** (read-only profile + my-assignments list) — currently a coach goes straight to the academy dashboard with scoped data; no "my coach profile" surface yet.
6. **Channel options for `payment_reminder_log`** — table already has `channel ∈ {in_app, email, whatsapp}`. Only `in_app` is wired today; email + WhatsApp dispatch is post-MVP.

### D. Subscription pricing — known follow-ups (post-Phase 12)
1. **Quarterly plan slot** — `subscription_plans.billing_period` CHECK currently permits only `monthly` / `annual`. Adding a quarterly tier needs a migration to extend the constraint + UI for the third card.
2. **Multi-currency support** — `subscription_plans.currency` column exists but the UI uses `₹` and INR formatters everywhere. Picker + admin pages need a currency-aware formatter.
3. **Auto-renewal flow** — current model expires hard; admin must approve a new request to re-grant. Renewals via in-app payment gateway are post-MVP.
4. **Pro-rated upgrades mid-cycle** — Monthly → Annual switch in the middle of a billing period isn't supported; provider has to wait for current period to end.
5. **Tax / GST line item** on the payment screen and admin approval card.

### E. Stabilization & polish (Phase 9 carryover)
1. **Carryover-feature regression sweep** — Playwright happy-path coverage for: family CRUD, family linking invite/accept, demo sessions seeker→provider round trip, materials, waitlist auto-offer, chat realtime, reviews + provider reply, announcements, attendance (today + past), notifications bell badge, **Coach assign/reassign/temporary-swap**, **Upgrade-to-Premium plan-picker → admin approval round trip**.
2. **Cleanup of remaining v1 references** *(still pending — verified May 17, 2026)*:
   - `src/pages/seeker/EnrollmentDetail.tsx` lines 171, 257 — `cls.provider_apartment_registrations.service_providers` lookups.
   - `src/pages/seeker/InviteAccept.tsx` line 98 — `invite.families.apartment_complexes.name`.
   - `src/types/database.ts` — `is_apartment_admin` (line 16), `apartment_id` (lines 48, 60, 129, 406, 480).
3. **Deprecated hook stubs** — `useProviderRegistrations`, `useProviderPendingTerms`, `useRespondToTerms`, `useProviderClassActionItems`, `useRespondToClassTerms` in `useProvider.ts` are no-op stubs for v1 callers. Delete after a final grep confirms no consumers.
4. **`BottomNav` stub removal** — file is a no-op but still imported in several pages. Sweep + remove.
5. **PostgREST FK disambiguation guardrail** — add an ESLint custom rule (or pre-commit grep) that flags `from("enrollments").select(...batches(...)` without a `!batch_id` hint. See CLAUDE.md § Data Fetching for the pattern.
6. **Re-onboarding nudge for users with `seeker_home_location IS NULL`** — currently they can hit `/explore` with no nearby results.
7. **PostGIS RPC fallback path** — Explore currently filters client-side from denormalized lat/lng. Wire `nearby_classes` RPC as the canonical server-side path once dataset grows past a few hundred classes.

### F. Trust, safety, abuse handling
1. **Repeat-violation suspension** — auto-suspend providers with N moderation rejections in M days (CLAUDE.md § "Strict no-tolerance categories").
2. **Appeal flow** — provider taps "Appeal" on a rejected item → admin sees in moderation queue with appeal note.
3. **Rate-limit category requests** — providers currently can submit unlimited requests; cap at e.g. 3 pending per provider.
4. **Rate-limit coach invites + payment reminders** — academy could spam reminder notifications. Cap at e.g. 1 manual reminder per payment per 24 h.

### G. Performance & analytics
1. **`EXPLAIN ANALYZE` on `nearby_classes`** at 10k-class load; confirm GIST index usage. Defer unless dataset projection demands.
2. **Provider Premium analytics tab** — competitor analysis, retention, growth insights. Tab exists behind `<PremiumGate>` but queries are stubbed; `useCompetitorClasses` returns data but charts are minimal.
3. **Platform analytics charts** — Recharts views for active providers, classes, enrollments by city/category over time.

### H. Cutover prep (Phase 10)
1. Take v1 DB snapshot for archive.
2. Run Supabase advisors → resolve all warnings.
3. Update marketing copy on Landing page to reflect the Coach + Premium plan-picker positioning.
4. Producer's guide + admin runbook docs (now needs to cover: configuring plans + payment, inviting Coaches, approving subscriptions with auto-derived dates).
5. Update [README.md](README.md) to reflect v2 architecture + Coaches + plan-based provisioning.

### I. Nice-to-haves (post-MVP)
- Phone OTP auth.
- Multiple seeker home locations (home + office).
- `provider_home_travel_radius_km` separate from per-class `home_radius_km`.
- Razorpay webhook → auto-grant Premium (replaces manual approval and removes admin SLA bottleneck).
- Geocode result caching table (`geocode_cache`) for Mappls cost control.
- H3 hex bucketing if class count exceeds ~100k.
- Coach-side mobile push for assignment / temporary-swap events.

---

## Recommended Next Steps

> A pragmatic, sequenced picklist. Each sprint ends at a demoable / verifiable checkpoint. Calibrate to your team size — single-dev estimates in parentheses.

### Sprint 0 — Unblock production (~half day, single dev) — *do this first*
The features we've already coded are sitting on the branch but inert in prod until manual actions land.

1. **Take a Supabase backup** (one click in the dashboard) before applying any migration.
2. **Apply the three migrations in order, in the Supabase SQL editor:**
   - `20260515150000_coaches.sql`
   - `20260516120000_coach_student_names.sql`
   - `20260517120000_subscription_plans.sql`
3. **Regenerate types:** `supabase gen types typescript --linked > src/integrations/supabase/types.ts`, commit.
4. **Deploy edge function** `revert-expired-coach-assignments` and schedule a daily cron (`0 2 * * *` IST suggested).
5. **Configure pricing** at `/platform/settings` → Subscription Pricing: set MRP / Selling Price for Monthly and Annual; flip Active for at least one. Live discount % renders automatically.
6. **Configure payment details** at `/platform/settings` → Payment Details: UPI ID (required), optional UPI QR upload, full bank section.
7. **Smoke test:**
   - Log in as an academy provider, invite a coach by email. Log in as that email; confirm Coach badge in header + scoped dashboard.
   - Log in as a Basic provider; open the upgrade sheet from `/provider/dashboard`. Verify Benefits → Plan Picker → Payment flow renders end-to-end.
   - Submit a test upgrade request, approve from `/platform/subscriptions` leaving the date blank. Confirm `subscription_valid_until` auto-derives to +30 / +365 days.

**Exit:** Coaches + admin-configurable Premium are live; type-shims removed; one sample request flowed through.

---

### Sprint 1 — Phase 8 sponsored & featured (~1 week, single dev)
This is the biggest user-visible gap. The data path exists; the surfaces don't.

1. **Build `/provider/sponsored` page** — class picker, region + radius + date inputs, optional banner upload (goes through the moderation pipeline), status / history table.
2. **Wire Explore top-3 merge** — pull `useActiveFeaturedListings({lat, lng})`, merge ahead of organic results, render with gold "Featured" badge.
3. **Build & deploy `refresh-sponsored-slots` cron** (every 15 min): expire past `valid_until`, recompute `slot_position` per region. Mirrors the `revert-expired-coach-assignments` shape.
4. **Build `featured_banners` flow** — provider upload UI (moderated) → admin queue → rotating banner on Landing/Explore for seekers in the banner's region.
5. **Add impression / click instrumentation** — increment `sponsored_listings.impression_count` on card render (IntersectionObserver), `click_count` on tap. Debounce both.

**Exit:** Premium provider can request and run a sponsored campaign end-to-end; seekers see Featured cards; banner appears for in-region seekers.

---

### Sprint 2 — Stabilization sweep (~3–4 days)
Pay down accumulated tech debt before cutover so it doesn't bite during prod use.

1. **Strip remaining v1 references** (backlog § E.2): rewrite `EnrollmentDetail.tsx`, `InviteAccept.tsx`, `types/database.ts` to use v2 schema only.
2. **Delete deprecated stub hooks** (§ E.3) and `BottomNav.tsx` after a final grep.
3. **Add the FK-disambiguation guard** (§ E.5) — ESLint rule or pre-commit grep that flags bare `batches(...)` embeds off `enrollments`. Documented but not enforced.
4. **Re-onboarding nudge for users with NULL `seeker_home_location`** (§ E.6).
5. **Playwright happy-path coverage** (§ E.1) — one e2e test per major flow including the new Coach assign + plan-picker flows.

**Exit:** `grep -r "provider_apartment_registrations\|is_apartment_admin\|apartment_id" src/` returns zero. CI Playwright green.

---

### Sprint 3 — Trust & safety hardening (~2–3 days)
Risk-mitigation before opening up signups beyond a closed pilot.

1. **Rate-limit coach invites + manual reminders** (§ F.4) — RPC-level guard.
2. **Rate-limit category requests** (§ F.3).
3. **Repeat-violation auto-suspension** (§ F.1).
4. **Appeal flow** (§ F.2) — adds a "Request Appeal" button on rejected items; admin sees appealed flags first in `/platform/moderation`.

**Exit:** abusive paths blocked; admin queue surfaces appeals.

---

### Sprint 4 — Premium analytics depth (~3–5 days)
Now that pricing is live and Premium is sellable, deliver on the value prop.

1. **Provider Premium analytics tab** (§ G.2) — wire competitor analysis (we already fetch the data), retention curves, attendance heatmaps, revenue trend.
2. **Platform analytics charts** (§ G.3) — Recharts views for active providers, classes, enrollments by city / category over time.

**Exit:** the "Advanced Analytics" Premium benefit lives up to its description in the upgrade sheet.

---

### Sprint 5 — Cutover & launch (~2–3 days)
Phase 10 in name.

1. v1 snapshot for archive, run Supabase advisors, resolve warnings (§ H.1, § H.2).
2. Landing-page marketing copy + Premium positioning refresh (§ H.3).
3. Producer's guide + admin runbook (§ H.4).
4. README refresh (§ H.5).
5. DNS / env swap → flip production.

**Exit:** v2 in production, v1 decommissioned.

---

### Post-launch (Sprint 6+)
Pull from backlog § C (Coaches follow-ups), § D (subscription pricing follow-ups), and § I (nice-to-haves) based on early customer feedback and observed usage patterns. Highest-leverage candidates:
- Razorpay webhook → auto-grant Premium (removes the admin SLA bottleneck — eats most of the manual-approval overhead).
- Email + WhatsApp channels for the manual payment reminder.
- CSV bulk-invite for coaches.
- Drop legacy `trainers` table + retire `/provider/trainers-legacy` shim once you have a clean release on `coaches`.

---

## Pointer to CLAUDE.md

For schema details (including the difference between `users.id` and `users.auth_id`, the seat-count trigger contract, the `ref_type` values in `moderation_flags`, and the full migration chain), see [CLAUDE.md](CLAUDE.md). This plan focuses on phase status; CLAUDE.md is the codebase reference.
