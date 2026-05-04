# CampusBee — Project Reference Guide (v2)

> **This document is the complete project context for Claude Code.**
> Reflects the **v2 scope** (post-pivot, May 2026) — apartment binding removed, geo-based discovery, provider subscription tiers, AI content moderation.
> See `IMPLEMENTATION_PLAN_V2.md` for the phased migration roadmap.
> Pre-pivot v1 migrations are archived under `supabase/migrations/_archive_v1/`.

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
- **Auth:** Email magic links (MVP), phone OTP (future)
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
7. **Route-based persona sync.** UserContext watches URL prefix → auto-syncs `activePersona` (`/provider/*` → provider, `/platform/*` → platform_admin, seeker routes → seeker). **No `/admin/*` routes in v2.**
8. **React.forwardRef pattern.** All components rendering DOM elements use `React.forwardRef` + `displayName` (Lovable preview compatibility).

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
- `users.seeker_home_address`, `users.seeker_home_location` (PostGIS Point) — set via MapMyIndia picker on onboarding/profile
- `service_providers.home_address`, `service_providers.home_location` (Point) — used as fallback for home-based classes ("I travel to student")
- `classes.address`, `classes.location` (Point), `classes.is_home_based BOOLEAN`
  - When `is_home_based = true`, the class's effective location for nearby search is `service_providers.home_location`
  - Otherwise the class's own `location` is used
- `sponsored_listings.center_location` (Point), `sponsored_listings.radius_km` — limits where the sponsored slot is shown

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
│   │   ├── location/                  # NEW
│   │   │   ├── MapplsPicker.tsx       # MapMyIndia address picker
│   │   │   ├── RadiusSlider.tsx       # Nearby radius control
│   │   │   └── DistanceBadge.tsx
│   │   ├── subscription/              # NEW
│   │   │   ├── PremiumGate.tsx        # Wraps Premium-only UI with upsell
│   │   │   └── UpgradeRequestSheet.tsx
│   │   ├── moderation/                # NEW
│   │   │   └── ModerationStatusBadge.tsx
│   │   ├── shared/
│   │   │   ├── ClassCard.tsx          # Now shows distance + Featured tag
│   │   │   └── ErrorState.tsx
│   │   ├── AuthGuard.tsx
│   │   ├── BottomNav.tsx              # No more admin nav
│   │   ├── NavLink.tsx
│   │   └── PlaceholderPage.tsx
│   ├── pages/
│   │   ├── Auth.tsx
│   │   ├── Landing.tsx
│   │   ├── Index.tsx
│   │   ├── Notifications.tsx
│   │   ├── NotFound.tsx
│   │   ├── seeker/                    # 12 pages
│   │   ├── provider/                  # 16 pages (drop ProviderTerms; add ProviderSubscription, ProviderSponsored)
│   │   └── platform/                  # 9 pages (add Moderation, Subscriptions, Sponsored)
│   ├── hooks/
│   │   ├── useLocation.ts             # NEW — geocode, reverse-geocode, distance helpers
│   │   ├── useSubscription.ts         # NEW — tier check, upgrade request
│   │   ├── useModeration.ts           # NEW — submit, fetch status, admin queue
│   │   ├── useSponsored.ts            # NEW — request, manage sponsored slots
│   │   ├── usePlatformAdmin.ts        # EXPANDED — moderation queue, premium grants, sponsored approvals
│   │   ├── useProvider.ts             # tier-aware
│   │   ├── useSeeker.ts               # location-aware (replaces apartment scoping)
│   │   ├── useClasses.ts              # location-based queries
│   │   ├── useClassMaterials.ts
│   │   ├── useDemoSessions.ts
│   │   ├── useEngagement.ts
│   │   ├── useFamily.ts               # apartment-binding removed
│   │   ├── useFamilyLinking.ts
│   │   ├── useFeatured.ts             # → renamed/repurposed as useSponsored
│   │   ├── useNotifications.ts
│   │   ├── useOnboarding.ts
│   │   ├── useAnalytics.ts            # tier-gated (Premium only for advanced)
│   │   ├── use-mobile.tsx
│   │   └── use-toast.ts
│   │   # DELETED: useAdmin.ts (apartment admin)
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
| `/` | Landing | Public landing page |
| `/auth` | Auth | Email magic-link / OTP login |
| `/invite/:inviteCode` | InviteAccept | Accept family invite (no auth guard) |

