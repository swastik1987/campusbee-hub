import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Types ─────────────────────────────────────────────────────────────────────

export type ModerationStatus = "pending" | "approved" | "in_review" | "rejected";

export type RefType =
  | "class_image"
  | "class_text"
  | "class_title"
  | "class_description"
  | "provider_avatar"
  | "provider_bio"
  | "banner";

export interface ModerationFlag {
  id: string;
  ref_type: string;
  ref_id: string;
  owner_user_id: string | null;
  content_snapshot: string | null;
  image_url: string | null;
  ai_provider: string | null;
  ai_score: number | null;
  ai_categories: Record<string, unknown> | null;
  status: ModerationStatus;
  action_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  owner?: { id: string; full_name: string | null; avatar_url: string | null } | null;
}

interface ModerationResult {
  status: "approved" | "in_review" | "rejected";
  flagId?: string;
}

// ── useSubmitForModeration ────────────────────────────────────────────────────
// Calls the ai-moderate-content edge function. Returns status + optional flagId.

export function useSubmitForModeration() {
  return useMutation({
    mutationFn: async ({
      refType,
      refId,
      ownerUserId,
      text,
      imageUrl,
    }: {
      refType: RefType;
      refId: string;
      ownerUserId: string;
      text?: string;
      imageUrl?: string;
    }): Promise<ModerationResult> => {
      const { data, error } = await supabase.functions.invoke("ai-moderate-content", {
        body: {
          ref_type: refType,
          ref_id: refId,
          owner_user_id: ownerUserId,
          text,
          image_url: imageUrl,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as ModerationResult;
    },
  });
}

// ── usePendingModerationQueue ─────────────────────────────────────────────────
// Admin-only: all flags currently in_review, newest first.

export function usePendingModerationQueue() {
  return useQuery({
    queryKey: ["moderation-queue"],
    queryFn: async (): Promise<ModerationFlag[]> => {
      const { data, error } = await supabase
        .from("moderation_flags")
        .select(`
          id, ref_type, ref_id, owner_user_id, content_snapshot, image_url,
          ai_provider, ai_score, ai_categories, status, action_notes,
          reviewed_by, reviewed_at, created_at,
          owner:users!moderation_flags_owner_user_id_fkey(id, full_name, avatar_url)
        `)
        .eq("status", "in_review")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ModerationFlag[];
    },
  });
}

// ── useAllModerationFlags ─────────────────────────────────────────────────────
// Admin-only: all flags, optionally filtered by status.

export function useAllModerationFlags(status?: "in_review" | "approved" | "rejected") {
  return useQuery({
    queryKey: ["moderation-flags", status ?? "all"],
    queryFn: async (): Promise<ModerationFlag[]> => {
      let query = supabase
        .from("moderation_flags")
        .select(`
          id, ref_type, ref_id, owner_user_id, content_snapshot, image_url,
          ai_provider, ai_score, ai_categories, status, action_notes,
          reviewed_by, reviewed_at, created_at,
          owner:users!moderation_flags_owner_user_id_fkey(id, full_name, avatar_url)
        `)
        .order("created_at", { ascending: false });

      if (status) {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as ModerationFlag[];
    },
  });
}

// ── useResolveModerationFlag ──────────────────────────────────────────────────
// Admin-only: approve or reject a queued flag. Calls resolve_moderation_flag RPC.

export function useResolveModerationFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      flagId,
      status,
      notes,
    }: {
      flagId: string;
      status: "approved" | "rejected";
      notes?: string;
    }) => {
      const { error } = await supabase.rpc("resolve_moderation_flag", {
        p_flag_id: flagId,
        p_status: status,
        p_notes: notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moderation-queue"] });
      qc.invalidateQueries({ queryKey: ["moderation-flags"] });
      qc.invalidateQueries({ queryKey: ["moderation-count"] });
    },
  });
}

// ── usePendingModerationCount ─────────────────────────────────────────────────
// Admin dashboard widget: count of in_review flags. Auto-refreshes every minute.

export function usePendingModerationCount() {
  return useQuery({
    queryKey: ["moderation-count"],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.rpc("get_pending_moderation_count");
      if (error) throw error;
      return (data as number) ?? 0;
    },
    refetchInterval: 60_000,
  });
}

// ── useFlagsByRef ─────────────────────────────────────────────────────────────
// Fetch all moderation flags for a specific content item (e.g. a class).
// Useful for showing moderation history inline on a class detail page.

export function useFlagsByRef(refType: RefType | undefined, refId: string | undefined) {
  return useQuery({
    queryKey: ["moderation-flags-ref", refType, refId],
    enabled: !!refType && !!refId,
    queryFn: async (): Promise<ModerationFlag[]> => {
      const { data, error } = await supabase
        .from("moderation_flags")
        .select(
          "id, ref_type, ref_id, ai_provider, ai_score, status, action_notes, reviewed_at, created_at",
        )
        .eq("ref_type", refType!)
        .eq("ref_id", refId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ModerationFlag[];
    },
  });
}
