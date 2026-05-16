# CampusBee — Project Reference Guide (v2)

> **This document is the complete project context for Claude Code.**
> Reflects the **v2 scope** (post-pivot, current as of May 2026) — apartment binding removed, geo-based discovery, provider subscription tiers, AI content moderation, Premium-only Coach team for academies, admin-configurable subscription pricing.
> See `IMPLEMENTATION_PLAN_V2.md` for the phased migration roadmap and post-MVP backlog.
> Pre-pivot v1 migrations are archived under `supabase/migrations/_archive_v1/`.

> **UI persona naming (May 2026):** the seeker persona is shown to users as **"Learner"** and the provider persona as **"Instructor"**. Database column names (`is_provider`, `last_active_persona = 'seeker' | 'provider'`, etc.) are unchanged — only the user-facing labels were renamed. PersonaSwitcher and onboarding copy use Learner/Instructor.

> **Coaches (May 2026):** Premium academy instructors can invite Coaches by name + email. A Coach is a logged-in user (not a separate persona) with restricted access on the provider surface — they see only the classes / batches they're assigned to. The Coach badge appears in the header next to the persona switcher when the active persona is `provider` and the user has at least one active coach record. The legacy `trainers` UI was replaced by `/provider/coaches`; the public provider profile now reads from `coaches`. Migration `20260515150000_coaches.sql` is mandatory before this feature works; `20260516120000_coach_student_names.sql` extends the student-names RPC so coaches can read names too.

---

## PROJECT OVERVIEW

