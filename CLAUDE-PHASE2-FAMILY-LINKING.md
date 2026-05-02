# CampusBee — Phase 2: Family Account Linking

> **Context:** This file extends the CampusBee codebase built in Phase 1 (via CLAUDE.md).
> Place this file as `CLAUDE-PHASE2-FAMILY-LINKING.md` in the project root.
> Tell Claude Code: "Read CLAUDE-PHASE2-FAMILY-LINKING.md and implement it step by step."
> Prerequisite: Phase 1 (CLAUDE.md) must be fully implemented before starting this.

---

## PROBLEM STATEMENT

In Indian families, multiple adults (mom, dad, grandparent, older sibling) may each register on CampusBee independently. Currently, each user creates their own isolated family — so if mom adds the kids and enrolls them, dad can't see or manage those enrollments from his account. This phase adds the ability for multiple users to link into a single shared family, with equal control over family members, enrollments, payments, and attendance.

### User Stories

1. **Mom registers first**, adds kids (Arjun, Priya), enrolls Arjun in swimming. Later, **Dad registers separately**. Mom sends Dad a "Join my family" invite from the app. Dad accepts. Now Dad can see Arjun and Priya, see Arjun's swimming enrollment, and enroll Priya in dance himself.

2. **A 17-year-old (Riya) registers herself** and enrolls in a Karate class. Later, her **Mom registers** and creates a family. Mom sends Riya a "Join family" invite. Riya accepts. Now Riya's independent enrollment appears under the shared family, and Mom can see Riya's Karate attendance and payments.

3. **Dad gets unlinked** (by choice or by the primary member). Dad loses access to the family, its members, and all enrollments. But the enrollments and payments Dad had made remain visible to the rest of the family. Dad can create a new family if needed.

---

## ARCHITECTURE CHANGES

### Current Model (Phase 1)
```
users → families (via primary_user_id, 1:1 per apartment)
           → family_members
               → enrollments (enrolled_by = users.id)
               → payments (payer_user_id = users.id)
```
**Problem:** Only `primary_user_id` has access. No way to share a family.

### New Model (Phase 2)
```
users → family_links (junction table, many users : one family)
           → families
               → family_members
                   → enrollments (enrolled_by tracks WHO did it, but visible to ALL linked users)
                   → payments (payer_user_id tracks WHO paid, but visible to ALL linked users)

users → family_invites (invite flow tracking)
```
**Key principle:** `families.primary_user_id` is retained as the *original creator* (who created the family). But access control moves entirely to `family_links`. Anyone with an active link to a family has full equal control.

---

## DATABASE MIGRATIONS

### Step 2.1 — New Tables

Create migration `supabase/migrations/010_family_linking.sql`:

```sql
-- ============================================================
-- FAMILY LINKS — Junction table for multi-user family access
-- ============================================================
CREATE TABLE family_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  role VARCHAR(20) DEFAULT 'member' CHECK (role IN ('primary', 'member')),
  -- primary: the original creator of the family (cannot be removed, only transferred)
  -- member: a linked user with equal access
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'unlinked')),
  linked_at TIMESTAMPTZ DEFAULT now(),
  linked_via VARCHAR(20) DEFAULT 'invite' CHECK (linked_via IN ('creation', 'invite', 'claim')),
  -- creation: auto-created when user first creates the family (primary)
  -- invite: joined via an invite from another family member
  -- claim: teen/independent user was claimed into a family
  unlinked_at TIMESTAMPTZ,
  unlinked_by UUID REFERENCES users(id), -- who initiated the unlink
  unlink_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(family_id, user_id)
);

-- ============================================================
-- FAMILY INVITES — Invite flow tracking
-- ============================================================
CREATE TABLE family_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id UUID REFERENCES families(id) NOT NULL,
  invited_by UUID REFERENCES users(id) NOT NULL,
  -- Invite can be sent to an existing user or a phone/email not yet registered
  invited_user_id UUID REFERENCES users(id), -- if the person is already on the platform
  invited_phone VARCHAR(15), -- if inviting via phone (person may not be registered yet)
  invited_email VARCHAR(255), -- if inviting via email
  invite_code VARCHAR(20) UNIQUE NOT NULL, -- short code for deep link / manual entry
  invite_type VARCHAR(20) DEFAULT 'join_family' CHECK (invite_type IN ('join_family', 'claim_member')),
  -- join_family: inviting another adult to share the family
  -- claim_member: claiming an independently registered person as a family member
  claimed_member_id UUID REFERENCES family_members(id), -- for claim_member type: which family_member they'll be linked to
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'cancelled')),
  accepted_by UUID REFERENCES users(id), -- the user who accepted (may differ from invited_user_id if invited via phone/email)
  message TEXT, -- optional personal message from inviter ("Hey, join our family on CampusBee!")
  expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX idx_family_links_user ON family_links(user_id, status);
CREATE INDEX idx_family_links_family ON family_links(family_id, status);
CREATE INDEX idx_family_invites_code ON family_invites(invite_code);
CREATE INDEX idx_family_invites_phone ON family_invites(invited_phone);
CREATE INDEX idx_family_invites_email ON family_invites(invited_email);
CREATE INDEX idx_family_invites_user ON family_invites(invited_user_id);

-- ============================================================
-- ENABLE RLS
-- ============================================================
ALTER TABLE family_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE family_invites ENABLE ROW LEVEL SECURITY;
```

