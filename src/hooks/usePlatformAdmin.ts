import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---- Platform-wide Stats ----

export function usePlatformStats() {
  return useQuery({
    queryKey: ["platform-stats"],
    queryFn: async () => {
      const [providers, classes, enrollments, userCount] = await Promise.all([
        supabase.from("service_providers").select("id", { count: "exact", head: true }),
        supabase.from("classes").select("id", { count: "exact", head: true }).eq("status", "published"),
        supabase.from("enrollments").select("id", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("users").select("id", { count: "exact", head: true }),
      ]);

      return {
        totalProviders: providers.count ?? 0,
        totalPublishedClasses: classes.count ?? 0,
        totalActiveEnrollments: enrollments.count ?? 0,
        totalSeekers: userCount.count ?? 0,
      };
    },
  });
}

// ---- Provider Management (Platform Admin) ----

export function usePlatformProviders(filters?: { status?: string; tier?: string }) {
  return useQuery({
    queryKey: ["platform-providers", filters],
    queryFn: async () => {
      let query = supabase
        .from("service_providers")
        .select(`
          id, user_id, business_name, provider_type, bio, experience_years,
          is_verified, subscription_tier, subscription_valid_until,
          suspended_at, suspension_reason, created_at,
          users(id, full_name, email, avatar_url, is_active)
        `)
        .order("created_at", { ascending: false });

      if (filters?.tier) {
        query = query.eq("subscription_tier", filters.tier);
      }
      if (filters?.status === "suspended") {
        query = query.not("suspended_at", "is", null);
      } else if (filters?.status === "active") {
        query = query.is("suspended_at", null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useVerifyProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ providerId, isVerified }: { providerId: string; isVerified: boolean }) => {
      const { error } = await supabase
        .from("service_providers")
        .update({ is_verified: isVerified })
        .eq("id", providerId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-providers"] }),
  });
}

export function useSuspendProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ providerId, reason }: { providerId: string; reason: string }) => {
      const { error } = await supabase
        .from("service_providers")
        .update({
          suspended_at: new Date().toISOString(),
          suspension_reason: reason,
        })
        .eq("id", providerId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-providers"] }),
  });
}

export function useReinstateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (providerId: string) => {
      const { error } = await supabase
        .from("service_providers")
        .update({ suspended_at: null, suspension_reason: null })
        .eq("id", providerId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-providers"] }),
  });
}

// ---- Subscription Management ----

export function usePlatformSubscriptionRequests(status?: string) {
  return useQuery({
    queryKey: ["platform-subscription-requests", status],
    queryFn: async () => {
      let query = supabase
        .from("provider_subscription_requests")
        .select(`
          id, provider_id, requested_tier, status, notes, off_app_payment_ref,
          requested_at, reviewed_by, reviewed_at, granted_until,
          service_providers(id, business_name, subscription_tier,
            users(full_name, email, avatar_url)
          )
        `)
        .order("requested_at", { ascending: false });

      if (status && status !== "all") {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useApproveSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      requestId: string;
      reviewedBy: string;
      grantedUntil: string;
    }) => {
      // Approve the request
      const { data: req, error: reqErr } = await supabase
        .from("provider_subscription_requests")
        .update({
          status: "approved",
          reviewed_by: input.reviewedBy,
          reviewed_at: new Date().toISOString(),
          granted_until: input.grantedUntil,
        })
        .eq("id", input.requestId)
        .select("provider_id")
        .single();
      if (reqErr) throw reqErr;

      // Upgrade provider tier
      const { error: provErr } = await supabase
        .from("service_providers")
        .update({
          subscription_tier: "premium",
          subscription_valid_until: input.grantedUntil,
        })
        .eq("id", req.provider_id);
      if (provErr) throw provErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-subscription-requests"] });
      qc.invalidateQueries({ queryKey: ["platform-providers"] });
    },
  });
}

export function useRejectSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      requestId: string;
      reviewedBy: string;
      notes?: string;
    }) => {
      const { error } = await supabase
        .from("provider_subscription_requests")
        .update({
          status: "rejected",
          reviewed_by: input.reviewedBy,
          reviewed_at: new Date().toISOString(),
          notes: input.notes || null,
        })
        .eq("id", input.requestId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-subscription-requests"] }),
  });
}

// ---- Moderation Queue ----

export function useModerationQueue(status?: string) {
  return useQuery({
    queryKey: ["moderation-queue", status],
    queryFn: async () => {
      let query = supabase
        .from("moderation_flags")
        .select(`
          id, ref_type, ref_id, content_snapshot, image_url,
          ai_provider, ai_score, ai_categories, status,
          reviewed_by, reviewed_at, action_notes, created_at
        `)
        .order("created_at", { ascending: false });

      if (status && status !== "all") {
        query = query.eq("status", status);
      } else {
        query = query.eq("status", "in_review");
      }

      const { data, error } = await query.limit(50);
      if (error) throw error;
      return data;
    },
  });
}

