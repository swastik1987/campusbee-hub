import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────────────

export type CategoryRequest = {
  id: string;
  provider_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  parent_category_id: string | null;
  status: "pending" | "approved" | "rejected";
  rejection_reason: string | null;
  requested_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  service_providers?: { business_name: string | null } | null;
  class_categories?: { name: string } | null;
};

// ── Provider: own requests ─────────────────────────────────────────────────────

export function useProviderCategoryRequests(providerId: string | undefined) {
  return useQuery({
    queryKey: ["category-requests", "provider", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("category_requests")
        .select(
          "id, name, description, icon, parent_category_id, status, rejection_reason, requested_at, reviewed_at, class_categories(name)"
        )
        .eq("provider_id", providerId!)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CategoryRequest[];
    },
  });
}

export function useSubmitCategoryRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      providerId: string;
      name: string;
      description?: string;
      icon?: string;
      parentCategoryId?: string | null;
    }) => {
      const { data, error } = await (supabase as any)
        .from("category_requests")
        .insert({
          provider_id: input.providerId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          icon: input.icon?.trim() || null,
          parent_category_id: input.parentCategoryId || null,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data as { id: string };
    },
    onSuccess: (_, input) => {
      qc.invalidateQueries({ queryKey: ["category-requests", "provider", input.providerId] });
      qc.invalidateQueries({ queryKey: ["category-requests", "count"] });
    },
  });
}

// ── Platform Admin: all requests ───────────────────────────────────────────────

export function usePlatformCategoryRequests(statusFilter?: string) {
  return useQuery({
    queryKey: ["category-requests", "platform", statusFilter ?? "all"],
    queryFn: async () => {
      let query = (supabase as any)
        .from("category_requests")
        .select(
          `id, name, description, icon, parent_category_id, status,
           rejection_reason, requested_at, reviewed_at,
           service_providers(business_name),
           class_categories(name)`
        );

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query.order("requested_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CategoryRequest[];
    },
  });
}

export function usePendingCategoryRequestCount() {
  return useQuery({
    queryKey: ["category-requests", "count"],
    queryFn: async () => {
      const { count, error } = await (supabase as any)
        .from("category_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending");
      if (error) throw error;
      return (count ?? 0) as number;
    },
  });
}

export function useApproveCategoryRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      requestId: string;
      name: string;
      icon?: string | null;
      parentCategoryId?: string | null;
      adminUserId: string;
    }) => {
      // 1. Fetch request info for notification later
      const { data: req } = await (supabase as any)
        .from("category_requests")
        .select("provider_id, service_providers(user_id)")
        .eq("id", input.requestId)
        .single();

      // 2. Create category in class_categories
      const slug = input.name
        .toLowerCase()
        .trim()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");

      const { data: cat, error: catErr } = await supabase
        .from("class_categories")
        .insert({
          name: input.name.trim(),
          slug,
          icon: input.icon || null,
          parent_id: input.parentCategoryId || null,
          sort_order: 999,
          is_active: true,
        } as any)
        .select("id")
        .single();
      if (catErr) throw catErr;

      const newCategoryId = (cat as any).id as string;

      // 3. Update classes that referenced this pending request
      await supabase
        .from("classes")
        .update({
          category_id: newCategoryId,
          pending_category_request_id: null,
        } as any)
        .eq("pending_category_request_id" as any, input.requestId);

      // 4. Mark request approved
      const { error: reqErr } = await (supabase as any)
        .from("category_requests")
        .update({
          status: "approved",
          reviewed_by: input.adminUserId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", input.requestId);
      if (reqErr) throw reqErr;

      // 5. Notify provider
      const providerUserId = (req as any)?.service_providers?.user_id;
      if (providerUserId) {
        await supabase.rpc("send_notification" as any, {
          p_user_id: providerUserId,
          p_title: "Category Approved!",
          p_body: `Your category request "${input.name}" was approved and is now live.`,
          p_type: "category_approved",
          p_ref_type: "category_request",
          p_ref_id: input.requestId,
        });
      }

      return { categoryId: newCategoryId };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["category-requests"] });
      qc.invalidateQueries({ queryKey: ["categories-all"] });
      qc.invalidateQueries({ queryKey: ["platform-categories"] });
    },
  });
}

export function useRejectCategoryRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      requestId: string;
      reason: string;
      adminUserId: string;
    }) => {
      // Fetch request info for notification
      const { data: req } = await (supabase as any)
        .from("category_requests")
        .select("name, service_providers(user_id)")
        .eq("id", input.requestId)
        .single();

      const { error } = await (supabase as any)
        .from("category_requests")
        .update({
          status: "rejected",
          rejection_reason: input.reason.trim(),
          reviewed_by: input.adminUserId,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", input.requestId);
      if (error) throw error;

      // Notify provider
      const providerUserId = (req as any)?.service_providers?.user_id;
      if (providerUserId) {
        await supabase.rpc("send_notification" as any, {
          p_user_id: providerUserId,
          p_title: "Category Request Not Approved",
          p_body: `Your request for "${(req as any)?.name}" wasn't approved: ${input.reason}`,
          p_type: "category_rejected",
          p_ref_type: "category_request",
          p_ref_id: input.requestId,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["category-requests"] });
      qc.invalidateQueries({ queryKey: ["category-requests", "count"] });
    },
  });
}