### Step 2.2 — Backfill Existing Data

When this migration runs, existing families (created in Phase 1) need `family_links` rows created for the `primary_user_id`:

```sql
-- Backfill: create family_links for all existing families
INSERT INTO family_links (family_id, user_id, role, status, linked_via)
SELECT id, primary_user_id, 'primary', 'active', 'creation'
FROM families
ON CONFLICT (family_id, user_id) DO NOTHING;
```

### Step 2.3 — RLS Policies for New Tables

```sql
-- FAMILY LINKS: users can see their own links, linked family members can see co-links
CREATE POLICY "Users see own family links" ON family_links
  FOR SELECT USING (user_id = get_user_id());

CREATE POLICY "Linked users see co-member links" ON family_links
  FOR SELECT USING (
    family_id IN (SELECT family_id FROM family_links WHERE user_id = get_user_id() AND status = 'active')
  );

CREATE POLICY "Linked users can unlink themselves" ON family_links
  FOR UPDATE USING (user_id = get_user_id());

CREATE POLICY "Primary can unlink members" ON family_links
  FOR UPDATE USING (
    family_id IN (
      SELECT family_id FROM family_links
      WHERE user_id = get_user_id() AND role = 'primary' AND status = 'active'
    )
  );

-- FAMILY INVITES: inviter manages, invitee can view/accept
CREATE POLICY "Inviter manages own invites" ON family_invites
  FOR ALL USING (invited_by = get_user_id());

CREATE POLICY "Invitee can see and accept invites" ON family_invites
  FOR SELECT USING (
    invited_user_id = get_user_id()
    OR invited_phone = (SELECT mobile_number FROM users WHERE id = get_user_id())
    OR invited_email = (SELECT email FROM users WHERE id = get_user_id())
  );

CREATE POLICY "Invitee can update invite status" ON family_invites
  FOR UPDATE USING (
    invited_user_id = get_user_id()
    OR invited_phone = (SELECT mobile_number FROM users WHERE id = get_user_id())
    OR invited_email = (SELECT email FROM users WHERE id = get_user_id())
  );
```

### Step 2.4 — Update Existing RLS Policies

The critical change: all RLS policies that currently check `families.primary_user_id = get_user_id()` must be updated to check `family_links` instead.