export function useResolveModerationFlag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      flagId: string;
      action: "approved" | "rejected";
      reviewedBy: string;
      actionNotes?: string;
    }) => {
      const { error } = await supabase.rpc("resolve_moderation_flag" as any, {
        p_flag_id: input.flagId,
        p_action: input.action,
        p_reviewed_by: input.reviewedBy,
        p_action_notes: input.actionNotes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["moderation-queue"] }),
  });
}

// ---- Sponsored Slots Management ----

export function usePlatformSponsoredRequests(status?: string | string[]) {
  const key = Array.isArray(status) ? status.join(",") : status;
  return useQuery({
    queryKey: ["platform-sponsored", key],
    queryFn: async () => {
      let query = supabase
        .from("sponsored_listings")
        .select(`
          id, class_id, provider_id, status, slot_position,
          radius_km, valid_from, valid_until, center_address,
          impression_count, click_count,
          off_app_payment_ref, rejection_reason, requested_at,
          reviewed_by, reviewed_at,
          classes(title, cover_image_url, class_categories(name)),
          service_providers(business_name, users(full_name))
        `)
        .order("requested_at", { ascending: false });

      if (Array.isArray(status) && status.length) {
        query = query.in("status", status);
      } else if (typeof status === "string" && status !== "all") {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useApproveSponsored() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      listingId: string;
      reviewedBy: string;
      validFrom: string;
      validUntil: string;
      offAppPaymentRef?: string;
    }) => {
      // Phase 8: slot_position is computed at query time by sponsored_for_location.
      // We mark the request 'approved'; the refresh_sponsored_lifecycle cron
      // flips approved → active when valid_from <= now() <= valid_until.
      const { error } = await supabase
        .from("sponsored_listings")
        .update({
          status: "approved",
          valid_from: input.validFrom,
          valid_until: input.validUntil,
          off_app_payment_ref: input.offAppPaymentRef ?? null,
          reviewed_by: input.reviewedBy,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", input.listingId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-sponsored"] }),
  });
}

// ---- Featured Banners Management ----

export function usePlatformBannerRequests(status?: string | string[]) {
  const key = Array.isArray(status) ? status.join(",") : status;
  return useQuery({
    queryKey: ["platform-banners", key],
    queryFn: async () => {
      let query = supabase
        .from("featured_banners")
        .select(`
          id, provider_id, class_id, surface, image_url, target_url,
          status, moderation_status, center_address, radius_km,
          valid_from, valid_until, impression_count, click_count,
          off_app_payment_ref, rejection_reason, requested_at,
          reviewed_by, reviewed_at,
          service_providers(business_name, users(full_name)),
          classes(title, cover_image_url)
        `)
        .order("requested_at", { ascending: false });

      if (Array.isArray(status) && status.length) {
        query = query.in("status", status);
      } else if (typeof status === "string" && status !== "all") {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useApproveFeaturedBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      bannerId: string;
      reviewedBy: string;
      validFrom: string;
      validUntil: string;
      offAppPaymentRef?: string;
    }) => {
      const { error } = await supabase
        .from("featured_banners")
        .update({
          status: "approved",
          moderation_status: "approved",
          valid_from: input.validFrom,
          valid_until: input.validUntil,
          off_app_payment_ref: input.offAppPaymentRef ?? null,
          reviewed_by: input.reviewedBy,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", input.bannerId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-banners"] }),
  });
}

export function useRejectFeaturedBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      bannerId: string;
      reviewedBy: string;
      rejectionReason?: string;
    }) => {
      const { error } = await supabase
        .from("featured_banners")
        .update({
          status: "rejected",
          rejection_reason: input.rejectionReason || null,
          reviewed_by: input.reviewedBy,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", input.bannerId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-banners"] }),
  });
}

// ---- Platform Settings (key-value JSON editor) ----

export function usePlatformSettings() {
  return useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("key, value, description, updated_at")
        .order("key");
      if (error) throw error;
      return data as { key: string; value: unknown; description: string | null; updated_at: string }[];
    },
  });
}

export function useUpdatePlatformSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { key: string; value: unknown; updatedBy: string }) => {
      const { error } = await supabase
        .from("platform_settings")
        .update({
          value: input.value as never,
          updated_by: input.updatedBy,
          updated_at: new Date().toISOString(),
        })
        .eq("key", input.key);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-settings"] }),
  });
}

export function useRejectSponsored() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      listingId: string;
      reviewedBy: string;
      rejectionReason?: string;
    }) => {
      const { error } = await supabase
        .from("sponsored_listings")
        .update({
          status: "rejected",
          rejection_reason: input.rejectionReason || null,
          reviewed_by: input.reviewedBy,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", input.listingId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-sponsored"] }),
  });
}

