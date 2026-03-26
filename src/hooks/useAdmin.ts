import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---- Admin Stats ----

export function useAdminStats(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ["admin-stats", apartmentId],
    enabled: !!apartmentId,
    queryFn: async () => {
      const [familiesRes, providersRes, classesRes, enrollmentsRes] = await Promise.all([
        supabase
          .from("families")
          .select("id", { count: "exact", head: true })
          .eq("apartment_id", apartmentId!),
        supabase
          .from("provider_apartment_registrations")
          .select("id", { count: "exact", head: true })
          .eq("apartment_id", apartmentId!)
          .eq("status", "approved"),
        supabase
          .from("classes")
          .select("id, provider_apartment_registrations!inner(apartment_id)", { count: "exact", head: true })
          .eq("provider_apartment_registrations.apartment_id", apartmentId!)
          .eq("status", "published"),
        supabase
          .from("enrollments")
          .select("id, batches!inner(classes!inner(provider_apartment_registrations!inner(apartment_id)))", { count: "exact", head: true })
          .eq("batches.classes.provider_apartment_registrations.apartment_id", apartmentId!)
          .in("status", ["active", "pending"]),
      ]);

      return {
        families: familiesRes.count ?? 0,
        providers: providersRes.count ?? 0,
        classes: classesRes.count ?? 0,
        enrollments: enrollmentsRes.count ?? 0,
      };
    },
  });
}

// ---- Provider Registrations (Admin view) ----

export function useAdminProviderRegistrations(apartmentId: string | undefined, status?: string) {
  return useQuery({
    queryKey: ["admin-provider-regs", apartmentId, status],
    enabled: !!apartmentId,
    queryFn: async () => {
      let query = supabase
        .from("provider_apartment_registrations")
        .select(`
          id, status, admin_fee_type, admin_fee_amount,
          min_guaranteed_fee, revenue_share_pct, payment_frequency,
          free_trial_days, commercial_notes, terms_status,
          terms_accepted_at, terms_version,
          created_at, approved_at, suspended_at, suspension_reason,
          service_providers(
            id, user_id, provider_type, business_name, bio, experience_years,
            qualifications, specializations, specialization_category_ids,
            whatsapp_number, is_verified,
            users(full_name, avatar_url, email)
          )
        `)
        .eq("apartment_id", apartmentId!)
        .order("created_at", { ascending: false });

      if (status && status !== "all") {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useApproveProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      registrationId: string;
      approvedBy: string;
      feeType: string;
      feeAmount: number;
      minGuaranteedFee?: number;
      revenueSharePct?: number;
      paymentFrequency?: string;
      freeTrialDays?: number;
      commercialNotes?: string;
    }) => {
      const { error } = await supabase
        .from("provider_apartment_registrations")
        .update({
          status: "approved",
          approved_by: input.approvedBy,
          approved_at: new Date().toISOString(),
          admin_fee_type: input.feeType,
          admin_fee_amount: input.feeAmount,
          min_guaranteed_fee: input.minGuaranteedFee ?? 0,
          revenue_share_pct: input.revenueSharePct ?? 0,
          payment_frequency: input.paymentFrequency ?? "monthly",
          free_trial_days: input.freeTrialDays ?? 0,
          commercial_notes: input.commercialNotes ?? null,
          terms_status: "pending_acceptance",
          terms_version: 1,
        })
        .eq("id", input.registrationId);
      if (error) throw error;

      // Notify the provider via RPC
      const { data: reg } = await supabase
        .from("provider_apartment_registrations")
        .select("service_providers(user_id), apartment_id")
        .eq("id", input.registrationId)
        .single();

      const { data: apt } = await supabase
        .from("apartment_complexes")
        .select("name")
        .eq("id", (reg as any)?.apartment_id)
        .single();

      const providerUserId = (reg as any)?.service_providers?.user_id;
      if (providerUserId) {
        await supabase.rpc("send_notification", {
          p_user_id: providerUserId,
          p_title: "Application Approved!",
          p_body: `You've been approved at ${apt?.name ?? "an apartment"}. Please review and accept the commercial terms.`,
          p_type: "provider_approved",
          p_ref_type: "provider_apartment_registration",
          p_ref_id: input.registrationId,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-provider-regs"] });
      qc.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
}

export function useRejectProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { registrationId: string; reason?: string }) => {
      const { data: reg } = await supabase
        .from("provider_apartment_registrations")
        .select("service_providers(user_id), apartment_id")
        .eq("id", input.registrationId)
        .single();

      const { error } = await supabase
        .from("provider_apartment_registrations")
        .update({ status: "rejected" })
        .eq("id", input.registrationId);
      if (error) throw error;

      // Notify provider
      const { data: apt } = await supabase
        .from("apartment_complexes")
        .select("name")
        .eq("id", (reg as any)?.apartment_id)
        .single();

      const providerUserId = (reg as any)?.service_providers?.user_id;
      if (providerUserId) {
        await supabase.rpc("send_notification", {
          p_user_id: providerUserId,
          p_title: "Application Not Approved",
          p_body: `Your application at ${apt?.name ?? "an apartment"} was not approved.${input.reason ? ` Reason: ${input.reason}` : ""}`,
          p_type: "provider_rejected",
          p_ref_type: "provider_apartment_registration",
          p_ref_id: input.registrationId,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-provider-regs"] });
    },
  });
}

export function useSuspendProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ registrationId, reason }: { registrationId: string; reason: string }) => {
      const { error } = await supabase
        .from("provider_apartment_registrations")
        .update({
          status: "suspended",
          suspended_at: new Date().toISOString(),
          suspension_reason: reason,
        })
        .eq("id", registrationId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-provider-regs"] });
    },
  });
}

export function useReinstateProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (registrationId: string) => {
      const { error } = await supabase
        .from("provider_apartment_registrations")
        .update({
          status: "approved",
          suspended_at: null,
          suspension_reason: null,
        })
        .eq("id", registrationId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-provider-regs"] });
    },
  });
}

