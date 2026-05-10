import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Provider hooks ────────────────────────────────────────────────────────────

/** Fetch all category requests submitted by this provider. */
export function useMyCategoryRequests(providerId: string | undefined) {
  return useQuery({
    queryKey: ["category-requests", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("category_requests")
        .select(`
          id, request_type, requested_name, requested_icon, description,
          requested_subcategories,
          status, admin_notes, parent_category_id, retag_category_id, requested_at,
          parent_cat:class_categories!category_requests_parent_category_id_fkey(id, name, icon),
          retag_cat:class_categories!category_requests_retag_category_id_fkey(id, name, icon)
        `)
        .eq("provider_id", providerId!)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

/**
 * Dashboard-friendly alias — same data as useMyCategoryRequests.
 * ProviderDashboard uses r.requested_name / r.admin_notes / r.status.
 */
export const useProviderCategoryRequests = useMyCategoryRequests;

/** Submit a new category / sub-category request. Returns { id }. */
export function useSubmitCategoryRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      providerId: string;
      requestType: "new_category" | "new_subcategory";
      name: string;
      description?: string;
      /** Icon name — only relevant for new_category requests */
      icon?: string;
      parentCategoryId: string | null;
      /** Sub-category names to auto-create on approval (new_category only) */
      subcategories?: string[];
    }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("You must be signed in to submit a category request.");
      }

      const { data: provider, error: providerErr } = await supabase
        .from("service_providers")
        .select("id")
        .eq("user_id", user.id)
        .limit(1);
      if (providerErr) throw providerErr;

      const resolvedProviderId = provider?.[0]?.id ?? input.providerId;
      if (!resolvedProviderId) {
        throw new Error("Provider profile not found for this account.");
      }

      const { data, error } = await supabase
        .from("category_requests")
        .insert({
          provider_id:             resolvedProviderId,
          request_type:            input.requestType,
          requested_name:          input.name,
          requested_icon:          input.icon ?? null,
          description:             input.description ?? null,
          parent_category_id:      input.parentCategoryId,
          requested_subcategories: input.subcategories?.length
            ? input.subcategories
            : null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["category-requests", vars.providerId] });
    },
  });
}

/** Provider responds to an admin retag suggestion (accepted = true / declined = false). */
export function useRespondToRetag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ requestId, accepted }: { requestId: string; accepted: boolean }) => {
      const { error } = await supabase.rpc("respond_to_category_retag", {
        p_request_id: requestId,
        p_accepted:   accepted,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["category-requests"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

// ── Platform-admin hooks ──────────────────────────────────────────────────────

/** Fetch all category requests (admin view). Pass "all" for no status filter. */
export function usePlatformCategoryRequests(status: string = "pending") {
  return useQuery({
    queryKey: ["category-requests-admin", status],
    queryFn: async () => {
      let query = supabase
        .from("category_requests")
        .select(`
          id, request_type, requested_name, requested_icon, description,
          requested_subcategories,
          status, admin_notes, admin_modified_name, admin_modified_icon,
          retag_category_id, parent_category_id, requested_at,
          service_providers(business_name),
          parent_cat:class_categories!category_requests_parent_category_id_fkey(id, name, icon),
          retag_cat:class_categories!category_requests_retag_category_id_fkey(id, name, icon)
        `)
        .order("requested_at", { ascending: false });

      if (status !== "all") {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

/** Platform admin: count of pending category requests (for dashboard badge). */
export function usePendingCategoryRequestCount() {
  return useQuery({
    queryKey: ["category-requests-admin-count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("category_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
  });
}

/**
 * Approve a request: calls the approve_category_request RPC which atomically
 * creates the category (+ any requested sub-categories) and notifies the provider.
 */
export function useApproveCategoryRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      requestId:   string;
      finalName:   string;
      finalIcon?:  string;
      parentId?:   string;
      adminUserId: string;
    }) => {
      const { data, error } = await supabase.rpc("approve_category_request", {
        p_request_id:    input.requestId,
        p_admin_user_id: input.adminUserId,
        p_final_name:    input.finalName,
        p_final_icon:    input.finalIcon ?? null,
        p_parent_id:     input.parentId ?? null,
      });
      if (error) throw error;
      return data as string; // new category UUID
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["category-requests-admin"] });
      qc.invalidateQueries({ queryKey: ["category-requests-admin-count"] });
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
}

/** Reject a request with a reason (shown to the provider). */
export function useRejectCategoryRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      requestId:   string;
      reason:      string;
      adminUserId: string;
    }) => {
      const { error } = await supabase.rpc("reject_category_request", {
        p_request_id:    input.requestId,
        p_admin_user_id: input.adminUserId,
        p_reason:        input.reason,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["category-requests-admin"] });
      qc.invalidateQueries({ queryKey: ["category-requests-admin-count"] });
    },
  });
}

/**
 * Suggest an existing category as a re-tag.
 * Provider receives a notification and must Accept or Decline.
 */
export function useRetagCategoryRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      requestId:       string;
      retagCategoryId: string;
      notes?:          string;
      adminUserId:     string;
    }) => {
      const { error } = await supabase.rpc("retag_category_request", {
        p_request_id:    input.requestId,
        p_admin_user_id: input.adminUserId,
        p_retag_cat_id:  input.retagCategoryId,
        p_notes:         input.notes ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["category-requests-admin"] });
    },
  });
}
