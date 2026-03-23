import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---- Family Links ----

export function useFamilyLinks(userId: string | undefined) {
  return useQuery({
    queryKey: ["family-links", userId],
    enabled: !!userId,
    queryFn: async () => {
      // Get user's active link
      const { data: myLink, error: linkErr } = await supabase
        .from("family_links")
        .select("id, family_id, user_id, role, status, linked_at, linked_via")
        .eq("user_id", userId!)
        .eq("status", "active")
        .maybeSingle();
      if (linkErr) throw linkErr;
      if (!myLink) return { myLink: null, allLinks: [], linkedUsers: [] };

      // Get all links for this family via RPC (bypasses RLS recursion)
      const { data: allLinks, error: allErr } = await supabase.rpc("get_family_co_links", {
        for_family_id: myLink.family_id,
      });
      if (allErr) throw allErr;

      const otherLinks = (allLinks ?? []).filter((l: any) => l.user_id !== userId);

      // Fetch user details for linked users (their own profile is accessible via auth)
      const linkedUsers = await Promise.all(
        otherLinks.map(async (l: any) => {
          const { data: userData } = await supabase
            .from("users")
            .select("id, full_name, email, avatar_url")
            .eq("id", l.user_id)
            .maybeSingle();
          return {
            linkId: l.id,
            userId: l.user_id,
            role: l.role,
            linkedAt: l.linked_at,
            linkedVia: l.linked_via,
            user: userData,
          };
        })
      );

      return { myLink, allLinks: allLinks ?? [], linkedUsers };
    },
  });
}

// ---- Invite Generation ----

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function useSendFamilyInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      familyId: string;
      invitedBy: string;
      invitedUserId?: string;
      invitedPhone?: string;
      invitedEmail?: string;
      inviteType?: string;
      claimedMemberId?: string;
      message?: string;
    }) => {
      const inviteCode = generateInviteCode();
      const { data, error } = await supabase
        .from("family_invites")
        .insert({
          family_id: input.familyId,
          invited_by: input.invitedBy,
          invited_user_id: input.invitedUserId || null,
          invited_phone: input.invitedPhone || null,
          invited_email: input.invitedEmail || null,
          invite_code: inviteCode,
          invite_type: input.inviteType || "join_family",
          claimed_member_id: input.claimedMemberId || null,
          message: input.message || null,
        })
        .select("id, invite_code")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sent-invites"] });
    },
  });
}

// ---- Sent Invites ----

