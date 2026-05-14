# CampusBee — Project Reference Guide (v2)

> **This document is the complete project context for Claude Code.**
> Reflects the **v2 scope** (post-pivot, current as of May 2026) — apartment binding removed, geo-based discovery, provider subscription tiers, AI content moderation.
> See `IMPLEMENTATION_PLAN_V2.md` for the phased migration roadmap and post-MVP backlog.
> Pre-pivot v1 migrations are archived under `supabase/migrations/_archive_v1/`.

> **UI persona naming (May 2026):** the seeker persona is shown to users as **"Learner"** and the provider persona as **"Instructor"**. Database column names (`is_provider`, `last_active_persona = 'seeker' | 'provider'`, etc.) are unchanged — only the user-facing labels were renamed. PersonaSwitcher and onboarding copy use Learner/Instructor.

---

## PROJECT OVERVIEW

**CampusBee** is a **hyperlocal, location-based classes marketplace** for Indian cities. Seekers (parents, learners) discover nearby classes — sports, dance, arts, academics, music, fitness, wellness — within a configurable radius of their home, regardless of where the class is offered (studio, academy, or in the seeker's home). Providers list classes, manage batches, take attendance, and chat with students. A platform admin oversees content moderation, premium subscriptions, sponsored slots, and categories.

### What changed in v2 (vs. v1)
1. **Apartment Admin role removed entirely.** No more apartment-scoped multi-tenancy. Providers self-onboard, auto-approved into the **Basic** tier.
2. **Location-first discovery.** Each class has its own address + lat/lng. Seekers set a home location and see classes within an adjustable radius (PostGIS `ST_DWithin`). No apartment binding.
3. **Two provider subscription tiers** — Basic (free) and Premium (paid; manually granted during MVP).
4. **AI content moderation** auto-screens every provider-uploaded image and text field. Borderline cases queue for platform-admin review.
5. **Sponsored listings & featured banners** are Premium-only and manually approved by platform admin.

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
| In-app chat with seekers | ✅ | ✅ |
| Basic dashboard & reports | ✅ | ✅ |
| Class materials uploads | ✅ | ✅ |
| Demo / trial sessions | ✅ | ✅ |
| Reviews & announcements | ✅ | ✅ |
| **In-app payment collection** | ❌ | ✅ |
| **Automated payment reminders to students** | ❌ | ✅ |
| **Advanced analytics dashboard** | ❌ | ✅ |
| **Competitor analysis (location/category/pricing)** | ❌ | ✅ |
| **Seller insights for growth** | ❌ | ✅ |
| **Featured banner placements** | ❌ | ✅ |
| **Sponsored listings (top-3 in explore with "Featured" tag)** | ❌ | ✅ |

**Provisioning during MVP (payments deferred):** provider taps "Upgrade to Premium" → request lands in platform-admin queue → admin verifies off-app payment (UPI/bank transfer) → toggles `subscription_tier = premium` and sets `valid_until`. Same workflow for sponsored slot and featured banner requests.

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
│   │   │   └── UpgradeRequestSheet.tsx
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
│   │   │   ├── Header.tsx             # Unified top nav; PersonaSwitcher hidden on /profile, /family, /chat, /notifications
│   │   │   └── PersonaSwitcher.tsx    # Labels: Learner / Instructor / Platform Admin
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
│   │   ├── provider/                  # 17 pages (incl. ProviderCategories; ProviderSponsored not yet built)
│   │   └── platform/                  # 9 pages (Dashboard, Moderation, Subscriptions, Sponsored, Providers, Categories, Analytics, Settings, Layout)
│   ├── hooks/
│   │   ├── useLocation.ts             # geocode, reverse-geocode, distance helpers, useUpdateSeekerLocation mutation
│   │   ├── useSubscription.ts
│   │   ├── useModeration.ts
│   │   ├── useCategoryRequests.ts     # NEW — provider submits / admin reviews
│   │   ├── useCertifications.ts       # NEW — owner=provider|trainer, max 5, moderated
│   │   ├── usePlatformAdmin.ts        # Moderation queue, subscription grants, sponsored, category-request approvals
│   │   ├── useProvider.ts             # tier-aware
│   │   ├── useSeeker.ts               # location-aware
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
│   │   └── UserContext.tsx            # No apartment, adds providerSubscription
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
│       ├── check-pending-invites/
│       ├── expire-family-invites/
│       ├── expire-waitlist-offers/
│       ├── generate-payment-reminders/  # Premium-gated
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
| `/provider/trainers` | TrainerManagement | Add/edit trainers (academy) + per-trainer certifications |
| `/provider/students` | ProviderStudents | Enrolled students with seeker + family-member names via `get_provider_enrolled_student_names` SECURITY DEFINER RPC (migration 020b) — avoids recursive users-RLS |
| `/provider/payments` | ProviderPayments | Record + confirm payments (Premium = collect in-app + reminders) |
| `/provider/attendance/:batchId` | TakeAttendance | Daily + past-date marking |
| `/provider/announcements` | Announcements | Post/manage |
| `/provider/analytics` | ProviderAnalytics | Basic charts; **Premium tab unlocks competitor analysis, growth insights** |
| `/provider/classes/:classId/materials` | ProviderMaterials | Resource uploads |
| `/provider/classes/:classId/demos` | ProviderDemoSessions | Trial mgmt |
| `/provider/reviews` | ProviderReviews | View & reply |
| `/provider/subscription` | ProviderSubscription | Current tier, upgrade request, history |
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
| `/platform/subscriptions` | PlatformSubscriptions | Premium upgrade requests, active, expired |
| `/platform/sponsored` | PlatformSponsored | Sponsored / featured slot requests, calendar (admin side only — provider-facing surface still missing) |
| `/platform/providers` | PlatformProviders | Directory, suspend/reinstate, verification badge |
| `/platform/settings` | PlatformSettings | **NEW** — key-value editor for `platform_settings` (default radius, trust-marker thresholds, sponsored slot count, moderation thresholds) |

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
- **`trainers`** — `id, provider_id, name, email, phone, specialization, bio, is_active`
- **`provider_subscription_requests`** — `id, provider_id, requested_tier, status (pending/approved/rejected), notes, off_app_payment_ref, requested_at, reviewed_by, reviewed_at, granted_until`
- **`certifications`** — **NEW (migration 022).** `id, owner_type ('provider'|'trainer'), provider_id, trainer_id, name, issuing_authority, year_obtained, image_url, moderation_status, moderation_notes, created_at`. Max 5 per owner. Image goes through `ai-moderate-content` with `ref_type='certification'`.
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
- **`sponsored_listings`** — **NEW.** `id, class_id, provider_id, status (pending/approved/active/expired/rejected), slot_position SMALLINT, center_location geography(Point, 4326), radius_km NUMERIC, valid_from, valid_until, requested_at, reviewed_by, reviewed_at, off_app_payment_ref, rejection_reason`
- **`featured_banners`** — **NEW.** `id, provider_id, image_url, target_url, status, valid_from, valid_until, click_count, impression_count`

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
| L1 | `20260505020104_*.sql`, `20260505062625_*.sql` | Lovable schema-touch no-ops (force types regeneration). |
| L2 | `20260512070202_*.sql` | Adds `batches.grades TEXT[] NOT NULL DEFAULT '{}'` for the grade multi-select on CreateBatch. |
| L3 | `20260512072126_*.sql` | Fixes `category_requests` RLS to resolve `provider_id` via `service_providers.user_id = current_user_id()` (was comparing to `auth.uid()`, causing 403 on insert). |
| L4 | `20260513051521_*.sql` | Same fix for `certifications` `providers_manage_own_certs` policy. |
| L5 | `20260513055502_*.sql` | Extends `moderation_flags.ref_type` CHECK to include `class_title`, `class_description`, `certification`. |
| L6 | `20260513060707_*.sql` | Fixes admin RLS on `category_requests` (was comparing `users.id` to `auth.uid()` — should be `auth_id`); refines `approve_category_request` RPC to backfill `classes.category_id` and clear `classes.pending_category_request_id` for any class that was waiting on the request. |

---

## SUPABASE EDGE FUNCTIONS

| Function | Purpose |
|---|---|
| `ai-moderate-content` | **Phase 3 — DEPLOYED.** Receives `{ref_type, ref_id, owner_user_id, text?, image_url?}`. Images → Sightengine (nudity-2.1, offensive, weapon, recreational_drug); score ≥0.85 → rejected, 0.45–0.85 → in_review, <0.45 → approved. Text → Gemini gemini-2.0-flash safetyRatings; any HIGH → rejected, any MEDIUM → in_review, all LOW/NEGLIGIBLE → approved. Calls `submit_for_moderation` RPC (service_role), which mirrors status to source row and notifies owner on rejection. Returns `{status, flagId}`. |
| `refresh-sponsored-slots` | **NEW.** Cron — expires past `valid_until`, recalculates active slot positions per region. |
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
- UserContext provides: `session, user, profile, family, familyMembers, providerProfile, providerSubscription, activePersona, familyRole, familyLinkId`.
  - **Removed:** `currentApartment`, `apartments`.
- Route-based persona sync via `useLocation` + ref-guarded `useEffect`.

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
- Trainer management (academy)
- Mark attendance (today + past)
- Record payments (track-only — no in-app collection)
- Post announcements, upload materials, manage demos
- View basic analytics, reviews
- Chat with seekers
- See "Upgrade to Premium" CTAs

### Provider — Premium (Paid; manually granted in MVP)
- Everything in Basic, plus:
- **In-app payment collection** + automated reminders
- **Advanced analytics:** competitor analysis (location/category/pricing), revenue trend, retention, growth insights
- **Sponsored listing requests** (top-3 in nearby explore)
- **Featured banner placements**
- Premium badge on profile

### Platform Admin
- Global dashboard (active providers, classes, enrollments by city/category)
- Categories (hierarchical)
- Platform-wide analytics & growth metrics
- **Moderation queue** — review flagged images & text, approve/reject/escalate
- **Subscriptions** — review Premium upgrade requests, manually grant + record off-app payment
- **Sponsored slots** — review requests, approve with valid-from/until + radius, monitor active slots
- **Providers directory** — suspend/reinstate, verify, mark trusted

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

### Premium Provisioning Workflow
- Provider taps "Upgrade to Premium" on `/provider/subscription` → opens `<UpgradeRequestSheet>` with off-app payment instructions (UPI ID, bank details).
- Provider submits with optional payment reference → `provider_subscription_requests` row created (`status = pending`).
- Platform admin sees in `/platform/subscriptions`, verifies payment off-app, taps Approve with `valid_until` date.
- RPC `approve_subscription_request(request_id, valid_until)` SECURITY DEFINER updates `service_providers.subscription_tier = 'premium', subscription_valid_until = ...` and notifies provider.
- Same workflow for sponsored slot requests via `sponsored_listings` table directly (status pending → approved).

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
