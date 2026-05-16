import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { useMemo } from "react";

// ---- Types ----

export type Coach = {
  id: string;
  academy_provider_id: string;
  full_name: string;
  email: string;
  phone: string | null;
  bio: string | null;
  qualifications: string | null;
  experience_years: number | null;
  specializations: string[] | null;
  photo_url: string | null;
  linked_user_id: string | null;
  status: "invited" | "active" | "removed";
  invited_at: string | null;
  accepted_at: string | null;
  removed_at: string | null;
};

export type CoachAssignment = {
  id: string;
  coach_id: string;
  scope_type: "class" | "batch";
  scope_id: string;
  is_temporary: boolean;
  original_coach_id: string | null;
  valid_from: string | null;
  valid_until: string | null;
  status: "active" | "ended" | "scheduled";
  created_at: string;
};

// ---- Coaches (academy admin view) ----

export function useCoaches(academyProviderId: string | undefined) {
  return useQuery({
    queryKey: ["coaches", academyProviderId],
    enabled: !!academyProviderId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coaches")
        .select(
          "id, academy_provider_id, full_name, email, phone, bio, qualifications, experience_years, specializations, photo_url, linked_user_id, status, invited_at, accepted_at, removed_at"
        )
        .eq("academy_provider_id", academyProviderId!)
        .neq("status", "removed")
        .order("full_name");
      if (error) throw error;
      return (data ?? []) as Coach[];
    },
  });
}

export function useCoachAssignments(academyProviderId: string | undefined) {
  return useQuery({
    queryKey: ["coach-assignments", academyProviderId],
    enabled: !!academyProviderId,
    queryFn: async () => {
      const { data: coachIds } = await supabase
        .from("coaches")
        .select("id")
        .eq("academy_provider_id", academyProviderId!)
        .neq("status", "removed");
      const ids = coachIds?.map((c) => c.id) ?? [];
      if (!ids.length) return [] as CoachAssignment[];
      const { data, error } = await supabase
        .from("coach_assignments")
        .select("id, coach_id, scope_type, scope_id, is_temporary, original_coach_id, valid_from, valid_until, status, created_at")
        .in("coach_id", ids)
        .eq("status", "active");
      if (error) throw error;
      return (data ?? []) as CoachAssignment[];
    },
  });
}

// ---- Coach-self view (for the logged-in coach) ----

/** Active coach records linked to the current user (one per academy they coach at) */
export function useMyCoachProfiles() {
  return useQuery({
    queryKey: ["my-coach-profiles"],
    queryFn: async () => {
      // RLS coaches_self_select limits to my linked rows
      const { data, error } = await supabase
        .from("coaches")
        .select(
          "id, academy_provider_id, full_name, email, status, " +
            "service_providers!coaches_academy_provider_id_fkey(id, business_name, provider_type)"
        )
        .eq("status", "active");
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Active assignments for the logged-in coach */
export function useMyCoachAssignments() {
  return useQuery({
    queryKey: ["my-coach-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coach_assignments")
        .select("id, coach_id, scope_type, scope_id, is_temporary, valid_from, valid_until")
        .eq("status", "active");
      if (error) throw error;
      return (data ?? []) as CoachAssignment[];
    },
  });
}

// ---- Mutations ----

export function useInviteCoach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      academyProviderId: string;
      fullName: string;
      email: string;
      phone?: string;
      bio?: string;
      qualifications?: string;
      experienceYears?: number | null;
      specializations?: string[];
      photoUrl?: string;
    }) => {
      const { data, error } = await supabase.rpc("invite_coach", {
        p_academy_provider_id: input.academyProviderId,
        p_full_name: input.fullName,
        p_email: input.email,
        p_phone: input.phone ?? null,
        p_bio: input.bio ?? null,
        p_qualifications: input.qualifications ?? null,
        p_experience_years: input.experienceYears ?? null,
        p_specializations: input.specializations ?? [],
        p_photo_url: input.photoUrl ?? null,
      });
      if (error) throw error;
      return data as Coach;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["coaches", vars.academyProviderId] });
    },
  });
}