```sql
-- DROP old family-based policies
DROP POLICY IF EXISTS "Users manage own family" ON families;
DROP POLICY IF EXISTS "Users manage own family members" ON family_members;

-- FAMILIES: any linked active user can view/manage
CREATE POLICY "Linked users manage family" ON families
  FOR ALL USING (
    id IN (SELECT family_id FROM family_links WHERE user_id = get_user_id() AND status = 'active')
  );

-- FAMILY MEMBERS: any linked active user can view/manage
CREATE POLICY "Linked users manage family members" ON family_members
  FOR ALL USING (
    family_id IN (SELECT family_id FROM family_links WHERE user_id = get_user_id() AND status = 'active')
  );

-- ENROLLMENTS: update the seeker-side policy to use family_links
DROP POLICY IF EXISTS "Users manage own enrollments" ON enrollments;

CREATE POLICY "Linked users manage family enrollments" ON enrollments
  FOR ALL USING (
    enrolled_by = get_user_id()
    OR family_member_id IN (
      SELECT fm.id FROM family_members fm
      JOIN family_links fl ON fm.family_id = fl.family_id
      WHERE fl.user_id = get_user_id() AND fl.status = 'active'
    )
  );

-- PAYMENTS: update payer-side policy
DROP POLICY IF EXISTS "Payer manages own payments" ON payments;

CREATE POLICY "Linked users see family payments" ON payments
  FOR SELECT USING (
    payer_user_id = get_user_id()
    OR enrollment_id IN (
      SELECT e.id FROM enrollments e
      JOIN family_members fm ON e.family_member_id = fm.id
      JOIN family_links fl ON fm.family_id = fl.family_id
      WHERE fl.user_id = get_user_id() AND fl.status = 'active'
    )
  );

CREATE POLICY "Linked users can record payments" ON payments
  FOR INSERT WITH CHECK (
    payer_user_id = get_user_id()
  );

-- ATTENDANCE: update seeker-side policy
DROP POLICY IF EXISTS "Users see own attendance" ON attendance_records;

CREATE POLICY "Linked users see family attendance" ON attendance_records
  FOR SELECT USING (
    enrollment_id IN (
      SELECT e.id FROM enrollments e
      JOIN family_members fm ON e.family_member_id = fm.id
      JOIN family_links fl ON fm.family_id = fl.family_id
      WHERE fl.user_id = get_user_id() AND fl.status = 'active'
    )
  );

-- WAITLIST: update seeker-side policy
DROP POLICY IF EXISTS "Users manage own waitlist" ON waitlist_entries;

CREATE POLICY "Linked users manage family waitlist" ON waitlist_entries
  FOR ALL USING (
    requested_by = get_user_id()
    OR family_member_id IN (
      SELECT fm.id FROM family_members fm
      JOIN family_links fl ON fm.family_id = fl.family_id
      WHERE fl.user_id = get_user_id() AND fl.status = 'active'
    )
  );

-- DEMO REGISTRATIONS: update seeker-side policy
DROP POLICY IF EXISTS "Users manage own demo registrations" ON demo_registrations;

CREATE POLICY "Linked users manage family demo registrations" ON demo_registrations
  FOR ALL USING (
    registered_by = get_user_id()
    OR family_member_id IN (
      SELECT fm.id FROM family_members fm
      JOIN family_links fl ON fm.family_id = fl.family_id
      WHERE fl.user_id = get_user_id() AND fl.status = 'active'
    )
  );

-- CLASS MATERIALS: update seeker-side policy
DROP POLICY IF EXISTS "Enrolled users see class materials" ON class_materials;

CREATE POLICY "Linked users see family class materials" ON class_materials
  FOR SELECT USING (
    class_id IN (
      SELECT b.class_id FROM batches b
      JOIN enrollments e ON e.batch_id = b.id
      JOIN family_members fm ON e.family_member_id = fm.id
      JOIN family_links fl ON fm.family_id = fl.family_id
      WHERE fl.user_id = get_user_id() AND fl.status = 'active' AND e.status = 'active'
    )
  );

-- ANNOUNCEMENTS: update seeker-side policy for batch/class scoped announcements
DROP POLICY IF EXISTS "Users see apartment announcements" ON announcements;

CREATE POLICY "Linked users see relevant announcements" ON announcements
  FOR SELECT USING (
    -- Apartment-wide announcements: user is linked to a family in that apartment
    apartment_id IN (
      SELECT f.apartment_id FROM families f
      JOIN family_links fl ON f.id = fl.family_id
      WHERE fl.user_id = get_user_id() AND fl.status = 'active'
    )
    -- Batch-specific: a family member is enrolled in that batch
    OR batch_id IN (
      SELECT e.batch_id FROM enrollments e
      JOIN family_members fm ON e.family_member_id = fm.id
      JOIN family_links fl ON fm.family_id = fl.family_id
      WHERE fl.user_id = get_user_id() AND fl.status = 'active'
    )
    -- Class-specific: a family member is enrolled in a batch of that class
    OR class_id IN (
      SELECT b.class_id FROM batches b
      JOIN enrollments e ON e.batch_id = b.id
      JOIN family_members fm ON e.family_member_id = fm.id
      JOIN family_links fl ON fm.family_id = fl.family_id
      WHERE fl.user_id = get_user_id() AND fl.status = 'active'
    )
  );
```

---

## FRONTEND IMPLEMENTATION

### Step 2.5 — Update UserContext

Update the `UserContext` (from Phase 1) to be family-link-aware:

