import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

// ── Provider's own subscription requests ────────────────────────────────────

export function useMySubscriptionRequests(providerId?: string) {
  return useQuery({
    queryKey: ["my-subscription-requests", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_subscription_requests")
        .select(
          "id, provider_id, requested_tier, status, notes, off_app_payment_ref, requested_at, reviewed_at, granted_until, billing_period, amount_paid"
        )
        .eq("provider_id", providerId!)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ── Subscription Plans (read) ────────────────────────────────────────────────

export type BillingPeriod = "monthly" | "annual";

export type SubscriptionPlan = {
  id: string;
  billing_period: BillingPeriod;
  mrp: number;
  price: number;
  currency: string;
  duration_days: number;
  is_active: boolean;
  updated_at: string;
};

/**
 * Returns ACTIVE subscription plans (monthly + annual). Used by the upgrade
 * sheet. Admin's edit-everything hook lives in usePlatformAdmin.
 */
export function useActiveSubscriptionPlans() {
  return useQuery({
    queryKey: ["subscription-plans", "active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, billing_period, mrp, price, currency, duration_days, is_active, updated_at")
        .eq("is_active", true)
        .order("duration_days");
      if (error) throw error;
      return (data ?? []) as SubscriptionPlan[];
    },
  });
}

// ── Platform Payment Details (read) ──────────────────────────────────────────

export type PlatformPaymentDetails = {
  upi_id: string | null;
  upi_qr_url: string | null;
  bank_account: string | null;
  ifsc: string | null;
  bank_name: string | null;
  account_holder: string | null;
};

export function usePlatformPaymentDetails() {
  return useQuery({
    queryKey: ["platform-payment-details"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_payment_details")
        .select("upi_id, upi_qr_url, bank_account, ifsc, bank_name, account_holder")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as PlatformPaymentDetails | null;
    },
  });
}

// ── Request Premium Upgrade ──────────────────────────────────────────────────

export function useRequestPremiumUpgrade() {
  const qc = useQueryClient();
  const { providerProfile } = useUser();

  return useMutation({
    mutationFn: async ({
      notes,
      offAppPaymentRef,
      billingPeriod,
      amountPaid,
    }: {
      notes?: string;
      offAppPaymentRef?: string;
      billingPeriod: BillingPeriod;
      amountPaid: number;
    }) => {
      if (!providerProfile?.id) throw new Error("No provider profile");
      const { data, error } = await supabase.rpc("request_premium_upgrade", {
        p_provider_id: providerProfile.id,
        p_notes: notes || null,
        p_off_app_payment_ref: offAppPaymentRef || null,
        p_billing_period: billingPeriod,
        p_amount_paid: amountPaid,
      });
      if (error) throw error;
      return data as string; // request id
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-subscription-requests"] });
      qc.invalidateQueries({ queryKey: ["platform-subscription-requests"] });
    },
  });
}

// ── Competitor classes in same categories ────────────────────────────────────

export function useCompetitorClasses(
  providerId?: string,
  categoryIds?: string[]
) {
  return useQuery({
    queryKey: ["competitor-classes", providerId, categoryIds],
    enabled: !!providerId && (categoryIds?.length ?? 0) > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select(
          `id, title, category_id,
           provider_id,
           service_providers(id, business_name, is_verified, subscription_tier)`
        )
        .in("category_id", categoryIds!)
        .eq("status", "published")
        .neq("provider_id", providerId!)
        .limit(30);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

// ── Enrollment growth for the last N months ──────────────────────────────────

export function useEnrollmentGrowth(providerId?: string, months = 6) {
  return useQuery({
    queryKey: ["enrollment-growth", providerId, months],
    enabled: !!providerId,
    queryFn: async () => {
      // Fetch all enrollments for this provider's classes
      const { data: enrollments, error } = await supabase
        .from("enrollments")
        .select("id, created_at, batches!batch_id(classes(provider_id))")
        .order("created_at");
      if (error) throw error;

      const providerEnrollments = (enrollments ?? []).filter(
        (e) => (e.batches as any)?.classes?.provider_id === providerId
      );

      const now = new Date();
      const trend: { month: string; count: number; growth: number | null }[] = [];

      let prevCount: number | null = null;
      for (let i = months - 1; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = d.toISOString().slice(0, 7);
        const label = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
        const count = providerEnrollments.filter(
          (e) => e.created_at && e.created_at.slice(0, 7) === monthKey
        ).length;
        const growth =
          prevCount !== null && prevCount > 0
            ? Math.round(((count - prevCount) / prevCount) * 100)
            : null;
        trend.push({ month: label, count, growth });
        prevCount = count;
      }

      const latest = trend[trend.length - 1];
      const secondLatest = trend[trend.length - 2];
      const growthRate =
        secondLatest?.count && secondLatest.count > 0
          ? Math.round(((latest.count - secondLatest.count) / secondLatest.count) * 100)
          : null;

      return { trend, growthRate };
    },
  });
}

// ── Convenience boolean ──────────────────────────────────────────────────────

export function useIsPremium() {
  const { isPremium } = useUser();
  return isPremium;
}