export function useSentInvites(userId: string | undefined) {
  return useQuery({
    queryKey: ["sent-invites", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_invites")
        .select("id, invite_code, invite_type, status, invited_phone, invited_email, message, created_at, expires_at, invited_user_id, users!family_invites_invited_user_id_fkey(full_name)")
        .eq("invited_by", userId!)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ---- Incoming Invites ----

export function useIncomingInvites(userId: string | undefined, email: string | null, phone: string | null) {
  return useQuery({
    queryKey: ["incoming-invites", userId],
    enabled: !!userId,
    queryFn: async () => {
      // Build OR filter for matching invites
      const conditions: string[] = [];
      if (userId) conditions.push(`invited_user_id.eq.${userId}`);
      if (phone) conditions.push(`invited_phone.eq.${phone}`);
      if (email) conditions.push(`invited_email.eq.${email}`);

      if (conditions.length === 0) return [];

      const { data, error } = await supabase
        .from("family_invites")
        .select(`
          id, invite_code, invite_type, status, message, created_at, expires_at,
          family_id, claimed_member_id,
          inviter:users!family_invites_invited_by_fkey(id, full_name, avatar_url),
          families(id, apartment_id, apartment_complexes(name))
        `)
        .or(conditions.join(","))
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Poll every 30s
  });
}

// ---- Accept Invite ----

export function useAcceptInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      inviteId: string;
      userId: string;
      familyId: string;
      mergeOldFamilyId?: string; // if user has existing family to merge
    }) => {
      // 1. Create family_links row
      const { error: linkErr } = await supabase
        .from("family_links")
        .insert({
          family_id: input.familyId,
          user_id: input.userId,
          role: "member",
          status: "active",
          linked_via: "invite",
        });
      if (linkErr) throw linkErr;

      // 2. If merging an old family, move family members
      if (input.mergeOldFamilyId && input.mergeOldFamilyId !== input.familyId) {
        // Move all family members from old family to new
        const { error: moveErr } = await supabase
          .from("family_members")
          .update({ family_id: input.familyId })
          .eq("family_id", input.mergeOldFamilyId);
        if (moveErr) throw moveErr;

        // Deactivate old family link
        await supabase
          .from("family_links")
          .update({ status: "unlinked", unlinked_at: new Date().toISOString() })
          .eq("family_id", input.mergeOldFamilyId)
          .eq("user_id", input.userId);
      }

      // 3. Update invite status
      const { error: invErr } = await supabase
        .from("family_invites")
        .update({
          status: "accepted",
          accepted_by: input.userId,
          accepted_at: new Date().toISOString(),
        })
        .eq("id", input.inviteId);
      if (invErr) throw invErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family-links"] });
      qc.invalidateQueries({ queryKey: ["incoming-invites"] });
      qc.invalidateQueries({ queryKey: ["sent-invites"] });
      qc.invalidateQueries({ queryKey: ["family"] });
    },
  });
}

// ---- Reject Invite ----

export function useRejectInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from("family_invites")
        .update({ status: "rejected" })
        .eq("id", inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["incoming-invites"] });
      qc.invalidateQueries({ queryKey: ["sent-invites"] });
    },
  });
}

// ---- Cancel Invite ----

export function useCancelInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase
        .from("family_invites")
        .update({ status: "cancelled" })
        .eq("id", inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sent-invites"] });
    },
  });
}

// ---- Unlink from Family ----

export function useUnlinkFromFamily() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      linkId: string;
      unlinkedBy: string;
      reason?: string;
    }) => {
      const { error } = await supabase
        .from("family_links")
        .update({
          status: "unlinked",
          unlinked_at: new Date().toISOString(),
          unlinked_by: input.unlinkedBy,
          unlink_reason: input.reason || null,
        })
        .eq("id", input.linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family-links"] });
      qc.invalidateQueries({ queryKey: ["family"] });
    },
  });
}

// ---- Transfer Primary Role ----

export function useTransferPrimary() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      currentPrimaryLinkId: string;
      newPrimaryLinkId: string;
    }) => {
      const { error } = await supabase.rpc("transfer_family_primary", {
        current_primary_link_id: input.currentPrimaryLinkId,
        new_primary_link_id: input.newPrimaryLinkId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["family-links"] });
    },
  });
}

// ---- Lookup Invite by Code ----

export function useInviteByCode(code: string | undefined) {
  return useQuery({
    queryKey: ["invite-by-code", code],
    enabled: !!code,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_invites")
        .select(`
          id, invite_code, invite_type, status, message, created_at, expires_at,
          family_id, claimed_member_id,
          inviter:users!family_invites_invited_by_fkey(id, full_name, avatar_url),
          families(id, apartment_id, flat_number, block_tower, apartment_complexes(name, city))
        `)
        .eq("invite_code", code!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

// ---- Search Users in Same Apartment ----

export function useSearchApartmentUsers(apartmentId: string | undefined, searchTerm: string) {
  return useQuery({
    queryKey: ["apartment-users-search", apartmentId, searchTerm],
    enabled: !!apartmentId && searchTerm.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_apartment_users", {
        apt_id: apartmentId!,
        search_query: searchTerm,
      });
      if (error) throw error;
      return data as { id: string; full_name: string; email: string; mobile_number: string; avatar_url: string }[];
    },
  });
}
