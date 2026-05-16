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
          billing_period, amount_paid,
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
      /** Optional explicit override. If omitted, RPC derives from billing_period. */
      grantedUntil?: string;
    }) => {
      const { error } = await supabase.rpc("approve_subscription_request", {
        p_request_id: input.requestId,
        p_valid_until: input.grantedUntil ?? null,
      });
      if (error) throw error;
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
      /** Kept for API compatibility — the SQL function resolves admin identity
       *  via current_user_id() internally. */
      reviewedBy?: string;
      actionNotes?: string;
    }) => {
      const { error } = await supabase.rpc("resolve_moderation_flag" as any, {
        p_flag_id: input.flagId,
        p_status: input.action,
        p_notes: input.actionNotes || null,
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
          valid_from, valid_until,
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

// ---- Refresh sponsored / banner lifecycle (invokes the cron edge function) ----

export type RefreshSponsoredResult = {
  ok: boolean;
  sponsored_activated: number;
  sponsored_expired: number;
  banners_activated: number;
  banners_expired: number;
  ran_at: string;
};

/** Manually fires the `refresh-sponsored-slots` edge function so approved
 *  rows flip to `active` immediately and expired rows are retired.
 *  The 15-min Supabase cron continues to run independently.
 *
 *  On success, invalidates the platform-sponsored and platform-banners
 *  query keys so the admin queue reflects the new state.
 */
export function useRefreshSponsoredSlots() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<RefreshSponsoredResult> => {
      const { data, error } = await supabase.functions.invoke("refresh-sponsored-slots");
      if (error) throw error;
      return data as RefreshSponsoredResult;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-sponsored"] });
      qc.invalidateQueries({ queryKey: ["platform-banners"] });
      qc.invalidateQueries({ queryKey: ["sponsored-for-location"] });
      qc.invalidateQueries({ queryKey: ["featured-banners"] });
    },
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

// ---- Subscription Plans (admin: read & edit) -------------------------------

export type AdminSubscriptionPlan = {
  id: string;
  billing_period: "monthly" | "annual";
  mrp: number;
  price: number;
  currency: string;
  duration_days: number;
  is_active: boolean;
  updated_at: string;
};

export function useAllSubscriptionPlans() {
  return useQuery({
    queryKey: ["subscription-plans", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, billing_period, mrp, price, currency, duration_days, is_active, updated_at")
        .order("duration_days");
      if (error) throw error;
      return (data ?? []) as AdminSubscriptionPlan[];
    },
  });
}

export function useUpdateSubscriptionPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      billingPeriod: "monthly" | "annual";
      mrp: number;
      price: number;
      isActive: boolean;
      updatedBy?: string;
    }) => {
      const { error } = await supabase
        .from("subscription_plans")
        .update({
          mrp: input.mrp,
          price: input.price,
          is_active: input.isActive,
          updated_by: input.updatedBy ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("billing_period", input.billingPeriod);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscription-plans"] });
    },
  });
}

// ---- Platform Payment Details (admin: read & edit) -------------------------

export type AdminPlatformPaymentDetails = {
  id: string;
  upi_id: string | null;
  upi_qr_url: string | null;
  bank_account: string | null;
  ifsc: string | null;
  bank_name: string | null;
  account_holder: string | null;
  updated_at: string;
};

export function useAdminPlatformPaymentDetails() {
  return useQuery({
    queryKey: ["platform-payment-details", "admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_payment_details")
        .select("id, upi_id, upi_qr_url, bank_account, ifsc, bank_name, account_holder, updated_at")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as AdminPlatformPaymentDetails | null;
    },
  });
}

export function useUpdatePlatformPaymentDetails() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      id: string;
      upiId: string | null;
      upiQrUrl?: string | null;
      bankAccount: string | null;
      ifsc: string | null;
      bankName: string | null;
      accountHolder: string | null;
      updatedBy?: string;
    }) => {
      const patch: Record<string, unknown> = {
        upi_id: input.upiId,
        bank_account: input.bankAccount,
        ifsc: input.ifsc,
        bank_name: input.bankName,
        account_holder: input.accountHolder,
        updated_by: input.updatedBy ?? null,
        updated_at: new Date().toISOString(),
      };
      if (input.upiQrUrl !== undefined) patch.upi_qr_url = input.upiQrUrl;
      const { error } = await supabase
        .from("platform_payment_details")
        .update(patch)
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["platform-payment-details"] });
    },
  });
}

/** Upload UPI QR image to provider-media bucket under a `platform/` folder. */
export function useUploadPlatformQr() {
  return useMutation({
    mutationFn: async ({ file }: { file: File }) => {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `platform/upi-qr-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("provider-media")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("provider-media").getPublicUrl(path);
      return data.publicUrl;
    },
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