// ---- User Search ----

export function useSearchUsers(searchTerm: string) {
  return useQuery({
    queryKey: ["search-users", searchTerm],
    enabled: searchTerm.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, full_name, email, mobile_number, avatar_url")
        .or(`full_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(20);
      if (error) throw error;
      return (data ?? []) as { id: string; full_name: string; email: string; mobile_number: string; avatar_url: string }[];
    },
  });
}

// ---- Category Management ----

export function usePlatformCategories() {
  return useQuery({
    queryKey: ["platform-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_categories")
        .select("id, name, slug, icon, parent_id, sort_order, is_active")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      name: string;
      slug: string;
      iconName?: string;
      parentCategoryId?: string;
      displayOrder?: number;
    }) => {
      const { error } = await supabase.from("class_categories").insert({
        name: input.name,
        slug: input.slug,
        icon: input.iconName || null,
        parent_id: input.parentCategoryId || null,
        sort_order: input.displayOrder ?? 0,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-categories"] }),
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      name?: string;
      slug?: string;
      iconName?: string;
      displayOrder?: number;
      isActive?: boolean;
      parentCategoryId?: string | null;
    }) => {
      const payload: any = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.slug !== undefined) payload.slug = updates.slug;
      if (updates.iconName !== undefined) payload.icon = updates.iconName;
      if (updates.displayOrder !== undefined) payload.sort_order = updates.displayOrder;
      if (updates.isActive !== undefined) payload.is_active = updates.isActive;
      if (updates.parentCategoryId !== undefined) payload.parent_id = updates.parentCategoryId;

      const { error } = await supabase
        .from("class_categories")
        .update(payload)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["platform-categories"] }),
  });
}

// ---- Platform Growth Analytics ----

export function usePlatformGrowth(months: number = 6) {
  return useQuery({
    queryKey: ["platform-growth", months],
    queryFn: async () => {
      const [usersRes, enrollmentsRes, providersRes] = await Promise.all([
        supabase.from("users").select("id, created_at").order("created_at"),
        supabase.from("enrollments").select("id, created_at").order("created_at"),
        supabase.from("service_providers").select("id, created_at").order("created_at"),
      ]);

      const now = new Date();
      const growth: { month: string; users: number; enrollments: number; providers: number }[] = [];

      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const label = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
        const monthKey = d.toISOString().slice(0, 7);

        const userCount = (usersRes.data ?? []).filter(
          (u) => u.created_at && u.created_at.slice(0, 7) === monthKey
        ).length;
        const enrollCount = (enrollmentsRes.data ?? []).filter(
          (e) => e.created_at && e.created_at.slice(0, 7) === monthKey
        ).length;
        const providerCount = (providersRes.data ?? []).filter(
          (p) => p.created_at && p.created_at.slice(0, 7) === monthKey
        ).length;

        growth.push({ month: label, users: userCount, enrollments: enrollCount, providers: providerCount });
      }

      // Category-wise class breakdown (replaces city-wise apartment breakdown)
      const { data: categories } = await supabase
        .from("class_categories")
        .select("id, name")
        .is("parent_id", null)
        .eq("is_active", true);

      const { data: classes } = await supabase
        .from("classes")
        .select("id, category_id")
        .eq("status", "published");

      const categoryBreakdown = (categories ?? []).map((cat) => ({
        category: cat.name,
        count: (classes ?? []).filter((c) => c.category_id === cat.id).length,
      })).sort((a, b) => b.count - a.count);

      return { growth, categoryBreakdown };
    },
  });
}

// ---- Backward-compat stubs (v1 apartment admin hooks — removed in v2) ----

/** @deprecated v2 has no apartment_complexes */
export function usePlatformApartments() {
  return useQuery({
    queryKey: ["platform-apartments-stub"],
    queryFn: async () => [] as any[],
    staleTime: Infinity,
  });
}

/** @deprecated v2 has no apartment_complexes */
export function useApproveApartment() {
  return useMutation({ mutationFn: async (_: any) => {} });
}

/** @deprecated v2 has no apartment_complexes */
export function useRejectApartment() {
  return useMutation({ mutationFn: async (_: any) => {} });
}

/** @deprecated v2 has no apartment_complexes */
export function useCreateApartment() {
  return useMutation({ mutationFn: async (_: any) => {} });
}

/** @deprecated v2 has no apartment_admins */
export function useAssignAdmin() {
  return useMutation({ mutationFn: async (_: any) => {} });
}

/** @deprecated v2 has no apartment_admins */
export function useUnassignAdmin() {
  return useMutation({ mutationFn: async (_: any) => {} });
}