### Seeker (Protected)
| Path | Page | Description |
|---|---|---|
| `/onboarding` | Onboarding | Profile → **Location** → Family → Role |
| `/home` | redirect → `/explore` | |
| `/explore` | Explore | Nearby classes, radius slider, sponsored top-3, search, category/age filters |
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
| `/provider/classes` | ProviderClasses | Listing with filters |
| `/provider/classes/new` | CreateClass | Multi-step + **location picker** + home-based checkbox |
| `/provider/classes/:classId` | ProviderClassDetail | Edit, batches, addons, materials |
| `/provider/classes/:classId/batch/new` | CreateBatch | Schedule, pricing, capacity |
| `/provider/trainers` | TrainerManagement | Add/edit trainers (academy) |
| `/provider/students` | ProviderStudents | Enrolled students |
| `/provider/payments` | ProviderPayments | Record + confirm payments (Premium = collect in-app + reminders) |
| `/provider/attendance/:batchId` | TakeAttendance | Daily + past-date marking |
| `/provider/announcements` | Announcements | Post/manage |
| `/provider/analytics` | ProviderAnalytics | Basic charts; **Premium tab unlocks competitor analysis, growth insights** |
| `/provider/classes/:classId/materials` | ProviderMaterials | Resource uploads |
| `/provider/classes/:classId/demos` | ProviderDemoSessions | Trial mgmt |
| `/provider/reviews` | ProviderReviews | View & reply |
| `/provider/subscription` | ProviderSubscription | **NEW** — current tier, upgrade request, history |
| `/provider/sponsored` | ProviderSponsored | **NEW** — request featured/sponsored slot, status |
| ~~`/provider/terms`~~ | — | **REMOVED** (no apartment commercial terms in v2) |

### Platform Admin (Protected, nested under PlatformLayout)
| Path | Page | Description |
|---|---|---|
| `/platform/` | PlatformDashboard | Global stats |
| ~~`/platform/apartments*`~~ | — | **REMOVED** |
| `/platform/categories` | PlatformCategories | Hierarchical categories |
| `/platform/analytics` | PlatformAnalytics | Platform-wide metrics |
| `/platform/moderation` | PlatformModeration | **NEW** — review queue (images & text), approve/reject |
| `/platform/subscriptions` | PlatformSubscriptions | **NEW** — Premium upgrade requests, active, expired |
| `/platform/sponsored` | PlatformSponsored | **NEW** — sponsored / featured slot requests, calendar |
| `/platform/providers` | PlatformProviders | Directory, suspend/reinstate, verification badge |

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
- **`users`** — `id, full_name, email, mobile_number, avatar_url, is_provider, is_platform_admin, last_active_persona, is_active, is_verified, seeker_home_address TEXT, seeker_home_location geography(Point, 4326)`
  - **Removed:** `is_apartment_admin`

### Family & Household
- **`families`** — `id, primary_user_id` *(no more apartment_id, flat_number, block_tower)*
- **`family_members`** — `id, family_id, full_name, date_of_birth, gender, relationship, is_active, linked_user_id`
- **`family_links`** — `id, family_id, user_id, role, accepted_at` (multi-adult linking, unchanged)
- **`family_invites`** — `id, family_id, invite_code, expires_at, accepted_by` (unchanged)

### Provider Management
- **`service_providers`** — `id, user_id, business_name, provider_type (individual/academy), bio, experience_years, qualifications, specializations, specialization_category_ids, logo_url, whatsapp_number, is_verified, home_address TEXT, home_location geography(Point, 4326), subscription_tier (basic/premium) DEFAULT 'basic', subscription_valid_until TIMESTAMPTZ, suspended_at, suspension_reason`
  - **Removed:** all `provider_apartment_registrations` columns