```typescript
// In src/contexts/UserContext.tsx — add these to the context value:

interface UserContextValue {
  // ... existing fields from Phase 1 ...

  // NEW: Family linking
  familyLinks: FamilyLink[];          // all active links for current user's family
  linkedUsers: User[];                // other users linked to the same family
  pendingInvites: FamilyInvite[];     // invites sent by this user (pending)
  incomingInvites: FamilyInvite[];    // invites received by this user (pending)
  isLinkedToFamily: boolean;          // true if user has at least one active family_link
  familyRole: 'primary' | 'member';  // user's role in the family

  // NEW: Actions
  sendFamilyInvite: (params: SendInviteParams) => Promise<void>;
  acceptInvite: (inviteId: string) => Promise<void>;
  rejectInvite: (inviteId: string) => Promise<void>;
  unlinkFromFamily: (userId?: string) => Promise<void>; // self-unlink if no userId, or unlink another (primary only)
}
```

**Data fetching change:** Replace the Phase 1 query that fetches family by `primary_user_id` with a query that fetches family via `family_links`:

```typescript
// Phase 1 (old):
const { data: family } = useQuery({
  queryKey: ['family', user.id],
  queryFn: () => supabase
    .from('families')
    .select('*')
    .eq('primary_user_id', user.id)
    .single()
});

// Phase 2 (new):
const { data: familyLink } = useQuery({
  queryKey: ['family-link', user.id],
  queryFn: () => supabase
    .from('family_links')
    .select('*, family:families(*)')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single()
});
// Then: family = familyLink?.family
```

### Step 2.6 — Family Management Screen

Add a new screen at `/family` (accessible from Profile → "Manage Family"):

**Section 1: Family Members**
- Existing family members list (same as Phase 1 Profile → Family Members)
- Add/edit/remove members

**Section 2: Linked Accounts**
- Header: "Family Members Managing This Account"
- List of linked users with: avatar, name, role badge (Primary/Member), linked date
- Primary user has a crown icon
- For the primary user: each member row has a "Remove" button (unlink that member)
- For non-primary users: only a "Leave Family" button for self

**Section 3: Invite to Family**
- "Invite Family Member" button → opens Sheet (bottom drawer)
- Two tabs:
  - **"By Phone/Email":** Input field for phone number or email. If the person is already on CampusBee, shows their name with a confirmation. If not, sends an invite link via WhatsApp/SMS.
  - **"From CampusBee":** Search for a user by name who is in the same apartment. Shows search results with "Invite" button.
- Optional personal message textarea
- "Send Invite" creates a `family_invites` row and generates a unique invite code
- Share option: "Share via WhatsApp" with deep link: `https://campusbee.app/invite/{invite_code}`

**Section 4: Pending Invites (Sent)**
- List of invites this user has sent that are still pending
- Each row: Invitee name/phone/email, Status, Date sent, "Cancel" button

### Step 2.7 — Incoming Invite Handling

**In-app invite banner:**
- On app launch, check for pending invites where the current user is the invitee (by `invited_user_id`, `invited_phone`, or `invited_email`)
- If found: show a banner at the top of the home screen: "[Name] invited you to join their family on CampusBee"
- Two CTAs: "Accept" / "Decline"

**Deep link handling (`/invite/:inviteCode`):**
- If user is logged in: show invite details (who invited, which family/apartment) with Accept/Decline
- If user is NOT logged in: redirect to auth → after login, check if invite code matches → show invite
- If invite is expired: show "This invite has expired" with suggestion to ask for a new one

**Accept invite logic:**
1. Check if user already has a family in the same apartment
2. **If user has no family in this apartment:** Create a `family_links` row linking them to the inviter's family. Done.
3. **If user has their own family in this apartment (with members/enrollments):** Show a merge confirmation screen:
   - "You already have a family set up in [Apartment]. Joining [Inviter]'s family will merge your family members and enrollments."
   - "Your family members: [list]"
   - "Their family members: [list]"
   - "Merge & Join" / "Cancel"
   - On merge:
     - Move all of user's `family_members` to the inviter's `families.id` (update `family_id`)
     - Update user's `family_links` row to point to the inviter's family
     - Mark user's old `families` row as inactive (don't delete — preserve audit trail)
     - All enrollments, payments, attendance tied to those family_members automatically become visible (since they follow `family_member_id`, not `family_id` directly)
4. Update `family_invites` row: set `status = 'accepted'`, `accepted_by`, `accepted_at`
5. Send notification to inviter: "[Name] has joined your family!"

### Step 2.8 — Claim Independent User (Teen Scenario)

When a teen (or any person) registered independently and has their own enrollments:

**Flow for the parent (inviter):**
1. Parent goes to Family → "Invite Family Member" → searches for the teen's name or enters their phone
2. System detects: "This person has their own account with active enrollments"
3. Invite type is set to `claim_member`
4. Parent sends invite with message: "Hi Riya, join our family so I can help manage your classes"

