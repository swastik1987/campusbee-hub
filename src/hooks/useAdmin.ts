import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---- Admin Stats ----

export function useAdminStats(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ["admin-stats", apartmentId],
    enabled: !!apartmentId,
    queryFn: async () => {
      // First get registration IDs for this apartment
      const { data: regs } = await supabase
        .from("provider_apartment_registrations")
        .select("id")
        .eq("apartment_id", apartmentId!);
      const regIds = (regs ?? []).map((r) => r.id);

      // Get class IDs for this apartment
      let classIds: string[] = [];
      if (regIds.length > 0) {
        const { data: classData } = await supabase
          .from("classes")
          .select("id")
          .in("provider_registration_id", regIds);
        classIds = (classData ?? []).map((c) => c.id);
      }

      // Get batch IDs for these classes
      let batchIds: string[] = [];
      if (classIds.length > 0) {
        const { data: batchData } = await supabase
          .from("batches")
          .select("id")
          .in("class_id", classIds);
        batchIds = (batchData ?? []).map((b) => b.id);
      }

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
          .select("id", { count: "exact", head: true })
          .in("provider_registration_id", regIds.length > 0 ? regIds : ["__none__"])
          .eq("status", "published"),
        // Count enrollments directly via batch IDs
        batchIds.length > 0
          ? supabase
              .from("enrollments")
              .select("id", { count: "exact", head: true })
              .in("batch_id", batchIds)
              .in("status", ["active", "pending"])
          : Promise.resolve({ count: 0 }),
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

// ---- Admin: Classes for a specific provider registration ----

export function useAdminClassesByRegistration(registrationId: string | undefined) {
  return useQuery({
    queryKey: ["admin-classes-by-reg", registrationId],
    enabled: !!registrationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select(`
          id, title, status, requires_common_area, created_at,
          class_categories(name),
          batches(id, status)
        `)
        .eq("provider_registration_id", registrationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ---- Admin: Update class status (suspend / reactivate) ----

export function useAdminUpdateClassStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      classId,
      status,
      providerUserId,
      reason,
    }: {
      classId: string;
      status: "paused" | "published";
      providerUserId?: string;
      reason?: string;
    }) => {
      const { error } = await supabase
        .from("classes")
        .update({ status })
        .eq("id", classId);
      if (error) throw error;

      if (providerUserId) {
        const title = status === "paused" ? "Class Suspended" : "Class Reactivated";
        const body =
          status === "paused"
            ? `Your class has been suspended by the society admin${reason ? `: ${reason}` : "."}`
            : "Your class has been reactivated by the society admin and is now visible to residents.";

        await supabase.rpc("send_notification", {
          p_user_id: providerUserId,
          p_title: title,
          p_body: body,
          p_type: status === "paused" ? "class_suspended" : "class_reactivated",
          p_ref_type: "class",
          p_ref_id: classId,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-classes-by-reg"] });
      qc.invalidateQueries({ queryKey: ["admin-provider-detail"] });
      qc.invalidateQueries({ queryKey: ["admin-all-classes"] });
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

// ---- Resident Management ----

export function useAdminResidents(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ["admin-residents", apartmentId],
    enabled: !!apartmentId,
    queryFn: async () => {
      // Fetch families with members and primary user info
      const { data: families, error } = await supabase
        .from("families")
        .select(`
          id, flat_number, block_tower, created_at,
          users!families_primary_user_id_fkey(id, full_name, email, mobile_number, avatar_url),
          family_members(id, name, age_group, relationship, is_active)
        `)
        .eq("apartment_id", apartmentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Get enrollments for all family members in this apartment
      const memberIds = (families ?? []).flatMap((f) =>
        ((f.family_members as any[]) ?? []).map((m: any) => m.id)
      );

      let enrollments: any[] = [];
      if (memberIds.length > 0) {
        const { data } = await supabase
          .from("enrollments")
          .select(`
            id, status, family_member_id,
            batches(id, batch_name, classes(id, title, category_id,
              provider_apartment_registrations(provider_id,
                service_providers(business_name, users(full_name))
              )
            ))
          `)
          .in("family_member_id", memberIds)
          .in("status", ["active", "pending", "completed"]);
        enrollments = data ?? [];
      }

      return { families: families ?? [], enrollments };
    },
  });
}

// ---- Admin: Pending common-area class requests ----

export function useAdminPendingClasses(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ["admin-pending-classes", apartmentId],
    enabled: !!apartmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select(`
          id, title, status, requires_common_area, common_area_approval_status,
          venue_details, created_at,
          class_categories(name),
          provider_apartment_registrations!inner(
            apartment_id,
            service_providers(id, user_id, business_name, users(id, full_name))
          )
        `)
        .eq("status", "pending_approval")
        .eq("provider_apartment_registrations.apartment_id", apartmentId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

// ---- Admin: All classes (active + suspended) ----

export function useAdminAllClasses(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ["admin-all-classes", apartmentId],
    enabled: !!apartmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select(`
          id, title, status, requires_common_area, common_area_approval_status,
          class_terms_status, total_rating, rating_count, created_at,
          class_categories(name),
          provider_apartment_registrations!inner(
            apartment_id,
            service_providers(id, user_id, business_name, users(id, full_name))
          )
        `)
        .in("status", ["published", "paused"])
        .eq("provider_apartment_registrations.apartment_id", apartmentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ---- Admin: Approve a common-area class (optionally with commercial terms) ----

export function useAdminApproveClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      classId: string;
      adminUserId: string;
      providerUserId: string;
      terms?: {
        feeType: string;
        feeAmount: number;
        revenueSharePct: number;
        paymentFrequency: string;
        notes: string;
      };
    }) => {
      const hasTerms = !!input.terms && input.terms.feeAmount > 0;

      const updatePayload: Record<string, unknown> = {
        common_area_approval_status: "approved",
      };

      if (hasTerms) {
        // Propose commercial terms — provider must accept before class publishes
        updatePayload.class_fee_type = input.terms!.feeType;
        updatePayload.class_fee_amount = input.terms!.feeAmount;
        updatePayload.class_revenue_share_pct = input.terms!.revenueSharePct;
        updatePayload.class_payment_frequency = input.terms!.paymentFrequency;
        updatePayload.class_commercial_notes = input.terms!.notes || null;
        updatePayload.class_terms_status = "pending_acceptance";
        updatePayload.class_terms_proposed_by = input.adminUserId;
        // Status stays pending_approval until provider accepts
      } else {
        // No commercial terms — publish directly
        updatePayload.status = "published";
        updatePayload.class_terms_status = "not_required";
      }

      const { error } = await supabase
        .from("classes")
        .update(updatePayload)
        .eq("id", input.classId);
      if (error) throw error;

      await supabase.rpc("send_notification", {
        p_user_id: input.providerUserId,
        p_title: hasTerms ? "Class Approved – Review Terms" : "Class Approved!",
        p_body: hasTerms
          ? "Your class has been approved. Please review and accept the commercial terms to go live."
          : "Your class has been approved and is now live on CampusBee!",
        p_type: hasTerms ? "class_approved_with_terms" : "class_approved",
        p_ref_type: "class",
        p_ref_id: input.classId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pending-classes"] });
      qc.invalidateQueries({ queryKey: ["admin-all-classes"] });
      qc.invalidateQueries({ queryKey: ["admin-classes-by-reg"] });
    },
  });
}

// ---- Admin: Reject a common-area class request ----

export function useAdminRejectClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      classId: string;
      providerUserId: string;
      reason: string;
    }) => {
      const { error } = await supabase
        .from("classes")
        .update({
          common_area_approval_status: "rejected",
          common_area_rejection_reason: input.reason,
          status: "draft",
        })
        .eq("id", input.classId);
      if (error) throw error;

      await supabase.rpc("send_notification", {
        p_user_id: input.providerUserId,
        p_title: "Class Request Rejected",
        p_body: `Your class submission was not approved. Reason: ${input.reason}`,
        p_type: "class_rejected",
        p_ref_type: "class",
        p_ref_id: input.classId,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-pending-classes"] });
      qc.invalidateQueries({ queryKey: ["admin-classes-by-reg"] });
    },
  });
}
