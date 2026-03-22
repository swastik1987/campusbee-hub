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
          id, status, admin_fee_type, admin_fee_amount, created_at, approved_at,
          suspended_at, suspension_reason,
          service_providers(
            id, user_id, provider_type, business_name, bio, experience_years,
            qualifications, specializations, whatsapp_number, is_verified,
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
    }) => {
      const { error } = await supabase
        .from("provider_apartment_registrations")
        .update({
          status: "approved",
          approved_by: input.approvedBy,
          approved_at: new Date().toISOString(),
          admin_fee_type: input.feeType,
          admin_fee_amount: input.feeAmount,
        })
        .eq("id", input.registrationId);
      if (error) throw error;
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
    mutationFn: async (registrationId: string) => {
      const { error } = await supabase
        .from("provider_apartment_registrations")
        .update({ status: "rejected" })
        .eq("id", registrationId);
      if (error) throw error;
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