export function useAssignCoach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      coachId: string;
      scopeType: "class" | "batch";
      scopeId: string;
      isTemporary?: boolean;
      validFrom?: string;
      validUntil?: string;
    }) => {
      const { data, error } = await supabase.rpc("assign_coach", {
        p_coach_id: input.coachId,
        p_scope_type: input.scopeType,
        p_scope_id: input.scopeId,
        p_is_temporary: input.isTemporary ?? false,
        p_valid_from: input.validFrom ?? null,
        p_valid_until: input.validUntil ?? null,
      });
      if (error) throw error;
      return data as CoachAssignment;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coach-assignments"] });
      qc.invalidateQueries({ queryKey: ["coaches"] });
    },
  });
}

export function useEndCoachAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.rpc("end_coach_assignment", {
        p_assignment_id: assignmentId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coach-assignments"] });
    },
  });
}

export function useRemoveCoach() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (coachId: string) => {
      const { error } = await supabase.rpc("remove_coach", { p_coach_id: coachId });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["coaches"] });
      qc.invalidateQueries({ queryKey: ["coach-assignments"] });
    },
  });
}

/** Called at session start. Links + activates any pending coach invites for the user's email. */
export async function acceptCoachInvitesForCurrentSession() {
  const { data, error } = await supabase.rpc("accept_coach_invites");
  if (error) {
    console.warn("[CampusBee] accept_coach_invites failed:", error);
    return 0;
  }
  return (data as number) ?? 0;
}

// ---- Effective provider context (admin vs coach) ----

/**
 * Resolves the "effective" provider context for the current session.
 *
 * For an academy admin → returns their provider_id, role 'admin', and undefined
 * scope arrays (meaning unrestricted within their own provider).
 *
 * For a coach → returns the academy provider_id, role 'coach', and the list of
 * class IDs / batch IDs they have active assignments to. Hooks that filter
 * lists should AND these in to client-side filters; RLS already blocks
 * unauthorised rows server-side as a safety net.
 *
 * If the user is both an admin (owns a provider) AND a coach elsewhere, the
 * admin role takes precedence.
 */
export function useEffectiveProviderContext() {
  const { providerProfile, coachProfiles } = useUser();
  const myAssign = useMyCoachAssignments();

  return useMemo(() => {
    if (providerProfile?.id) {
      return {
        providerId: providerProfile.id as string,
        role: "admin" as const,
        isAdmin: true,
        isCoach: false,
        scopedClassIds: undefined as string[] | undefined,
        scopedBatchIds: undefined as string[] | undefined,
      };
    }
    const first = coachProfiles[0];
    if (!first) {
      return {
        providerId: undefined as string | undefined,
        role: "none" as const,
        isAdmin: false,
        isCoach: false,
        scopedClassIds: undefined as string[] | undefined,
        scopedBatchIds: undefined as string[] | undefined,
      };
    }
    const assignments = myAssign.data ?? [];
    const classIds = assignments.filter((a) => a.scope_type === "class").map((a) => a.scope_id);
    const batchIds = assignments.filter((a) => a.scope_type === "batch").map((a) => a.scope_id);
    return {
      providerId: first.academy_provider_id,
      role: "coach" as const,
      isAdmin: false,
      isCoach: true,
      scopedClassIds: classIds,
      scopedBatchIds: batchIds,
    };
  }, [providerProfile?.id, coachProfiles, myAssign.data]);
}

// ---- Send payment reminder (used from ProviderPayments) ----

export function useSendPaymentReminder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { paymentId: string; notes?: string }) => {
      const { data, error } = await supabase.rpc("send_payment_reminder", {
        p_payment_id: input.paymentId,
        p_notes: input.notes ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-payments"] });
    },
  });
}