**CampusBee** is a **hyperlocal, location-based classes marketplace** for Indian cities. Seekers (parents, learners) discover nearby classes — sports, dance, arts, academics, music, fitness, wellness — within a configurable radius of their home, regardless of where the class is offered (studio, academy, or in the seeker's home). Providers list classes, manage batches, take attendance, and chat with students. A platform admin oversees content moderation, premium subscriptions, sponsored slots, and categories.

### What changed in v2 (vs. v1)
1. **Apartment Admin role removed entirely.** No more apartment-scoped multi-tenancy. Providers self-onboard, auto-approved into the **Basic** tier.
2. **Location-first discovery.** Each class has its own address + lat/lng. Seekers set a home location and see classes within an adjustable radius (PostGIS `ST_DWithin`). No apartment binding.
3. **Two provider subscription tiers** — Basic (free) and Premium (paid; manually granted during MVP).
4. **AI content moderation** auto-screens every provider-uploaded image and text field. Borderline cases queue for platform-admin review.
5. **Sponsored listings & featured banners** are Premium-only and manually approved by platform admin.
6. **Coaches feature (Premium-only, academy providers).** Academy admins invite multiple Coaches by name + email; each coach gets scoped access to assigned classes / batches for attendance, payments, and reminders. Temporary swaps with auto-revert supported. Replaces the older `trainers` table for both team management and the public provider profile.
7. **Admin-configurable subscription pricing.** Monthly + Annual plans (with MRP + selling price, discount auto-computed) live in `subscription_plans`. Platform UPI ID, optional QR image, and bank details live in `platform_payment_details`. Instructors pick a plan before paying; the request RPC validates the amount matches the active plan and `approve_subscription_request` auto-derives the expiry date (30 / 365 days) from the chosen period.

---

## TECH STACK

- **Frontend:** React 18 + TypeScript, Vite 5, Tailwind CSS 3, shadcn/ui (Radix), TanStack Query v5, React Router v6, Lucide icons, Recharts, Zod + React Hook Form
- **Backend:** Supabase (PostgreSQL **with PostGIS extension** + Auth + Storage + Edge Functions + Realtime)
- **Maps & Geocoding:** **MapMyIndia (Mappls) JS SDK + Places API** — picker, autocomplete, reverse geocoding. Best Indian address coverage.
- **Geo queries:** PostGIS `geography(Point, 4326)` columns + `ST_DWithin` / `ST_Distance` for nearby search and distance ranking. GIST indexes on every location column.
- **Content Moderation:**
  - Images → **Sightengine** (NSFW, suggestive, weapons, drugs)
  - Text → **Google Gemini API** (`gemini-2.0-flash` safety ratings — free tier sufficient for MVP volumes)
  - Edge function `ai-moderate-content` orchestrates both
- **Auth:** Email + password (primary), Google OAuth, Apple OAuth (added May 2026). Magic links removed. Phone OTP planned for future. `public.users.auth_id` is the FK to `auth.users.id` — internal `users.id` is what every other table references.
- **Payments:** **Track-only** for MVP (no real gateway). Premium grants and sponsored slots are manually toggled by platform admin via in-app workflows.
- **Dev tools:** Vite dev server on port 8080, vitest, Playwright, ESLint 9, SWC.
- **Deployment:** Lovable (frontend), Supabase (backend).

---

## ARCHITECTURE PRINCIPLES

1. **Unified User Model.** Every user is a seeker by default. Provider and Platform-Admin personas are unlocked additively. `last_active_persona` persists in DB. PersonaSwitcher drives in-app role switching.
2. **Location-based discovery (NOT apartment-scoped).** Classes carry their own location. Seekers carry their own location. Discovery = PostGIS proximity. RLS no longer scopes by apartment_id.
3. **Subscription-tier feature gating.** UI components and RLS check `service_providers.subscription_tier ∈ {basic, premium}`. Premium-only features are visibly upsold to Basic users.
4. **Content-moderation gate.** Every user-generated content item (class image, banner, profile photo, title, description, bio) flows through `ai-moderate-content` before going public. `moderation_status ∈ {pending, approved, rejected, in_review}` controls visibility.
5. **Mobile-first.** 375 px baseline. Bottom nav. 44 px touch targets. Sheet modals. Responsive at 768 px and 1024 px+.
6. **Draft → Published lifecycle.** Classes start as `draft`, publish requires moderation approval. Batches independent draft/active/full/paused/completed/cancelled.
7. **Route-based persona sync.** UserContext watches URL prefix → auto-syncs `activePersona` (`/provider/*` → provider, `/platform/*` → platform_admin, seeker routes → seeker). **No `/admin/*` routes in v2.** `/admin/*` catches all redirect to `/`.
8. **React.forwardRef pattern.** All components rendering DOM elements use `React.forwardRef` + `displayName` (Lovable preview compatibility).
9. **`auth.uid()` vs `users.id` discipline.** Every join from `auth.users` goes through `public.users.auth_id = auth.uid()`. RLS helpers (`current_user_id()`) return the *internal* `public.users.id`. Bugs caused by comparing `users.id` to `auth.uid()` are the single most common RLS mistake — multiple hotfix migrations (`011`, `018b`, `019b`, `20260512072126`, `20260513051521`, `20260513060707`) exist solely to repair this pattern.
10. **Auth ↔ DB resolution in hooks.** Hooks that need provider context resolve `service_providers` via `users.auth_id = auth.uid()` instead of asserting a single row by `user_id = auth.uid()` (which produced 406 errors). See `useCategoryRequests`, `useCertifications`.
11. **Single landing entry-point.** `/` is the only landing page. The old `/home` route was removed; all navigation lands on `/` (anonymous landing or signed-in seeker home) or `/explore`.
12. **Top nav only — no bottom nav.** `BottomNav.tsx` is now a no-op stub (kept for import compatibility). The unified `Header` component with PersonaSwitcher + utility icons (Home, Chat, Notifications, Profile) handles all navigation.

---

## SUBSCRIPTION TIERS

| Capability | Basic (Free) | Premium (Paid) |
|---|:---:|:---:|
| Self-onboard, auto-approved | ✅ | ✅ |
| Create classes & batches | ✅ | ✅ |
| Manage classes & students | ✅ | ✅ |
| Mark attendance | ✅ | ✅ |
| Record payments (track-only) + manual reminder button | ✅ | ✅ |
| In-app chat with seekers | ✅ | ✅ |
| Basic dashboard & reports | ✅ | ✅ |
| Class materials uploads | ✅ | ✅ |
| Demo / trial sessions | ✅ | ✅ |
| Reviews & announcements | ✅ | ✅ |
| **In-app payment collection** | ❌ | ✅ |
| **Automated payment reminders (cron)** | ❌ | ✅ |
| **Onboard Coaches** *(academy only — invite team, assign classes/batches, temporary swaps)* | ❌ | ✅ |
| **Advanced analytics dashboard** | ❌ | ✅ |
| **Competitor analysis (location/category/pricing)** | ❌ | ✅ |
| **Seller insights for growth** | ❌ | ✅ |
| **Featured banner placements** | ❌ | ✅ |
| **Sponsored listings (top-3 in explore with "Featured" tag)** | ❌ | ✅ |

**Provisioning during MVP (payments deferred):**
1. Platform admin configures Monthly + Annual plans at `/platform/settings` (MRP, selling price, Active toggle) plus UPI / bank payment details.
2. Provider taps "Upgrade to Premium" → 3-step sheet (Benefits → Plan picker → Payment) populated from `subscription_plans` + `platform_payment_details`.
3. Provider pays off-app and submits with payment reference → `request_premium_upgrade` RPC inserts a `provider_subscription_requests` row carrying `billing_period` + `amount_paid` (validated to match the active plan).
4. Platform admin sees the request in `/platform/subscriptions` with the plan chip and ₹amount-paid pill, verifies the off-app payment, and approves.
5. `approve_subscription_request` derives `subscription_valid_until` from the request's `billing_period` (`+30` / `+365` days) when admin leaves the date blank; admin can still override with an explicit date.

If no plans are active, the upgrade sheet shows a "Premium pricing is being finalised" coming-soon card so providers can't submit a payment-less request.

Sponsored slot and featured banner requests follow the same admin-queue pattern via `sponsored_listings` / `featured_banners` directly.

**Seekers** never pay any subscription. Seekers who are also providers see Premium gating only on the provider persona.

---

## CONTENT MODERATION POLICY

- **Pre-publish gate:** every image upload (class photos, banners, provider/profile avatars) and every text submission (class title, description, provider bio, class titles, banners) is sent to `ai-moderate-content` edge function.
- **AI providers:**
  - Sightengine for images — checks NSFW (adult, suggestive), weapons, drugs, offensive symbols. Score thresholds:
    - `score ≥ 0.85` → auto-reject (`moderation_status = rejected`), provider notified
    - `0.45 ≤ score < 0.85` → queue (`in_review`), platform admin decides
    - `score < 0.45` → auto-approve (`approved`)
  - **Google Gemini API** (`gemini-2.0-flash`) for text — uses built-in `safetyRatings` returned on every `generateContent` call. Categories checked: `HARM_CATEGORY_HARASSMENT`, `HARM_CATEGORY_HATE_SPEECH`, `HARM_CATEGORY_SEXUALLY_EXPLICIT`, `HARM_CATEGORY_DANGEROUS_CONTENT`. Probability thresholds:
    - Any category `HIGH` → auto-reject (`moderation_status = rejected`), provider notified
    - Any category `MEDIUM` → queue (`in_review`), platform admin decides
    - All categories `LOW` / `NEGLIGIBLE` → auto-approve (`approved`)
- **Provider experience:** rejected items show the reason inline ("Image flagged: suggestive content"). Provider can edit & resubmit (re-runs moderation).
- **Platform admin queue:** `/platform/moderation` lists `in_review` items with original content preview, AI scores, approve/reject/escalate actions. Reject requires reason (sent to provider via notification).
- **Strict no-tolerance categories:** explicit/pornographic content is auto-rejected with no appeal. Repeated violations trigger account suspension.

---

## GEO & LOCATION MODEL

### Tables with location data
- `users.seeker_home_address`, `users.seeker_home_location` (PostGIS Point), **`users.seeker_home_lat`, `users.seeker_home_lng`** (NUMERIC denormalized from the Point — added in migration 021 for client-side ranking without WKB hex decoding). Set via MapMyIndia picker on onboarding (`StepLocation`) and `/profile`.
- `service_providers.home_address`, `service_providers.home_location` (Point) — used as fallback for home-based classes ("I travel to student")
- `classes.address`, `classes.location` (Point), **`classes.location_lat`, `classes.location_lng`** (NUMERIC denormalized, migration 021), `classes.is_home_based BOOLEAN`, **`classes.home_radius_km NUMERIC(6,2) DEFAULT 5`** (service radius for home-based classes)
  - When `is_home_based = true`, the class's effective location for nearby search is `service_providers.home_location` and the radius is `home_radius_km`
  - Otherwise the class's own `location` is used
- `sponsored_listings.center_location` (Point), `sponsored_listings.radius_km` — limits where the sponsored slot is shown

**Why both geography and lat/lng?** PostgREST returns geography values as WKB hex which is awkward to parse in the browser. The denormalized lat/lng columns let the client read coordinates directly while server-side queries (`nearby_classes` RPC) still use the geography column + GIST index. Keep both in sync on writes.

### Indexes
- `CREATE INDEX ... USING GIST (location)` on every Point column
- Compound indexes: `(category_id, status)` on classes, `(provider_id, subscription_tier)` on subscriptions

### Nearby search (canonical query)
```sql
SELECT c.*, ST_Distance(c.location, $seeker_location) / 1000.0 AS distance_km
FROM classes c
WHERE c.status = 'published'
  AND c.moderation_status = 'approved'
  AND ST_DWithin(c.location, $seeker_location, $radius_km * 1000)
ORDER BY distance_km;
```
Sponsored listings injected separately into top-3 by `sponsored_listings.slot_position`.

---

## DESIGN LANGUAGE

- **Primary:** Amber/Orange gradient (`#F59E0B` → `#EA580C`)
- **Text:** Dark navy (`#1E293B`)
- **Background:** Soft grey (`#F8FAFC`)
- **Cards:** White, 12 px radius, subtle shadow
- **Provider accent:** Indigo (`#6366F1`)
- **Platform Admin accent:** Slate (`#475569`)
- **Premium accent:** Gold gradient (`#FCD34D` → `#F59E0B`) — used for "Featured", "Premium", "Sponsored" badges
- **Font:** Inter
- **Icons:** Lucide React
- **(Apartment-admin emerald accent removed.)**

---

## FILE STRUCTURE

```
campusbee-hub/
├── src/
│   ├── components/
│   │   ├── ui/                  # 70+ shadcn/ui components (Radix)
│   │   ├── layout/
│   │   │   ├── Header.tsx
│   │   │   └── PersonaSwitcher.tsx
│   │   ├── onboarding/
│   │   │   ├── StepProfile.tsx
│   │   │   ├── StepLocation.tsx       # NEW — replaces StepApartment (MapMyIndia picker)
│   │   │   ├── StepFamily.tsx
│   │   │   └── StepRoleSelect.tsx
│   │   ├── location/
│   │   │   ├── MapplsPicker.tsx       # MapMyIndia address picker + autocomplete + GPS "Use My Location" button (zoom 17)
│   │   │   └── ClassLocationPicker.tsx # Wraps MapplsPicker for the CreateClass step (mandatory)
│   │   ├── subscription/
│   │   │   ├── PremiumGate.tsx
│   │   │   └── UpgradeRequestSheet.tsx # 3-step: Benefits → Plan picker (Monthly/Annual) → Payment. Pulls from subscription_plans + platform_payment_details.
│   │   ├── moderation/
│   │   │   └── ModerationStatusBadge.tsx
│   │   ├── onboarding/
│   │   │   ├── StepProfile.tsx
│   │   │   ├── StepLocation.tsx
│   │   │   ├── StepFamily.tsx
│   │   │   ├── StepRoleSelect.tsx     # "I'm looking for classes" (Learner) / "I want to teach" (Instructor)
│   │   │   └── StepProviderProfile.tsx
│   │   ├── provider/
│   │   │   ├── CategoryRequestSheet.tsx # New-category / new-subcategory request form
│   │   │   ├── CertificationManager.tsx # CRUD + moderation badge per cert (max 5)
│   │   │   ├── ClockTimePicker.tsx
│   │   │   ├── GradeMultiSelect.tsx   # batches.grades editor
│   │   │   └── IconPicker.tsx         # Lucide icon picker for category requests
│   │   ├── shared/
│   │   │   ├── ClassCard.tsx          # Distance, trust markers (New/Popular), moderation badge, Featured (planned)
│   │   │   ├── CertificationGallery.tsx
│   │   │   └── ErrorState.tsx
│   │   ├── layout/
│   │   │   ├── Header.tsx             # Unified top nav; PersonaSwitcher hidden on /profile, /family, /chat, /notifications; renders a "Coach" badge next to the switcher when isCoach + activePersona='provider'
│   │   │   └── PersonaSwitcher.tsx    # Labels: Learner / Instructor / Platform Admin. Coaches also see the Instructor option even without is_provider.
│   │   ├── AuthDrawer.tsx             # Google + Apple OAuth + email-password
│   │   ├── AuthGuard.tsx
│   │   ├── BottomNav.tsx              # NO-OP stub (kept for import compatibility — top nav only)
│   │   ├── NavLink.tsx
│   │   └── PlaceholderPage.tsx
│   ├── pages/
│   │   ├── Auth.tsx
│   │   ├── Landing.tsx                # `/` — dual anonymous / signed-in
│   │   ├── Index.tsx
│   │   ├── Notifications.tsx
│   │   ├── NotFound.tsx
│   │   ├── seeker/                    # 11 pages (no /home)
│   │   ├── provider/                  # 18 pages — includes CoachesManagement (Premium academy team mgmt); /provider/trainers now redirects to /provider/coaches; TrainerManagement kept as `trainers-legacy` shim.
│   │   └── platform/                  # 9 pages (Dashboard, Moderation, Subscriptions, Sponsored, Providers, Categories, Analytics, Settings, Layout) — Settings now also edits subscription_plans + platform_payment_details
│   ├── hooks/
│   │   ├── useLocation.ts             # geocode, reverse-geocode, distance helpers, useUpdateSeekerLocation mutation
│   │   ├── useSubscription.ts
│   │   ├── useModeration.ts
│   │   ├── useCategoryRequests.ts     # NEW — provider submits / admin reviews
│   │   ├── useCertifications.ts       # NEW — owner=provider|trainer, max 5, moderated. Read hook falls back trainer_id↔coach_id for back-compat.
│   │   ├── useCoaches.ts              # NEW — invite/assign/swap/remove coaches, send_payment_reminder, useEffectiveProviderContext (admin vs coach scope resolver)
│   │   ├── usePlatformAdmin.ts        # Moderation, subscription grants (now via approve_subscription_request RPC), sponsored, category-request approvals, subscription_plans + platform_payment_details CRUD
│   │   ├── useProvider.ts             # tier-aware + coach-scope-aware (useProviderStats / TodaySchedule / UpcomingSchedule / ActiveBatches accept optional CoachScope and resolve via resolveCoachScopedIds — UNION semantics, not intersection)
│   │   ├── useSeeker.ts               # location-aware; useProviderTrainers + useProviderProfile now read from `coaches` and remap full_name→name for legacy callers
│   │   ├── useClasses.ts              # PostGIS nearby + denormalized lat/lng client filtering
│   │   ├── useClassMaterials.ts
│   │   ├── useDemoSessions.ts
│   │   ├── useEngagement.ts           # Attendance + chat unread counts
│   │   ├── useFamily.ts
│   │   ├── useFamilyLinking.ts
│   │   ├── useFeatured.ts             # Reads sponsored_listings (v2 replacement query); useSponsored alias not yet split out
│   │   ├── useNotifications.ts
│   │   ├── useOnboarding.ts
│   │   ├── useAnalytics.ts            # tier-gated
│   │   ├── use-mobile.tsx
│   │   └── use-toast.ts
│   ├── contexts/
│   │   └── UserContext.tsx            # No apartment; exposes providerProfile + coachProfiles + isCoach. Runs accept_coach_invites on every session and shows the splash until profile resolves (prevents AuthGuard bouncing /provider/* on first paint).
│   ├── integrations/
│   │   ├── supabase/
│   │   │   ├── client.ts
│   │   │   └── types.ts
│   │   ├── mappls/                    # NEW
│   │   │   ├── client.ts              # SDK init, API key from env
│   │   │   └── geocode.ts             # Address ↔ lat/lng helpers
│   │   └── lovable/
│   │       └── index.ts
│   ├── lib/
│   │   ├── utils.ts
│   │   ├── distance.ts                # NEW — haversine fallback, format helpers
│   │   └── moderation.ts              # NEW — client-side optimistic UI helpers
│   ├── types/database.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── _archive_v1/               # NEW — old 001-028 archived here, not run on fresh DBs
│   │   ├── 001_baseline_v2.sql        # Full v2 schema (PostGIS enabled)
│   │   ├── 002_rls_v2.sql             # All RLS policies
│   │   ├── 003_storage_buckets_v2.sql
│   │   ├── 004_subscription_helpers.sql
│   │   ├── 005_moderation_helpers.sql
│   │   └── 006_geo_helpers.sql        # SECURITY DEFINER nearby() function etc.
│   └── functions/
│       ├── ai-moderate-content/       # NEW
│       ├── refresh-sponsored-slots/   # NEW (cron — expire & rotate)
│       ├── revert-expired-coach-assignments/ # NEW (daily cron — temporary swap auto-revert)
│       ├── check-pending-invites/
│       ├── expire-family-invites/
│       ├── expire-waitlist-offers/
│       ├── generate-payment-reminders/  # Premium-gated cron
│       ├── handle-invite-accept/
│       ├── process-waitlist/
│       └── send-notifications/
├── public/
├── CLAUDE.md
├── CLAUDE-PHASE2-FAMILY-LINKING.md
├── IMPLEMENTATION_PLAN_V2.md          # NEW — phased rollout
├── package.json
├── vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── tsconfig.app.json
```

---

## ROUTES (App.tsx)

### Public
| Path | Page | Description |
|---|---|---|
| `/` | Landing | **Dual-purpose** — anonymous landing page OR signed-in seeker home (Find Classes / Teach Classes tiles, live location prompt, demo video modal). No auto-redirect. |
| `/auth` | Auth | Email+password, Google OAuth, Apple OAuth |
| `/class/:classId` | ClassDetail | **Public** — shareable class link, readable by anonymous users (migration 024 added anon SELECT on classes/service_providers/users/trainers) |
| `/invite/:inviteCode` | InviteAccept | Accept family invite (no auth guard) |

### Seeker (Protected)
| Path | Page | Description |
|---|---|---|
| `/onboarding` | Onboarding | Profile → **Location** → Family → Role. StepLocation calls `ensure_self_family_member` RPC so the seeker has a self-row before EnrollFlow. |
| ~~`/home`~~ | — | **REMOVED**. All home navigation goes to `/` or `/explore`. |
| `/explore` | Explore | Nearby classes, full-spectrum category pills (flex-wrap), trust markers (New/Popular), distance badges, search; sponsored top-3 (planned). Category pills collapse to selection on scroll. |
| `/my-classes` | MyClasses | Active / upcoming / completed enrollments |
| `/class/:classId` | ClassDetail | Info, batches, reviews, trial booking, distance badge |
| `/provider-profile/:providerId` | ProviderProfilePage | Bio, classes, team, verified badge |
| `/enroll/:batchId` | EnrollFlow | Member select, review, payment record |
| `/enrollment/:enrollmentId` | EnrollmentDetail | Attendance, schedule, payments, materials |
| `/chat` | Chat | Conversations |
| `/profile` | Profile | Settings + **location picker** + persona toggle |
| `/family` | FamilyManagement | Members, invites |

### Provider (Protected)
| Path | Page | Description |
|---|---|---|
| `/become-provider` | BecomeProvider | Self-serve onboarding → auto-approved Basic tier |
| `/provider/dashboard` | ProviderDashboard | Stats, today's schedule, tier badge, upgrade CTA |
| `/provider/classes` | ProviderClasses | Listing with filters, moderation badges |
| `/provider/classes/new` | CreateClass | **5-step flow**: Category → Details → Location (mandatory) → Schedule + social links → Review. `is_home_based` checkbox + `home_radius_km`. Certifications block. Pending-category support (creates classes with `category_id = null` + `pending_category_request_id` set). |
| `/provider/classes/:classId` | ProviderClassDetail | Edit, batches, addons, materials, social links, distance/schedule preview |
| `/provider/classes/:classId/batch/new` | CreateBatch | Schedule, pricing, capacity, **grade multi-select** (`batches.grades TEXT[]`), `ClockTimePicker` for start/end |
| `/provider/coaches` | CoachesManagement | **Premium + academy only.** Invite coaches by name + email, assign class- or batch-scope, optional temporary swaps with `valid_from` / `valid_until` (auto-reverts via cron), soft-remove. Wrapped in `<PremiumGate>` — Basic academies see the upgrade CTA. |
| ~~`/provider/trainers`~~ | — | **Replaced by `/provider/coaches`.** Path 302-redirects there. `TrainerManagement.tsx` is retained at `/provider/trainers-legacy` as a fallback for one release. |
| `/provider/students` | ProviderStudents | Enrolled students with seeker + family-member names via `get_provider_student_names` SECURITY DEFINER RPC (migration 020b, extended in `20260516120000_coach_student_names.sql` to accept assigned coaches alongside the academy owner). Resolves providerId from `providerProfile.id` directly for owners, falls back to `useEffectiveProviderContext` for pure coaches. |
| `/provider/payments` | ProviderPayments | Record + confirm payments (Premium = collect in-app + reminders). Adds a "Send Reminder" button per recorded payment that invokes `send_payment_reminder` RPC (admin OR assigned coach authorized; logs to `payment_reminder_log`). |
| `/provider/attendance/:batchId` | TakeAttendance | Daily + past-date marking |
| `/provider/announcements` | Announcements | Post/manage |
| `/provider/analytics` | ProviderAnalytics | Basic charts; **Premium tab unlocks competitor analysis, growth insights** |
| `/provider/classes/:classId/materials` | ProviderMaterials | Resource uploads |
| `/provider/classes/:classId/demos` | ProviderDemoSessions | Trial mgmt |
| `/provider/reviews` | ProviderReviews | View & reply |
| `/provider/subscription` | ProviderSubscription | Current tier, upgrade request, history. Upgrade now opens the 3-step sheet (Benefits → Plan picker → Payment); plan choice + amount are persisted on the request. |
| `/provider/categories` | ProviderCategories | **NEW** — provider-initiated category / sub-category request workflow. Submit new category (with icon + sub-categories) or new sub-category under an existing parent. Status tracking; on approval the corresponding pending classes are backfilled automatically. |
| ~~`/provider/terms`~~ | — | **REMOVED** (no apartment commercial terms in v2) |
| ~~`/provider/sponsored`~~ | — | **NOT YET BUILT** — Phase 8 surface still pending |

### Platform Admin (Protected, nested under PlatformLayout)
| Path | Page | Description |
|---|---|---|
| `/platform` | PlatformDashboard | Global stats |
| ~~`/platform/apartments*`~~ | — | **REMOVED** |
| `/platform/categories` | PlatformCategories | Hierarchical categories + **category request review** (approve/reject/retag pending provider submissions; on approve, runs `approve_category_request` RPC which inserts the new category, seeds any sub-categories, backfills classes that referenced the pending request, and notifies the provider) |
| `/platform/analytics` | PlatformAnalytics | Platform-wide metrics |
| `/platform/moderation` | PlatformModeration | Review queue (images & text), approve/reject. Now handles `class_title`, `class_description`, `certification` ref types in addition to the original five. |
| `/platform/subscriptions` | PlatformSubscriptions | Premium upgrade requests, active, expired. Cards now show the chosen billing-period chip (Monthly / Annual) + ₹amount-paid pill. Approve sheet's "Valid Until" is optional — leave blank and the `approve_subscription_request` RPC auto-fills from the plan's `duration_days`. |
| `/platform/sponsored` | PlatformSponsored | Sponsored / featured slot requests, calendar (admin side only — provider-facing surface still missing) |
| `/platform/providers` | PlatformProviders | Directory, suspend/reinstate, verification badge |
| `/platform/settings` | PlatformSettings | Instructor demo video + **Subscription Pricing card** (Monthly / Annual MRP + Selling Price + Active toggle with live discount %) + **Payment Details card** (UPI ID, optional UPI QR upload to `provider-media/platform/`, bank a/c, IFSC, bank name, account holder) + generic key-value editor for the rest of `platform_settings`. |

### ~~Apartment Admin~~ — **ENTIRE PERSONA REMOVED**

### Other
| Path | Page | Description |
|---|---|---|
| `/notifications` | Notifications | In-app center |
| `*` | NotFound | 404 |

---

## DATABASE SCHEMA (v2)

> PostGIS extension required: `CREATE EXTENSION IF NOT EXISTS postgis;`

### Core User Management
- **`users`** — `id (internal), auth_id (FK to auth.users.id), full_name, email, mobile_number, avatar_url, is_provider, is_platform_admin, last_active_persona, is_active, is_verified, seeker_home_address TEXT, seeker_home_location geography(Point, 4326), seeker_home_lat NUMERIC(9,6), seeker_home_lng NUMERIC(9,6)`
  - **Removed:** `is_apartment_admin`
  - `auth_id` is the *only* column compared to `auth.uid()`. `users.id` is the internal FK used by every other table.

### Family & Household
- **`families`** — `id, primary_user_id` *(no more apartment_id, flat_number, block_tower)*
- **`family_members`** — `id, family_id, full_name, date_of_birth, gender, relationship, is_active, linked_user_id`
- **`family_links`** — `id, family_id, user_id, role, accepted_at` (multi-adult linking, unchanged)
- **`family_invites`** — `id, family_id, invite_code, expires_at, accepted_by` (unchanged)

### Provider Management
- **`service_providers`** — `id, user_id (→ users.id internal), business_name, provider_type (individual/academy), bio, experience_years, qualifications TEXT, specializations, specialization_category_ids, logo_url, whatsapp_number, is_verified, home_address TEXT, home_location geography(Point, 4326), subscription_tier (basic/premium) DEFAULT 'basic', subscription_valid_until TIMESTAMPTZ, suspended_at, suspension_reason, intro_video_url, upi_id, upi_qr_image_url`
  - **Removed:** all `provider_apartment_registrations` columns
  - `intro_video_url, upi_id, upi_qr_image_url` added by migration 018b
- **`trainers`** — `id, provider_id, name, email, phone, specialization, bio, is_active` — **DEPRECATED.** Display rows were migrated into `coaches` by `20260515150000_coaches.sql`. Table kept for one release as a fallback; new code should read/write `coaches`.
- **`coaches`** — **NEW (migration 20260515150000).** `id, academy_provider_id (→ service_providers), full_name, email, phone, bio, qualifications, experience_years, specializations TEXT[], photo_url, linked_user_id (→ users — set on first login via accept_coach_invites), status ('invited'|'active'|'removed'), invited_at, accepted_at, removed_at, invited_by, created_at, updated_at`. UNIQUE index on `(academy_provider_id, LOWER(email))` for non-removed rows. RLS: academy admins full CRUD on their academy's rows; the coach themselves can SELECT their own row; active rows are public-readable so they show on `/provider-profile/:id`.
- **`coach_assignments`** — **NEW (migration 20260515150000).** `id, coach_id, scope_type ('class'|'batch'), scope_id, is_temporary, original_coach_id (for swap revert), valid_from, valid_until, status ('active'|'ended'|'scheduled'), created_by, created_at, updated_at`. Unique partial index on `(scope_type, scope_id)` WHERE status='active' — only one active coach per scope at a time.
- **`provider_subscription_requests`** — `id, provider_id, requested_tier, status (pending/approved/rejected), notes, off_app_payment_ref, requested_at, reviewed_by, reviewed_at, granted_until, billing_period ('monthly'|'annual'), amount_paid NUMERIC(10,2)`. The latter two added by `20260517120000_subscription_plans.sql`.
- **`subscription_plans`** — **NEW (migration 20260517120000).** `id, billing_period UNIQUE ('monthly'|'annual'), mrp NUMERIC(10,2), price NUMERIC(10,2), currency DEFAULT 'INR', duration_days, is_active, created_at, updated_at, updated_by`. Two rows seeded as inactive; admin enables after pricing. Public read of `is_active=true` rows; admin full CRUD.
- **`platform_payment_details`** — **NEW (migration 20260517120000).** Singleton (CHECK + UNIQUE on a `singleton BOOLEAN` flag). Columns: `id, upi_id, upi_qr_url, bank_account, ifsc, bank_name, account_holder, updated_at, updated_by`. One empty row seeded by the migration. Public read; admin CRUD.
- **`payment_reminder_log`** — **NEW (migration 20260515150000).** `id, payment_id, enrollment_id, sent_by, channel ('in_app'|'email'|'whatsapp'), notes, sent_at`. Inserted by the `send_payment_reminder` RPC each time the admin or an assigned coach taps the manual reminder button.
- **`certifications`** — `id, owner_type ('provider'|'trainer'), provider_id, trainer_id, coach_id, name, issuing_authority, year_obtained, image_url, moderation_status, moderation_notes, created_at`. Max 5 per owner. `coach_id` was added by `20260515150000_coaches.sql` and existing `trainer_id` values were mirrored across. The seeker-facing `useSeekerTrainerCertifications` hook queries on `coach_id OR trainer_id` for back-compat.
- **`category_requests`** — **NEW (migration 028).** `id, provider_id, request_type ('new_category'|'new_subcategory'), parent_category_id, requested_name, requested_icon, requested_subcategories TEXT[], description, status ('pending'|'approved'|'rejected'|'retag_pending'|'retag_declined'), admin_notes, admin_modified_name, admin_modified_icon, retag_category_id, reviewed_by, reviewed_at, created_category_id, requested_at, updated_at`. Replaces the older `022_category_requests_and_certifications.sql` request shape — re-created in 028 with retag flow + RPC helpers (`approve_category_request`, `reject_category_request`, `retag_category_request`, `respond_to_category_retag`).

### Classes & Curriculum
- **`class_categories`** — `id, name, slug, icon, parent_id, sort_order, is_active`
- **`classes`** — `id, provider_id, category_id NULLABLE, pending_category_request_id, title, description, short_description, status (draft/published/paused/archived), age_min, age_max, skill_level, trial_available, trial_fee, images TEXT[], cover_image_url, tags TEXT[], address TEXT, location geography(Point, 4326), location_lat NUMERIC(9,6), location_lng NUMERIC(9,6), is_home_based BOOLEAN DEFAULT false, home_radius_km NUMERIC(6,2) DEFAULT 5, facebook_url, instagram_url, twitter_url, moderation_status (pending/approved/rejected/in_review) DEFAULT 'pending', moderation_notes, total_rating, rating_count, created_at`
  - **Removed:** `provider_registration_id`, `is_featured` (now via sponsored_listings)
  - **Direct FK:** `provider_id → service_providers(id)`
  - **`category_id` is NULLABLE** when a class is awaiting category approval; `pending_category_request_id` points at the open request. The `approve_category_request` RPC backfills both columns when the admin approves.
- **`batches`** — `id, class_id, name, capacity, current_enrollment_count, status ('active'|'full'|'paused'|'completed'|'cancelled'), start_date, end_date, grades TEXT[]` (migration 20260512070202 added grades multi-select). `current_enrollment_count` and `status` are auto-maintained by the `sync_batch_enrollment_count` trigger (migration 027) — never write to these columns directly.
- **`batch_schedules`** — unchanged
- **`class_addons`** — unchanged

### Trials
- **`demo_sessions`** — `class_id, date, start_time, end_time, max_capacity, location TEXT` (location text inherited from class; no separate geo)
- **`demo_registrations`** — unchanged

### Enrollments
- **`enrollments`** — unchanged
- **`waitlist_entries`** — unchanged

### Attendance & Payments
- **`attendance_records`** — unchanged
- **`payments`** — unchanged structure; `payment_type` enum loses `admin_fee` (drop value), gains nothing
  - **Removed:** `admin_fee_payments` table entirely

### Engagement & Content
- **`reviews`** — unchanged
- **`announcements`** — unchanged
- **`chat_conversations`** — unchanged
- **`chat_messages`** — unchanged
- **`notifications`** — unchanged
- **`class_materials`** — unchanged

### Sponsored & Featured Listings (v2 replacement for `featured_class_listings`)
- **`sponsored_listings`** — `id, class_id, provider_id, status (pending/approved/active/expired/rejected/cancelled), slot_position SMALLINT (computed at query time by `sponsored_for_location`, NOT persisted by the cron), category_id NULLABLE, valid_from, valid_until, impression_count, click_count, off_app_payment_ref, rejection_reason, requested_at, reviewed_by, reviewed_at`.
  - **Removed by migration 034**: `center_address`, `center_location`, `radius_km`. The slot is now scoped to the class's own location; no separate region.
  - Read via SECURITY DEFINER RPC `sponsored_for_location(p_lat, p_lng, p_category_id)` — handles distance ranking + slot-position assignment per region. Counter writes go through `increment_sponsored_impression(p_id)` / `increment_sponsored_click(p_id)` RPCs (no-op on inactive rows so the client can fire optimistically).
- **`featured_banners`** — `id, provider_id, class_id, surface ('explore_banner' only — `home_banner` was hard-removed by migration 033), image_url, target_url, center_address, center_location geography(Point, 4326), radius_km NUMERIC, status, moderation_status, valid_from, valid_until, click_count, impression_count, rejection_reason, requested_at, reviewed_by, reviewed_at`.
  - Surface enum was originally `{home_banner, explore_banner}`; the home variant was dropped in migration 033 along with its branched CHECK constraint. The frontend still references `home_banner` in some type unions for backward compat but `useFeaturedBannersForLocation` short-circuits and `BannerRequestSheet` always submits `explore_banner`.
  - Read via SECURITY DEFINER RPC `featured_banners_for_location(p_lat, p_lng, p_surface)`. Counter writes via `increment_banner_impression(p_id)` / `increment_banner_click(p_id)` (also no-op on inactive rows).
  - Banner image goes through `ai-moderate-content` (ref_type='banner') immediately after the row insert in `ProviderSponsored.tsx`'s banner request sheet.
- **Lifecycle cron**: `refresh-sponsored-slots` edge fn calls `refresh_sponsored_lifecycle()` RPC every 15 min. The RPC handles BOTH tables in one transaction: `status='approved' AND valid_from ≤ NOW() ≤ valid_until → 'active'`; `status IN ('approved','active') AND valid_until < NOW() → 'expired'`.

### Moderation
- **`moderation_flags`** — `id, ref_type, ref_id, content_snapshot TEXT, image_url TEXT, ai_provider (sightengine/gemini/openai), ai_score NUMERIC, ai_categories JSONB, status (in_review/approved/rejected), reviewed_by, reviewed_at, action_notes, created_at`
  - **`ref_type` values:** `class_image`, `class_text`, `provider_avatar`, `provider_bio`, `banner`, `class_title`, `class_description`, `certification` (latter three added in migration 20260513055502).
  - `ai_provider = 'gemini'` for text moderation (migration 017).

### Configuration
- **(Removed:** `apartment_complexes`, `apartment_admins`, `provider_apartment_registrations`, `admin_fee_payments`, `platform_fee_config`, `featured_class_listings`)
- **`referrals`** — kept for future
- **`platform_settings`** — **NEW.** Key-value config (moderation thresholds, default radius, sponsored slot count, etc.)

---

## DATABASE MIGRATIONS

v1 migrations (001–028) archived in `supabase/migrations/_archive_v1/` and **not run on fresh DBs**. v2 reuses the existing Supabase project — `000_wipe_v1.sql` resets the public schema before the baseline lands.

| # | File | Purpose |
|---|---|---|
| 000 | `000_wipe_v1.sql` | One-time: `DROP SCHEMA public CASCADE`, restore grants, wipe v1 storage buckets + policies. **Irreversible — take backup first.** |
| 001 | `001_baseline_v2.sql` | Full v2 schema, enables PostGIS, GIST indexes |
| 002 | `002_rls_v2.sql` | RLS for every table — location-aware, subscription-aware |
| 003 | `003_storage_buckets_v2.sql` | Buckets + storage RLS |
| 004 | `004_subscription_helpers.sql` | `is_premium(provider_id)`, request RPCs |
| 005 | `005_moderation_helpers.sql` | `submit_for_moderation()`, `resolve_moderation_flag()` |
| 006 | `006_geo_helpers.sql` | `nearby_classes(seeker_loc, radius_km, category_id?)` SECURITY DEFINER, sponsored injection |
| 007 | `007_seed_categories.sql` | Initial category tree |
| 008 | `008_fix_uuid_defaults.sql` | Fix UUID default expressions |
| 009 | `009_grant_role_privileges.sql` | Grant SELECT/INSERT/UPDATE/DELETE to `anon`/`authenticated` on all public tables + default privileges for future tables |
| 010 | `010_add_seeker_location_columns.sql` | Add `seeker_home_address` (TEXT) + `seeker_home_location` (geography Point 4326) + GIST index to `public.users`. Enables PostGIS if not active. Run if live DB was provisioned before these columns were in the baseline. |
| 011 | `011_fix_families_rls.sql` | Hotfix for `families` INSERT 42501 RLS error: recreates `current_user_id()` helper, makes `families.apartment_id` nullable (v1→v2 compat), replaces INSERT policies on `families` and `family_links` with inline-subquery versions, adds `accepted_at` to `family_links` if absent. |
| 012 | `012_create_family_rpc.sql` | `create_own_family()` SECURITY DEFINER RPC — creates (or returns) the caller's family + primary `family_link` row, bypassing the RLS chicken-and-egg on `families` INSERT. Idempotent. Called by `useCreateFamily` hook instead of direct INSERT. |
| 013 | `013_family_members_v2_compat.sql` | v1→v2 compat for `family_members`: renames `name` → `full_name`, updates `age_group` CHECK to include 'infant', updates `gender` CHECK to v2 values, recreates INSERT RLS policy to allow family owners/linked users to add members. |
| 014 | `014_fix_rls_v2_compat.sql` | Comprehensive RLS repair for hybrid v1/v2 DB state. Drops all conflicting v1+v2 named policies and recreates them with schema-aware DO blocks that detect column existence (e.g. `participant_ids` vs `participant_1/2` in chat, `provider_id` vs `provider_registration_id` in classes, `moderation_status` presence). Key fixes: classes SELECT no longer requires apartment registration; `is_in_family()` SECURITY DEFINER helper recreated; users SELECT extended for chat participants; all affected tables re-granted anon/authenticated privileges. |
| 015 | `015_delete_family_member.sql` | Soft-delete support for family members. Adds `deleted_at TIMESTAMPTZ` to `family_members`. Creates `delete_family_member(UUID)` SECURITY DEFINER RPC: validates caller is in the family, sets `is_active=false` + `deleted_at=now()`, auto-drops active/pending enrollments to `'dropped'` with `drop_reason`, notifies each provider via `send_notification`, cancels `demo_registrations` (→`'cancelled'`), cancels `waitlist_entries` (→`'cancelled'`). Schema-aware: detects v1 (`provider_registration_id` path) vs v2 (`provider_id` direct) for the provider notification join. GRANT EXECUTE to `authenticated`. |
| 016 | `016_categories_rls_and_seed.sql` | Fixes `class_categories` returning empty for all users: drops stale SELECT policies, creates `categories_public_select` policy (SELECT where `is_active=true OR is_active IS NULL`), upserts all 10 v2 top-level categories with Lucide icon names matching the frontend `CATEGORY_ICONS` map, GRANTs SELECT to `anon` + `authenticated`. Uses v2 column names (`icon`, `parent_id`, `sort_order`). |
| 017 | `017_moderation_gemini_provider.sql` | Phase 3: Extends `moderation_flags.ai_provider` CHECK constraint to include `'gemini'` (Phase 3 edge function uses Google Gemini for text moderation, not OpenAI). Drops + recreates the constraint idempotently. |
| 018a | `018_provider_student_visibility.sql` | Adds RLS policy `users_provider_enrollers_select` + `family_members_provider_enrolled_select` so providers can read names of their enrolled students / seekers. **Caused recursion bug** (fixed in 019b/020b). |
| 018b | `018_service_providers_missing_columns.sql` | Adds `intro_video_url, upi_id, upi_qr_image_url` to `service_providers`. Fixes 400 errors on POST. |
| 019a | `019_align_classes_batches_schema.sql` | Adds `short_description`, `cover_image_url`, missing batch columns. Fixes 400 errors on POST `/classes` and `/batches`. |
| 019b | `019_fix_users_rls_recursion.sql` | **Hotfix for 018a.** PG inlined `current_user_id()` (STABLE SECURITY DEFINER) into the `users_provider_enrollers_select` policy, producing infinite recursion. Replaces with `auth_id = auth.uid()` inline subqueries. |
| 020a | `020_align_remaining_tables.sql` | Adds missing columns across payments, enrollments, reviews, demo_sessions, family_members, trainers, class_materials, announcements, chat_conversations. |
| 020b | `020_provider_student_names_rpc.sql` | Replaces the recursive provider-students RLS approach with a SECURITY DEFINER RPC `get_provider_enrolled_student_names(provider_id)` that returns names without triggering RLS on `users` / `family_members`. |
| 021 | `021_add_class_location_fields.sql` | Denormalized lat/lng columns on `classes` and `users`; `classes.home_radius_km`. Lets the frontend read coordinates as numbers instead of WKB hex. |
| 022 | `022_category_requests_and_certifications.sql` | First pass at `category_requests` + `certifications` tables. (Superseded by migration 028 for category_requests; certifications schema persists.) Makes `classes.category_id` NULLABLE; adds `classes.pending_category_request_id`. |
| 023 | `023_add_social_links_to_classes.sql` | Adds `facebook_url`, `instagram_url`, `twitter_url` to `classes`. |
| 024 | `024_public_class_detail_rls.sql` | Grants `anon` SELECT on `service_providers`, `users`, `trainers`, `batches`, `batch_schedules`, `class_categories` (already public), and selective `classes` columns — so the public `/class/:classId` page renders without auth. |
| 025 | `025_platform_settings_trust_marker_defaults.sql` | Seeds default thresholds for the "New" and "Popular" class-card trust markers into `platform_settings`. Frontend re-reads every 5 min. |
| 026 | `026_ensure_self_family_member.sql` | Idempotent `ensure_self_family_member()` RPC. Resolves internal `users.id` from `auth.uid()` *first*, then creates/returns the caller's `relationship='self'` family-member row. Called from `StepLocation` and lazily from `EnrollFlow`. |
| 027 | `027_enrollment_count_trigger.sql` | Adds `sync_batch_enrollment_count` SECURITY DEFINER trigger on `enrollments` INSERT/UPDATE/DELETE. Recomputes `batches.current_enrollment_count` and flips `batches.status` between `active`/`full`. Includes one-time backfill. |
| 028 | `028_category_requests.sql` | Recreates `category_requests` with retag flow + RPC helpers (`approve_category_request`, `reject_category_request`, `retag_category_request`, `respond_to_category_retag`). Safe to re-run (DROP TABLE CASCADE first). Apply manually in Supabase SQL editor. |
| 029a | `029_learner_drop_and_switch.sql` | Learner-initiated drop + batch-switch flow. Adds `enrollments.pending_switch_to_batch_id` (a **second FK** to batches — see PostgREST FK gotcha) + `switch_requested_at`. Extends the seat-count trigger to fire on `batch_id` changes. RPCs: `learner_drop_enrollment`, `learner_request_batch_switch`, `provider_approve_batch_switch`, `provider_reject_batch_switch`. |
| 029b | `029_sponsored_listings_extend.sql` | Phase 8: adds `impression_count`, `click_count`, `category_id`, `cancelled` status value to `sponsored_listings`. |
| 030 | `030_featured_banners_extend.sql` | Phase 8: adds `surface ∈ {home_banner, explore_banner}`, `center_address`, `center_location geography`, `radius_km`, `moderation_status` to `featured_banners`. Branched CHECK constraint: home_banner requires NULL region, explore_banner requires region. |
| 031 | `031_sponsored_rpcs.sql` | Phase 8 read + counter RPCs: `sponsored_for_location(lat,lng,category)`, `featured_banners_for_location(lat,lng,surface)`, `increment_sponsored_impression`, `increment_sponsored_click`, `increment_banner_impression`, `increment_banner_click`, `refresh_sponsored_lifecycle`. All SECURITY DEFINER. |
| 032 | `032_sponsored_settings_seed.sql` | Seeds `platform_settings` with `sponsored.slots_per_category` JSON (default `{"_default": 3}`). Used by `sponsored_for_location` to cap rows per category per region. |
| 033 | `033_drop_home_banner_surface.sql` | Hard-removes the `home_banner` surface from `featured_banners`. Cancels all non-terminal home-banner rows, drops the branched CHECK, converts CHECK to `surface = 'explore_banner'`. All banners are now explore-only. |
| 034 | `034_sponsored_drop_region_columns.sql` | Drops `center_address`, `center_location`, `radius_km` from `sponsored_listings`. The slot is scoped to the class's own location now; no separate region. |
| 035 | `035_sponsored_for_location_rewrite.sql` | Rewrites the `sponsored_for_location` RPC after migration 034: distance is computed against the class location, slot positions are assigned per category region at query time (no need to persist `slot_position`). |
| L1 | `20260505020104_*.sql`, `20260505062625_*.sql` | Lovable schema-touch no-ops (force types regeneration). |
| L2 | `20260512070202_*.sql` | Adds `batches.grades TEXT[] NOT NULL DEFAULT '{}'` for the grade multi-select on CreateBatch. |
| L3 | `20260512072126_*.sql` | Fixes `category_requests` RLS to resolve `provider_id` via `service_providers.user_id = current_user_id()` (was comparing to `auth.uid()`, causing 403 on insert). |
| L4 | `20260513051521_*.sql` | Same fix for `certifications` `providers_manage_own_certs` policy. |
| L5 | `20260513055502_*.sql` | Extends `moderation_flags.ref_type` CHECK to include `class_title`, `class_description`, `certification`. |
| L6 | `20260513060707_*.sql` | Fixes admin RLS on `category_requests` (was comparing `users.id` to `auth.uid()` — should be `auth_id`); refines `approve_category_request` RPC to backfill `classes.category_id` and clear `classes.pending_category_request_id` for any class that was waiting on the request. |
| L7 | `20260515150000_coaches.sql` | **Coaches feature (mandatory for the Premium academy team workflow).** Creates `coaches`, `coach_assignments`, `payment_reminder_log`; copies legacy `trainers` rows into `coaches` (status='active', `linked_user_id=NULL` until invited); mirrors `certifications.trainer_id → coach_id`; adds SECURITY DEFINER helpers (`current_coach_ids`, `current_academy_provider_ids`, `is_coach_of_class`, `is_coach_of_batch`, `is_academy_member`); extends RLS on `classes`, `batches`, `attendance_records`, `payments`, `enrollments`, `class_materials`, `announcements` to include the coach branch; adds RPCs (`invite_coach`, `assign_coach`, `end_coach_assignment`, `remove_coach`, `accept_coach_invites`, `revert_expired_coach_assignments`, `send_payment_reminder`). Re-runnable. **Apply manually before testing.** |
| L8 | `20260516120000_coach_student_names.sql` | Widens `get_provider_student_names` RPC's security guard so a coach assigned to a batch can read student + seeker names for it, not just the academy owner. **Defensively detects whether `is_coach_of_batch` exists** before referencing it, so it's safe to apply before or after L7. |
| L9 | `20260517120000_subscription_plans.sql` | Creates `subscription_plans` (monthly + annual rows, seeded inactive) and `platform_payment_details` singleton. Adds `billing_period` + `amount_paid` to `provider_subscription_requests`. Rewrites `request_premium_upgrade` RPC to require/validate the plan + amount, and `approve_subscription_request` to derive `subscription_valid_until` from the request's billing period when admin doesn't override. Drops the legacy 3-arg `request_premium_upgrade` signature. |

---

## SUPABASE EDGE FUNCTIONS

| Function | Purpose |
|---|---|
| `ai-moderate-content` | **Phase 3 — DEPLOYED.** Receives `{ref_type, ref_id, owner_user_id, text?, image_url?}`. Images → Sightengine (nudity-2.1, offensive, weapon, recreational_drug); score ≥0.85 → rejected, 0.45–0.85 → in_review, <0.45 → approved. Text → Gemini gemini-2.0-flash safetyRatings; any HIGH → rejected, any MEDIUM → in_review, all LOW/NEGLIGIBLE → approved. Calls `submit_for_moderation` RPC (service_role), which mirrors status to source row and notifies owner on rejection. Returns `{status, flagId}`. |
| `refresh-sponsored-slots` | **NEW.** Cron — expires past `valid_until`, recalculates active slot positions per region. |
| `revert-expired-coach-assignments` | **NEW (May 2026).** Daily cron — calls `revert_expired_coach_assignments()` RPC which ends `coach_assignments` rows whose `valid_until` has passed and reinstates the `original_coach_id` for temporary swaps. Must be scheduled in Supabase cron (suggested `0 2 * * *` IST). |
| `check-pending-invites` | Family invite monitor (unchanged) |
| `expire-family-invites` | 24-h auto-expire (unchanged) |
| `expire-waitlist-offers` | Waitlist offer timeout (unchanged) |
| `generate-payment-reminders` | Cron payment-due notifications — **Premium-gated** (only fires for Premium providers' batches) |
| `handle-invite-accept` | Invite acceptance (unchanged) |
| `process-waitlist` | Auto-offer next position (unchanged) |
| `send-notifications` | Batch notification delivery (unchanged) |

---

## STORAGE BUCKETS

| Bucket | Purpose |
|---|---|
| `avatars` | User profile pictures (moderated) |
| `class-images` | Class cover photos (moderated) |
| `provider-media` | Provider business media (moderated) |
| `payment-screenshots` | Payment proof |
| `class-materials` | Student resources |
| `featured-banners` | **NEW** — Premium provider banner artwork (moderated) |
| ~~`invoices`~~ | **REMOVED** — no admin fee invoices |

---

## KEY PATTERNS & CONVENTIONS

### Data Fetching
- TanStack Query v5; explicit `.select()` with named columns; never `select('*')`.
- Avoid PostgREST nested-filter dot notation across 3+ tables — use step-by-step queries or RPC.
- Realtime for chat + notifications.
- **Geo queries go through RPC** (`rpc('nearby_classes', {...})`) — PostgREST cannot do PostGIS predicates inline.
- **PostgREST FK disambiguation:** when a table has more than one FK pointing at the same target (e.g. `enrollments.batch_id` + `enrollments.pending_switch_to_batch_id` both → `batches`, added in migration `029_learner_drop_and_switch.sql`), a bare `batches(...)` embed throws *"Could not embed because more than one relationship was found"* and the query returns zero rows silently. **Always spell the FK column** in such embeds:
  ```ts
  .select(`id, batch_id, batches!batch_id(id, batch_name, ...)`)
  ```
  Affected hooks (already fixed): `useProviderEnrollments`, `useRemovedEnrollments`, `useMyEnrollments`, `useEnrollmentDetail`, `useEnrollmentGrowth`, `useProviderRevenue`. Watch for this whenever a new FK to a "popular" table is added.

### RLS (Row Level Security)
- Every table has policies. Patterns:
  - **Seeker-readable:** `classes.status = 'published' AND moderation_status = 'approved'` (no apartment filter)
  - **Provider-owned:** rows joined to `service_providers.user_id = auth.uid()`
  - **Premium-gated mutations:** check `is_premium(provider_id)` SECURITY DEFINER helper before allowing inserts on `payments` (in-app collection), `featured_banners`, `sponsored_listings`
  - **Platform admin:** `users.is_platform_admin = true`
- SECURITY DEFINER helpers replace recursive joins. Key helpers in v2:
  - `is_premium(provider_id)`
  - `is_provider_owner(provider_id)`
  - `nearby_classes(seeker_loc, radius_km, category_id?)`
  - `get_pending_moderation_count()` (admin dashboard)
  - **Coach helpers (migration 20260515150000):**
    - `current_coach_ids()` → SETOF UUID of the caller's active coach rows
    - `current_academy_provider_ids()` → SETOF UUID combining owned providers + academies where the caller is an active coach
    - `is_coach_of_class(class_id)` / `is_coach_of_batch(batch_id)` → BOOL, true if the caller has an active assignment covering that scope (class-level assignment covers all its batches)
    - `is_academy_member(provider_id)` → BOOL, true if owner OR active coach at that academy. Used by the `classes_coach_select` / `batches_coach_select` read-only-on-other-academy-data policies.

### Notifications
- `send_notification(p_user_id, p_title, p_body, p_type, p_ref_type, p_ref_id)` RPC unchanged.
- New notification types: `subscription_approved`, `subscription_rejected`, `sponsored_approved`, `sponsored_rejected`, `content_flagged`, `content_rejected`.

### Forms
- Zod + RHF; loading/error/success states.
- **Address fields** use `<MapplsPicker />` which returns `{address, lat, lng}` and writes both columns.

### UI
- shadcn/ui base.
- Loading skeleton + empty + error+retry on every list.
- React.forwardRef + displayName everywhere.
- **Premium-gated UI** wraps in `<PremiumGate fallback={<UpgradeCTA/>}>`.
- **Moderation status** rendered as `<ModerationStatusBadge status={...} />`.

### State Management
- UserContext provides: `session, user, profile, family, familyMembers, providerProfile, coachProfiles, isCoach, isPremium, activePersona, familyRole, familyLinkId, profileError, activatePersona, refreshProfile, refreshFamily`.
  - **Removed:** `currentApartment`, `apartments`.
- Route-based persona sync via `useLocation` + ref-guarded `useEffect`. `/provider/*` paths flip `activePersona='provider'` when **either** `profile.is_provider` OR `coachProfiles.length > 0` is true.
- On every session start, `fetchCoachProfiles` runs `accept_coach_invites` RPC (links any `coaches.email` matching the session email to the user, flips them to `status='active'`) and then loads the resulting coach rows into `coachProfiles`.
- AuthGuard keeps the loading splash up while `loading` is false but `profile` is still null — this prevents `/provider/*` (and other protected routes) bouncing to `/` on first paint when the Supabase auth callback flips `loading=false` before `fetchOrCreateProfile` resolves. Coaches get through the provider guard via the `canAccessProvider = profile.is_provider || isCoach` check.

### TypeScript
- Strict mode.
- Auto-generated Supabase types in `src/integrations/supabase/types.ts` — regenerate after every migration.
- Custom types in `src/types/database.ts`.

---

## PERSONA FEATURES SUMMARY

### Seeker
- Onboarding: profile → **location picker (MapMyIndia)** → family → role
- Explore with **radius slider**, category/age filters, search; sponsored top-3 with "Featured" badge
- Distance shown on every class card
- Class detail, provider profile, reviews
- Enroll family members, addon selection
- Track enrollments, attendance, payments, materials
- Family account linking
- In-app chat, demo bookings, notifications
- Set/update home location from `/profile`

### Provider — Basic (Free)
- Self-onboard, auto-approved
- Class create/edit with **per-class location** + home-based checkbox
- Batch scheduling, capacity, pricing
- Mark attendance (today + past)
- Record payments (track-only — no in-app collection) + manual "Send Reminder" button per pending payment
- Post announcements, upload materials, manage demos
- View basic analytics, reviews
- Chat with seekers
- See "Upgrade to Premium" CTAs (3-step benefits → plan → payment sheet) and, for Academy providers specifically, an "Onboard Coaches — Premium" dashboard upsell

### Provider — Premium (Paid; manually granted in MVP)
- Everything in Basic, plus:
- **In-app payment collection** + automated reminder cron (`generate-payment-reminders`)
- **Onboard Coaches** *(academy only)* — invite by name + email, assign class- or batch-scope, optional temporary swaps with auto-revert
- **Advanced analytics:** competitor analysis (location/category/pricing), revenue trend, retention, growth insights
- **Sponsored listing requests** (top-3 in nearby explore)
- **Featured banner placements**
- Premium badge on profile

### Coach (a sub-role, not a separate persona)
- Lives entirely under the provider surface; activated automatically when an academy admin invites a user's email and that user signs in. No separate signup flow.
- `coaches.linked_user_id` is the canonical link; `accept_coach_invites` RPC runs on every session and matches by `LOWER(email)`.
- Sees the Instructor option in PersonaSwitcher even without `is_provider`, and shows a "Coach" badge in the Header.
- Dashboard, students, attendance, payments, materials, announcements are all **scoped** via `useEffectiveProviderContext` (UNION of class-level + batch-level assignments) and the matching RLS policies. Read-only on other academy classes via `is_academy_member`.
- Can mark attendance, send manual payment reminders, and manage their own assigned content. Cannot create classes, edit pricing, request Premium, manage subscription, or manage other coaches.

### Platform Admin
- Global dashboard (active providers, classes, enrollments by city/category)
- Categories (hierarchical) + category-request approval (`approve_category_request`, retag flow)
- Platform-wide analytics & growth metrics
- **Moderation queue** — review flagged images & text, approve/reject/escalate
- **Subscriptions** — review Premium upgrade requests (now showing chosen plan + ₹amount paid), approve via `approve_subscription_request` RPC (auto-derives expiry from billing period if no override)
- **Sponsored slots** — review requests, approve with valid-from/until + radius, monitor active slots
- **Providers directory** — suspend/reinstate, verify, mark trusted
- **Settings** — instructor demo video, **Monthly + Annual subscription pricing** (MRP, Selling Price, Active toggle), **Payment Details** (UPI ID + QR upload, bank account, IFSC, bank name, account holder), plus generic key-value editor for the rest of `platform_settings`

### ~~Apartment Admin~~
- **Removed in v2.**

---

## IMPORTANT IMPLEMENTATION NOTES

### Provider Onboarding (v2)
Self-serve. On submission, `service_providers` row created with `subscription_tier = 'basic'`. No registration table, no admin queue. The first class submission triggers the moderation flow.

### Class Publish Flow (v2)
1. Provider creates class via **5-step wizard**: Category → Details (title, description, age range, skill level, trial) → Location (mandatory MapplsPicker) → Schedule + social links (FB/IG/Twitter) → Review.
2. If the desired category does not exist, the provider can open `CategoryRequestSheet` and submit a new-category / new-subcategory request. The class is saved with `category_id = null` and `pending_category_request_id` populated; it cannot publish until the admin approves the request (then `approve_category_request` backfills both columns automatically).
3. On "Publish": every image and text field submitted to `ai-moderate-content` (ref_type values: `class_title`, `class_description`, `class_image`, `certification`).
4. If all auto-approve → `status = published, moderation_status = approved`.
5. If any rejected → `status = draft, moderation_status = rejected`, provider notified, edit-and-retry available.
6. If any in_review → `status = draft, moderation_status = in_review`, awaits platform admin.

### Category Request Flow
1. Provider taps "Suggest a category" inside CreateClass (or visits `/provider/categories`).
2. Picks `request_type`: `new_category` (with icon picker + optional sub-category list) or `new_subcategory` (under an existing parent).
3. `category_requests` row inserted with `status='pending'`.
4. Admin at `/platform/categories` reviews. Options: **Approve** (may edit name/icon), **Reject** (with reason), **Retag** (map provider's request to an existing category — provider then accepts or declines via `respond_to_category_retag`).
5. On approve → new category created with auto-slug; any pending sub-categories created under it; classes that reference the request get their `category_id` backfilled; provider notified.

### Nearby Search Integration
`useClasses` hook reads `classes` rows along with the denormalized `location_lat` / `location_lng` columns and computes distance client-side via haversine for the explore list. The PostGIS `nearby_classes` RPC remains the canonical server-side filter for large data sets (kept in place even though current MVP volumes don't require it). Sponsored slots are fetched separately via `useActiveFeaturedListings` (in `useFeatured.ts`) and merged into top-3 positions — the merge UI surface is partial in `Explore` and still scheduled for Phase 8 polish.

### Trust Markers
Class cards show "New" (≤ N days old, threshold in `platform_settings`) and "Popular" (≥ N enrollments / views) badges. Thresholds seeded by migration 025; frontend re-reads `platform_settings` every 5 minutes.

### Seat Counts
Never write `batches.current_enrollment_count` or flip `batches.status` between `active`/`full` from app code — the `sync_batch_enrollment_count` trigger (migration 027) does this on every enrollment INSERT/UPDATE/DELETE. Mutations on enrollments must invalidate the `["batches", classId]` and `["batch-students", batchId]` query keys to refresh the UI.

### Public Class Detail Page
`/class/:classId` is anonymous-accessible (migration 024 grants `anon` SELECT on `classes`, `service_providers`, `users`, `trainers`, `batches`, `batch_schedules`). Shareable links go through this URL. Sensitive user columns (email, mobile, home_address) must never be in the column list of a query rendered on this page.

### Premium Provisioning Workflow (May 2026 — plan-based)
Three-step `<UpgradeRequestSheet>` on `/provider/dashboard` and `/provider/subscription`:

1. **Benefits** — hero card + 7 benefit cards (in-app payments, automated reminders, Coach onboarding, advanced analytics, competitor analysis, sponsored listings, featured banners) with icon, title, description, and a real-world example each. CTAs: *Continue to Upgrade* / *Maybe later*.
2. **Plan picker** — reads `subscription_plans` where `is_active=true`. Renders Monthly + Annual cards with big selling price, struck-through MRP when there's a discount, "Save ₹X (Y%)" emerald pill, monthly-equivalent line on annual, "Best value" pill when annual beats monthly. Auto-selects the bigger-discount plan. If no plans are active, shows a **"Premium pricing is being finalised"** coming-soon card and blocks submission.
3. **Payment** — reads `platform_payment_details` (UPI ID + optional QR + bank a/c). Shows the exact `Pay ₹X` headline, payment-reference input (UPI TXN / UTR), optional notes. Submit calls `request_premium_upgrade(provider_id, notes, off_app_payment_ref, billing_period, amount_paid)` — the RPC validates `amount_paid` matches the active plan's `price` (±1 INR tolerance) and rejects if no pending-request guard fails.

Platform admin queue (`/platform/subscriptions`):
- Each request card shows a Monthly/Annual chip and ₹amount-paid pill alongside the existing payment reference + notes.
- Approve sheet's "Valid Until" date is **optional** — leaving it blank triggers `approve_subscription_request(request_id, NULL)` which reads the request's `billing_period`, looks up the plan's `duration_days`, and sets `subscription_valid_until = NOW() + (30 | 365) days`. Admin can still pass an explicit date to override.
- Approve RPC also flips `service_providers.subscription_tier='premium'` and fires a `subscription_approved` notification with the expiry date.

Sponsored slot + featured banner requests follow the same admin-queue pattern but against `sponsored_listings` / `featured_banners` directly (no separate request table; the row's `status` is the workflow).

### Coach Onboarding & Scope (May 2026)
Premium-only for academy providers (`provider_type='academy' AND subscription_tier='premium'`). Wrapped in `<PremiumGate>` so Basic academies see an upgrade CTA instead.

**Invite flow** (`/provider/coaches`):
1. Admin enters name + email + optional bio/phone/qualifications/experience.
2. `invite_coach` RPC inserts a `coaches` row with `status='invited'`. If the email already matches a `users.email`, `linked_user_id` is set and status flips straight to `'active'`.
3. On the invited user's next login, `accept_coach_invites` RPC (called from `UserContext.fetchCoachProfiles`) matches `LOWER(email)` and activates them. They land on `/provider/dashboard` with a "Coach" badge in the Header.

**Assignment scope** (UNION semantics — class assignment covers all its batches; batch assignments add specific batches across classes):
- `assign_coach(coach_id, scope_type, scope_id, is_temporary?, valid_from?, valid_until?)` RPC.
- A unique partial index on `coach_assignments(scope_type, scope_id) WHERE status='active'` ensures only one active coach per scope at a time. Re-assigning ends the previous active row.
- For temporary swaps (`is_temporary=true`), the row's `original_coach_id` is set to whoever was active before, and the daily cron (`revert-expired-coach-assignments`) reinstates them when `valid_until` passes.

**RLS coach branch** — every operational table that previously only allowed the owner now also accepts the assigned coach via the SECURITY DEFINER helpers listed above. Read-only on other academy classes via `is_academy_member`; edit/insert restricted to scoped batches via `is_coach_of_batch`.

**Page scoping** — `useEffectiveProviderContext()` returns `{ providerId, role, isAdmin, isCoach, scopedClassIds, scopedBatchIds }`. Owner short-circuits to admin context immediately when `providerProfile.id` is set. Pages that need scope (`ProviderDashboard`, `ProviderStudents`, `CoachesManagement`, etc.) call `resolveCoachScopedIds` server-side (single SELECT against the academy's classes + batches, then client-side UNION filter). **Pitfall to avoid:** `if (scopedBatchIds)` is `true` for `[]` in JS — never use that to gate filtering; always check `if (scopedBatchIds && scopedBatchIds.length > 0)` or apply the union explicitly.

**Removal** — `remove_coach(coach_id)` ends all active assignments and marks the coach `status='removed'`. Historical attendance, payment reminders, and audit data stay intact.

### Send Payment Reminder (manual button)
`/provider/payments` shows a "Send Reminder" outline button on every `status='recorded'` row. Calls `send_payment_reminder(payment_id, notes?)` which:
1. Authorizes the caller (academy owner OR `is_coach_of_batch(enrollment.batch_id)`).
2. Inserts a `payment_reminder_log` row (channel='in_app' for now).
3. Fires a `payment_reminder` notification to the payer (`payments.user_id`) with the amount and class title.

The existing `generate-payment-reminders` cron continues to fire automatically for Premium providers' batches — both routes coexist.

### Family Account Linking (unchanged from v1)
Multiple adults link to a single family. Primary member sends invite link. Linked members get equal access. See `CLAUDE-PHASE2-FAMILY-LINKING.md`.

### Self-Enrollment
Onboarding's `StepLocation` calls `ensure_self_family_member()` (SECURITY DEFINER RPC, migration 026) to guarantee the caller's family + `relationship='self'` family-member row exist before they can ever land on EnrollFlow. The RPC resolves internal `users.id` from `auth.uid()` first, then creates/returns idempotently.

### Provider RLS Resolution Pattern
Any policy or RPC that scopes by provider ownership **must** resolve `service_providers` via `users.auth_id = auth.uid()`, not by comparing `service_providers.user_id` directly to `auth.uid()`. The latter is the most common source of 403/406 errors. Reference shape:

```sql
provider_id IN (
  SELECT sp.id FROM public.service_providers sp
  JOIN public.users u ON u.id = sp.user_id
  WHERE u.auth_id = auth.uid()
)
-- or simply
provider_id IN (
  SELECT id FROM public.service_providers WHERE user_id = public.current_user_id()
)
```

`public.current_user_id()` is the canonical SECURITY DEFINER helper. **Do not** inline a STABLE function returning `auth.uid()`-resolved `users.id` into a policy on `public.users` itself — PG will detect recursion (see migration 019b post-mortem).

### Attendance Date Awareness (unchanged)
`useBatchEnrolledStudents(batchId, date?)`:
- **Today:** `status = 'active'` only
- **Past dates:** `status IN ('active','completed','dropped','paused')` with `enrolled_at <= date`, client-side filters dropouts before the target date

### MapMyIndia (Mappls) Integration
- API key stored in `.env` as `VITE_MAPPLS_API_KEY` (client SDK key) and `MAPPLS_REST_KEY` (server key for edge functions if needed)
- `<MapplsPicker>` props: `value: {address, lat, lng} | null`, `onChange(value)`. Renders map + autocomplete combo. Returns reverse-geocoded address on map drag. Includes a **"Use My Location" GPS button** (outside the map canvas; zoom 17).
- `useLocation()` hook exposes `geocodeAddress(address)`, `reverseGeocode(lat, lng)`, `formatDistance(km)`, `useUpdateSeekerLocation()` mutation.

### Content Moderation Hooks
- `submitForModeration({ refType, refId, text?, imageUrl? })` — invokes edge function, returns `{ status, flagId? }`.
- Image upload flow: upload to bucket → submit URL to moderation → on rejection, delete the storage object.
- All moderation calls return within ~2 s; show inline spinner.

### PostgREST Query Limitations
Same as v1 — complex 3-level nested filters break. Use step-by-step queries or RPCs. **All geo queries must go through RPCs.**

---

## BUILD & DEV COMMANDS

```bash
npm run dev          # Vite dev server on port 8080
npm run build        # Production build (verify no TS errors)
npm run preview      # Preview production build
npm run lint         # ESLint
npx vitest           # Unit tests
npx playwright test  # E2E
```

### Environment Variables
```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_MAPPLS_API_KEY=          # MapMyIndia client SDK key
MAPPLS_REST_KEY=              # Server key (edge functions)
SIGHTENGINE_API_USER=
SIGHTENGINE_API_SECRET=
GEMINI_API_KEY=               # Google AI Studio key — for text moderation via gemini-2.0-flash
```

---

## VERIFICATION CHECKLIST

After making changes, verify:
- [ ] `npm run build` passes with no TS errors
- [ ] New tables have RLS policies (use SECURITY DEFINER helpers if recursive)
- [ ] Geo queries are PostGIS RPCs, not PostgREST nested filters
- [ ] New mutations invalidate relevant TanStack Query keys
- [ ] Forms use Zod + RHF with loading/error/success states
- [ ] Lists have loading skeleton, empty state, error+retry
- [ ] Components use `React.forwardRef` + `displayName`
- [ ] Mobile layout works at 375 px width
- [ ] Persona-specific routes are under correct prefix (`/provider/*` or `/platform/*`)
- [ ] User-uploaded text and images are submitted to `ai-moderate-content` before going public
- [ ] Premium-only UI is wrapped in `<PremiumGate>`
- [ ] Notifications sent for state changes (`send_notification` RPC)
- [ ] No references to `apartment_complexes`, `apartment_admins`, `provider_apartment_registrations`, `apartment_id`, `is_apartment_admin`, or `/admin/*` routes remain
- [ ] New RLS policies use `users.auth_id = auth.uid()` (or `public.current_user_id()`), never compare `users.id` to `auth.uid()`
- [ ] Provider-scoped RLS policies don't inline a STABLE function into a policy on `public.users` (causes recursion)
- [ ] Any new `moderation_flags.ref_type` value is added to the CHECK constraint via a migration
- [ ] `batches.current_enrollment_count` and `batches.status` are never written by app code (trigger handles them)
- [ ] Persona labels in UI use **Learner** / **Instructor** (not Seeker / Provider)
- [ ] **Coach scope is honoured** — provider pages that show class/batch/student/payment data use `useEffectiveProviderContext()`; new RLS additions on operational tables include the `is_coach_of_*` branch alongside the owner branch.
- [ ] **PostgREST embeds disambiguated** — any embed off `enrollments` to `batches` uses `batches!batch_id(...)`, not bare `batches(...)`.
- [ ] **No hardcoded UPI / bank / pricing strings** — payment + plan data must come from `platform_payment_details` and `subscription_plans`. Hardcoded fallbacks are anti-pattern; show the "Coming soon" state instead.
- [ ] Coach-aware tables (`classes`, `batches`, `enrollments`, `payments`, `attendance_records`, `class_materials`, `announcements`) keep both the owner policy AND the new coach policy as additive (OR'd) — never replace.
- [ ] New writes to `coaches` and `coach_assignments` go through their RPCs (`invite_coach`, `assign_coach`, etc.), not direct table inserts, so the security guards run.

---

## PIPELINE / OPEN ITEMS

Live tracking of items in flight or queued. Move to "done" when shipped + verified in prod.

### Awaiting manual action on Supabase
- [ ] Apply migration `20260515150000_coaches.sql` (coaches + RLS + RPCs + payment_reminder_log).
- [ ] Apply migration `20260516120000_coach_student_names.sql` (widens names RPC to include coaches).
- [ ] Apply migration `20260517120000_subscription_plans.sql` (plans + payment_details + extended subscription_requests).
- [ ] Deploy edge function `revert-expired-coach-assignments` and schedule a daily cron (suggested `0 2 * * *` IST).
- [ ] Configure Monthly + Annual plans at `/platform/settings` and flip them Active. Required before the upgrade sheet renders a plan-picker (otherwise the "Coming soon" state shows).
- [ ] Configure platform UPI ID + bank details at `/platform/settings` so the payment screen has something to display.
- [ ] Regenerate Supabase types (`src/integrations/supabase/types.ts`) after applying the three new migrations. Until then, the new tables (`coaches`, `coach_assignments`, `subscription_plans`, `platform_payment_details`, `payment_reminder_log`) are queried untyped; the residual lint `any` shims in `useCoaches.ts`, `useSubscription.ts`, `usePlatformAdmin.ts`, `UserContext.tsx` can be removed once types regenerate.

### Coaches — known follow-ups
- [ ] Drop the legacy `trainers` table after one release of running on `coaches` in prod without issue. Pre-flight: ensure no app code reads `trainers` anymore; the migration kept it as a fallback for safety.
- [ ] Drop `certifications.trainer_id` once the `coach_id` backfill is verified and no reads against `trainer_id` remain. The current `useSeekerTrainerCertifications` queries `coach_id OR trainer_id` for safety during the transition.
- [ ] Move the `/provider/trainers-legacy` shim → 410 / NotFound after one release.
- [ ] CSV import for bulk coach invites (current UI is one-at-a-time).
- [ ] Coach-self-view page (read-only profile + my-assignments list) — currently a coach goes straight to the academy dashboard with scoped data; no dedicated "my coach profile" surface yet.

### Subscription pricing — known follow-ups
- [ ] Add a quarterly plan slot (schema check constraint already permits only `monthly` / `annual` — needs migration to extend).
- [ ] Multi-currency support (currently `INR` hardcoded as default; `subscription_plans.currency` column exists but UI doesn't expose it).
- [ ] Auto-renewal flow — current model expires hard; admin must approve a new request to re-grant. Renewals via in-app payment gateway are post-MVP.
- [ ] Pro-rated upgrades between Monthly → Annual mid-cycle (not supported; provider has to wait for current period to end).
- [ ] Tax / GST line item on the payment screen and admin approval card.

### Phase 8 polish (carried from original plan, still pending)
- [ ] `/provider/sponsored` UI — providers can already see sponsored slots run via admin grants, but there's no provider-facing surface to request a slot. Admin side at `/platform/sponsored` is in place.
- [ ] Featured banner upload UI on the provider side (admin side approves; provider currently has no upload entry point).
- [ ] Merge of sponsored top-3 into `/explore` is partial — `useFeaturedListings` exists but the visual integration (gold "Featured" badge above organic results) is half-shipped.
- [ ] Competitor analysis dashboard on `/provider/analytics` is wired data-wise (`useCompetitorClasses`) but the chart surface is minimal.

### Tech debt / cleanup
- [ ] `useEngagement.ts`, `useSeeker.ts`, and a few provider pages still use `any` types around the `payment.users` / `enrollment.batches` PostgREST embeds. These can be tightened once Supabase types regenerate.
- [ ] `BottomNav.tsx` is a no-op stub but still imported in several pages — can be removed after a sweep.
- [ ] Several deprecated `useProvider.ts` exports (`useProviderRegistrations`, `useProviderPendingTerms`, etc.) return empty stubs for v1 compatibility — safe to delete after confirming no callers remain.