// ---- Admin: Classes in apartment ----

export function useAdminClasses(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ["admin-classes", apartmentId],
    enabled: !!apartmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select(`
          id, title, status, total_rating, rating_count, created_at,
          class_categories(name),
          provider_apartment_registrations!inner(
            apartment_id,
            service_providers(business_name, users(full_name))
          )
        `)
        .eq("provider_apartment_registrations.apartment_id", apartmentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ---- Admin: Top classes by enrollment ----

export function useTopClassesByEnrollment(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ["admin-top-classes", apartmentId],
    enabled: !!apartmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select(`
          id, title, rating_count,
          provider_apartment_registrations!inner(apartment_id),
          batches(current_enrollment_count)
        `)
        .eq("status", "published")
        .eq("provider_apartment_registrations.apartment_id", apartmentId!)
        .limit(5);
      if (error) throw error;

      return (data ?? [])
        .map((cls) => ({
          title: cls.title,
          enrollments: (cls.batches ?? []).reduce(
            (sum: number, b: any) => sum + (b.current_enrollment_count ?? 0),
            0
          ),
        }))
        .sort((a, b) => b.enrollments - a.enrollments);
    },
  });
}

// ---- Admin Fee Payments (Reports) ----

export function useAdminFeePayments(apartmentId: string | undefined, month?: number, year?: number) {
  return useQuery({
    queryKey: ["admin-fee-payments", apartmentId, month, year],
    enabled: !!apartmentId,
    queryFn: async () => {
      let query = supabase
        .from("admin_fee_payments")
        .select(`
          id, amount, period_month, period_year, total_provider_revenue,
          total_enrollments, commission_type, commission_rate, status,
          paid_at, confirmed_at, notes, created_at,
          provider_apartment_registrations!inner(
            id, apartment_id, admin_fee_type, admin_fee_amount,
            service_providers(id, business_name, users(full_name))
          )
        `)
        .eq("provider_apartment_registrations.apartment_id", apartmentId!);

      if (month !== undefined && year !== undefined) {
        query = query.eq("period_month", month).eq("period_year", year);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useMarkFeePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (feeId: string) => {
      const { error } = await supabase
        .from("admin_fee_payments")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .eq("id", feeId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-fee-payments"] });
    },
  });
}

export function useConfirmFeePaid() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (feeId: string) => {
      const { error } = await supabase
        .from("admin_fee_payments")
        .update({
          status: "confirmed",
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", feeId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-fee-payments"] });
    },
  });
}