- **`trainers`** — `id, provider_id, name, email, phone, specialization, bio, is_active`
- **`provider_subscription_requests`** — **NEW.** `id, provider_id, requested_tier, status (pending/approved/rejected), notes, off_app_payment_ref, requested_at, reviewed_by, reviewed_at, granted_until`

### Classes & Curriculum
- **`class_categories`** — `id, name, icon, parent_id, sort_order`
- **`classes`** — `id, provider_id, category_id, title, description, status (draft/published/paused/archived), age_min, age_max, skill_level, trial_available, trial_fee, images TEXT[], tags TEXT[], address TEXT, location geography(Point, 4326), is_home_based BOOLEAN DEFAULT false, moderation_status (pending/approved/rejected/in_review) DEFAULT 'pending', moderation_notes, total_rating, rating_count, created_at`
  - **Removed:** `provider_registration_id`, `is_featured` (now via sponsored_listings)
  - **NEW direct FK:** `provider_id → service_providers(id)`
- **`batches`** — unchanged structure but FK chain via `class_id` only (no apartment)
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
- **`moderation_flags`** — **NEW.** `id, ref_type (class_image/class_text/provider_avatar/provider_bio/banner), ref_id, content_snapshot TEXT, image_url TEXT, ai_provider (sightengine/openai), ai_score NUMERIC, ai_categories JSONB, status (in_review/approved/rejected), reviewed_by, reviewed_at, action_notes, created_at`

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

---

## SUPABASE EDGE FUNCTIONS

| Function | Purpose |
|---|---|
| `ai-moderate-content` | **NEW.** Receives `{ref_type, ref_id, content?, image_url?}`, calls Sightengine (images) / Gemini API (text), writes to `moderation_flags`, sets `moderation_status` on the source row, sends notification on rejection. |
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
1. Provider creates class as `draft` → enters details, address (MapplsPicker), uploads images.
2. On "Publish": every image and text field submitted to `ai-moderate-content`.
3. If all auto-approve → `status = published, moderation_status = approved`.
4. If any rejected → `status = draft, moderation_status = rejected`, provider notified, edit-and-retry available.
5. If any in_review → `status = draft, moderation_status = in_review`, awaits platform admin.

### Nearby Search Integration
`useExploreClasses({ radiusKm, categoryId? })` calls `rpc('nearby_classes', { seeker_loc, radius_km, category_id })`. Returns classes with `distance_km`. Sponsored slots fetched via separate `useSponsoredForLocation()` and merged client-side into top-3 positions with the "Featured" badge.

### Premium Provisioning Workflow
- Provider taps "Upgrade to Premium" on `/provider/subscription` → opens `<UpgradeRequestSheet>` with off-app payment instructions (UPI ID, bank details).
- Provider submits with optional payment reference → `provider_subscription_requests` row created (`status = pending`).
- Platform admin sees in `/platform/subscriptions`, verifies payment off-app, taps Approve with `valid_until` date.
- RPC `approve_subscription_request(request_id, valid_until)` SECURITY DEFINER updates `service_providers.subscription_tier = 'premium', subscription_valid_until = ...` and notifies provider.
- Same workflow for sponsored slot requests via `sponsored_listings` table directly (status pending → approved).

### Family Account Linking (unchanged from v1)
Multiple adults link to a single family. Primary member sends invite link. Linked members get equal access. See `CLAUDE-PHASE2-FAMILY-LINKING.md`.

### Attendance Date Awareness (unchanged)
`useBatchEnrolledStudents(batchId, date?)`:
- **Today:** `status = 'active'` only
- **Past dates:** `status IN ('active','completed','dropped','paused')` with `enrolled_at <= date`, client-side filters dropouts before the target date

### MapMyIndia (Mappls) Integration
- API key stored in `.env` as `VITE_MAPPLS_API_KEY` (client SDK key) and `MAPPLS_REST_KEY` (server key for edge functions if needed)
- `<MapplsPicker>` props: `value: {address, lat, lng} | null`, `onChange(value)`. Renders map + autocomplete combo. Returns reverse-geocoded address on map drag.
- `useLocation()` hook exposes `geocodeAddress(address)`, `reverseGeocode(lat, lng)`, `formatDistance(km)`.

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