**Flow for the teen (invitee):**
1. Teen sees the invite banner or opens the deep link
2. Screen shows: "Your parent [Name] wants to add you to their family"
3. "This will allow them to see and manage your enrollments, payments, and attendance"
4. "Accept" / "Decline"
5. On accept:
   - If teen already exists as a `family_members` row in parent's family → link teen's `users` account to the parent's family via `family_links`, and associate their independently-created enrollments with the matching `family_members` row
   - If teen does NOT exist as a family member → create a new `family_members` row in parent's family for the teen, then transfer teen's enrollments to this new family_member row
   - Teen's independent family is marked inactive
   - Teen now has a `family_links` row and can still log in and manage their own stuff, but it's all within the shared family

### Step 2.9 — Unlink Flow

**Self-unlink (member leaves voluntarily):**
1. User goes to Family → "Leave Family"
2. Confirmation: "Are you sure? You will lose access to all family members, enrollments, and payment history. Enrollments and payments you made will remain visible to other family members."
3. On confirm:
   - Update `family_links` row: set `status = 'unlinked'`, `unlinked_at = now()`, `unlinked_by = self`
   - DO NOT delete any enrollments, payments, or attendance records
   - DO NOT change `enrolled_by` or `payer_user_id` on existing records
   - User can create a new family in the same apartment if they want

**Primary removes a member:**
1. Primary user goes to Family → Linked Accounts → taps "Remove" on a member
2. Confirmation: "Remove [Name] from your family? They will lose access. All enrollments and payments they made will remain in your family."
3. Same unlink logic as above, but `unlinked_by = primary user id`
4. Notification sent to removed user: "You have been removed from [Family Name]'s family on CampusBee"

**Primary user cannot leave** (only transfer):
- If the primary user wants to leave, they must first transfer primary role to another linked member
- "Transfer Primary Role" option in Family settings → select a member → confirm → updates `role` on both `family_links` rows
- After transfer, the former primary can then leave

### Step 2.10 — Supabase Edge Functions

**`handle-invite-accept`** (called when invitee accepts):
- Validates invite (not expired, not already accepted)
- Handles the merge logic (move family members, update family_links, deactivate old family)
- Creates notifications for all parties
- Returns success/failure

**`expire-family-invites`** (cron, runs daily):
- Find `family_invites` where `status = 'pending'` and `expires_at < now()`
- Set `status = 'expired'`
- Notify inviter: "Your family invite to [Name/Phone] has expired"

**`check-pending-invites`** (called on user login):
- Checks if there are any pending invites matching the user's phone or email
- Updates `invited_user_id` on matching invites (in case invite was sent to phone/email before the person registered)
- Returns pending invite count (for badge display)

---

## UI INTEGRATION POINTS

### Profile Screen Updates
- Add "Manage Family" row in the Profile screen (below family members)
- Show badge: number of pending incoming invites
- If user has linked family members, show a small "Shared with X people" indicator under the family section

### My Classes Screen Updates
- Enrollment cards should show "Enrolled by: [Name]" if the enrollment was made by a different linked family member
- Payment records should show "Paid by: [Name]" for payments made by other linked members

### Notifications
Create notifications for these events:
- `family_invite_received`: "You've been invited to join [Name]'s family"
- `family_invite_accepted`: "[Name] has joined your family"
- `family_invite_rejected`: "[Name] declined your family invite"
- `family_invite_expired`: "Your invite to [Name] has expired"
- `family_member_unlinked`: "You've been removed from [Name]'s family"
- `family_member_left`: "[Name] has left your family"
- `family_primary_transferred`: "You are now the primary manager of your family"

---

## VERIFICATION CHECKLIST

After implementing all steps:

- [ ] Existing Phase 1 users have `family_links` rows created via backfill migration
- [ ] A user who registers fresh still creates a family and auto-gets a `family_links` row with `role = 'primary'`
- [ ] Two users can link to the same family via invite flow
- [ ] Both linked users can see all family members, enrollments, payments, attendance
- [ ] Both linked users can enroll family members in new classes
- [ ] Both linked users can record payments
- [ ] Unlinking removes access for the unlinked user but preserves all data for others
- [ ] Deep link invites work for both logged-in and not-logged-in users
- [ ] Merge flow works correctly when invitee has an existing family with members and enrollments
- [ ] Primary cannot leave without transferring primary role first
- [ ] RLS policies correctly use `family_links` instead of `families.primary_user_id`
- [ ] All list screens show "Enrolled by" / "Paid by" attribution for shared family actions
- [ ] `npm run build` passes with zero TypeScript errors