// ---- Admin: Provider Detail ----

export function useAdminProviderDetail(registrationId: string | undefined) {
  return useQuery({
    queryKey: ["admin-provider-detail", registrationId],
    enabled: !!registrationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_apartment_registrations")
        .select(`
          id, status, admin_fee_type, admin_fee_amount,
          min_guaranteed_fee, revenue_share_pct, payment_frequency,
          free_trial_days, commercial_notes, terms_status,
          terms_accepted_at, terms_version,
          created_at, approved_at, approved_by, suspended_at, suspension_reason,
          apartment_id,
          service_providers(
            id, user_id, provider_type, business_name, bio,
            experience_years, qualifications, specializations, specialization_category_ids,
            whatsapp_number, is_verified,
            users(full_name, avatar_url, email, mobile_number)
          )
        `)
        .eq("id", registrationId!)
        .single();
      if (error) throw error;

      // Fetch class count and student count for this registration
      const { count: classCount } = await supabase
        .from("classes")
        .select("id", { count: "exact", head: true })
        .eq("provider_registration_id", registrationId!);

      const { data: classes } = await supabase
        .from("classes")
        .select("id")
        .eq("provider_registration_id", registrationId!);
      const classIds = classes?.map((c) => c.id) ?? [];

      let activeStudents = 0;
      if (classIds.length > 0) {
        const { data: batches } = await supabase
          .from("batches")
          .select("id")
          .in("class_id", classIds);
        const batchIds = batches?.map((b) => b.id) ?? [];

        if (batchIds.length > 0) {
          const { count } = await supabase
            .from("enrollments")
            .select("id", { count: "exact", head: true })
            .in("batch_id", batchIds)
            .eq("status", "active");
          activeStudents = count ?? 0;
        }
      }

      // Get confirmed payment total
      let totalRevenue = 0;
      const providerId = (data as any)?.service_providers?.id;
      if (providerId) {
        const { data: payments } = await supabase
          .from("payments")
          .select("amount")
          .eq("provider_id", providerId)
          .eq("status", "confirmed");
        totalRevenue = (payments ?? []).reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0);
      }

      return {
        ...data,
        classCount: classCount ?? 0,
        activeStudents,
        totalRevenue,
      };
    },
  });
}

// ---- Admin: Update Commercial Terms ----

export function useUpdateCommercialTerms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      registrationId: string;
      feeType: string;
      feeAmount: number;
      minGuaranteedFee?: number;
      revenueSharePct?: number;
      paymentFrequency?: string;
      freeTrialDays?: number;
      commercialNotes?: string;
    }) => {
      // Get current version
      const { data: current } = await supabase
        .from("provider_apartment_registrations")
        .select("terms_version, service_providers(user_id), apartment_id")
        .eq("id", input.registrationId)
        .single();

      const newVersion = ((current as any)?.terms_version ?? 0) + 1;

      const { error } = await supabase
        .from("provider_apartment_registrations")
        .update({
          admin_fee_type: input.feeType,
          admin_fee_amount: input.feeAmount,
          min_guaranteed_fee: input.minGuaranteedFee ?? 0,
          revenue_share_pct: input.revenueSharePct ?? 0,
          payment_frequency: input.paymentFrequency ?? "monthly",
          free_trial_days: input.freeTrialDays ?? 0,
          commercial_notes: input.commercialNotes ?? null,
          terms_status: "pending_acceptance",
          terms_accepted_at: null,
          terms_version: newVersion,
        })
        .eq("id", input.registrationId);
      if (error) throw error;

      // Notify provider
      const { data: apt } = await supabase
        .from("apartment_complexes")
        .select("name")
        .eq("id", (current as any)?.apartment_id)
        .single();

      const providerUserId = (current as any)?.service_providers?.user_id;
      if (providerUserId) {
        await supabase.rpc("send_notification", {
          p_user_id: providerUserId,
          p_title: "Commercial Terms Updated",
          p_body: `The admin at ${apt?.name ?? "your apartment"} has updated your commercial terms. Please review and accept.`,
          p_type: "terms_updated",
          p_ref_type: "provider_apartment_registration",
          p_ref_id: input.registrationId,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-provider-regs"] });
      qc.invalidateQueries({ queryKey: ["admin-provider-detail"] });
    },
  });
}
