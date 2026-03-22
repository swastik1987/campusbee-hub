import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

// ---- Become a Provider ----

export function useCreateProvider() {
  const { refreshProfile } = useUser();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      userId: string;
      providerType: "individual" | "academy";
      businessName: string;
      bio: string;
      experienceYears: number | null;
      qualifications: string;
      specializations: string[];
      introVideoUrl: string;
      whatsappNumber: string;
      upiId: string;
      upiQrImageUrl: string;
      apartmentIds: string[];
    }) => {
      // 1. Create service_providers row
      const { data: provider, error: pErr } = await supabase
        .from("service_providers")
        .insert({
          user_id: input.userId,
          provider_type: input.providerType,
          business_name: input.businessName || null,
          bio: input.bio || null,
          experience_years: input.experienceYears,
          qualifications: input.qualifications || null,
          specializations: input.specializations,
          intro_video_url: input.introVideoUrl || null,
          whatsapp_number: input.whatsappNumber || null,
          upi_id: input.upiId || null,
          upi_qr_image_url: input.upiQrImageUrl || null,
        })
        .select("id")
        .single();
      if (pErr) throw pErr;

      // 2. Create registrations for selected apartments
      if (input.apartmentIds.length > 0) {
        const regs = input.apartmentIds.map((aptId) => ({
          provider_id: provider.id,
          apartment_id: aptId,
          status: "pending" as const,
        }));
        const { error: rErr } = await supabase
          .from("provider_apartment_registrations")
          .insert(regs);
        if (rErr) throw rErr;
      }

      // 3. Mark user as provider
      const { error: uErr } = await supabase
        .from("users")
        .update({ is_provider: true })
        .eq("id", input.userId);
      if (uErr) throw uErr;

      return provider;
    },
    onSuccess: async () => {
      await refreshProfile();
      qc.invalidateQueries({ queryKey: ["provider-registrations"] });
    },
  });
}

export function useUploadProviderMedia() {
  return useMutation({
    mutationFn: async ({ userId, file, folder }: { userId: string; file: File; folder: string }) => {
      const ext = file.name.split(".").pop();
      const path = `${userId}/${folder}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("provider-media").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("provider-media").getPublicUrl(path);
      return data.publicUrl;
    },
  });
}

// ---- Provider Dashboard Data ----

export function useProviderRegistrations(providerId: string | undefined) {
  return useQuery({
    queryKey: ["provider-registrations", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("provider_apartment_registrations")
        .select("id, provider_id, apartment_id, status, admin_fee_type, admin_fee_amount, created_at, apartment_complexes(id, name, city, locality)")
        .eq("provider_id", providerId!);
      if (error) throw error;
      return data;
    },
  });
}

export function useProviderStats(providerId: string | undefined, apartmentRegIds: string[]) {
  return useQuery({
    queryKey: ["provider-stats", providerId, apartmentRegIds],
    enabled: !!providerId && apartmentRegIds.length > 0,
    queryFn: async () => {
      // Active classes count
      const { count: classCount } = await supabase
        .from("classes")
        .select("id", { count: "exact", head: true })
        .in("provider_registration_id", apartmentRegIds)
        .eq("status", "published");

      // Get class IDs for batch queries
      const { data: classes } = await supabase
        .from("classes")
        .select("id")
        .in("provider_registration_id", apartmentRegIds);
      const classIds = classes?.map((c) => c.id) ?? [];

      let studentCount = 0;
      let pendingPayments = 0;

      if (classIds.length > 0) {
        // Get batch IDs
        const { data: batches } = await supabase
          .from("batches")
          .select("id")
          .in("class_id", classIds);
        const batchIds = batches?.map((b) => b.id) ?? [];

        if (batchIds.length > 0) {
          // Active students
          const { count: sCount } = await supabase
            .from("enrollments")
            .select("id", { count: "exact", head: true })
            .in("batch_id", batchIds)
            .eq("status", "active");
          studentCount = sCount ?? 0;
        }
      }

      // Pending payments for this provider
      const { count: pCount } = await supabase
        .from("payments")
        .select("id", { count: "exact", head: true })
        .eq("provider_id", providerId!)
        .eq("status", "recorded");
      pendingPayments = pCount ?? 0;

      return {
        activeClasses: classCount ?? 0,
        activeStudents: studentCount,
        pendingPayments,
      };
    },
  });
}

export function useProviderTodaySchedule(providerId: string | undefined, apartmentRegIds: string[]) {
  const today = new Date().getDay(); // 0=Sun
  return useQuery({
    queryKey: ["provider-today-schedule", providerId, today],
    enabled: !!providerId && apartmentRegIds.length > 0,
    queryFn: async () => {
      // Get provider's classes
      const { data: classes } = await supabase
        .from("classes")
        .select("id, title, provider_registration_id")
        .in("provider_registration_id", apartmentRegIds)
        .eq("status", "published");
      if (!classes?.length) return [];

      const classIds = classes.map((c) => c.id);
      const { data: batches } = await supabase
        .from("batches")
        .select("id, batch_name, class_id, status")
        .in("class_id", classIds)
        .in("status", ["active", "full"]);
      if (!batches?.length) return [];

      const batchIds = batches.map((b) => b.id);
      const { data: schedules } = await supabase
        .from("batch_schedules")
        .select("id, batch_id, day_of_week, start_time, end_time")
        .in("batch_id", batchIds)
        .eq("day_of_week", today)
        .eq("is_active", true)
        .order("start_time");

      return (schedules ?? []).map((s) => {
        const batch = batches.find((b) => b.id === s.batch_id);
        const cls = classes.find((c) => c.id === batch?.class_id);
        return {
          scheduleId: s.id,
          batchId: s.batch_id,
          batchName: batch?.batch_name ?? "",
          classTitle: cls?.title ?? "",
          classId: cls?.id ?? "",
          startTime: s.start_time,
          endTime: s.end_time,
        };
      });
    },
  });
}

export function usePendingEnrollments(providerId: string | undefined, apartmentRegIds: string[]) {
  return useQuery({
    queryKey: ["pending-enrollments", providerId],
    enabled: !!providerId && apartmentRegIds.length > 0,
    queryFn: async () => {
      const { data: classes } = await supabase
        .from("classes")
        .select("id, title")
        .in("provider_registration_id", apartmentRegIds);
      if (!classes?.length) return [];

      const classIds = classes.map((c) => c.id);
      const { data: batches } = await supabase
        .from("batches")
        .select("id, batch_name, class_id")
        .in("class_id", classIds);
      if (!batches?.length) return [];

      const batchIds = batches.map((b) => b.id);
      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("id, batch_id, family_member_id, enrolled_at, family_members(name, relationship)")
        .in("batch_id", batchIds)
        .eq("status", "pending")
        .order("enrolled_at")
        .limit(10);

      return (enrollments ?? []).map((e) => {
        const batch = batches.find((b) => b.id === e.batch_id);
        const cls = classes.find((c) => c.id === batch?.class_id);
        return {
          enrollmentId: e.id,
          batchName: batch?.batch_name ?? "",
          classTitle: cls?.title ?? "",
          memberName: (e.family_members as any)?.name ?? "",
          relationship: (e.family_members as any)?.relationship ?? "",
          enrolledAt: e.enrolled_at,
        };
      });
    },
  });
}

// ---- Trainers ----

export function useTrainers(providerId: string | undefined) {
  return useQuery({
    queryKey: ["trainers", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trainers")
        .select("id, provider_id, name, bio, qualifications, experience_years, specializations, photo_url, is_active")
        .eq("provider_id", providerId!)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateTrainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      providerId: string;
      name: string;
      bio: string;
      qualifications: string;
      experienceYears: number | null;
      specializations: string[];
      photoUrl: string;
    }) => {
      const { data, error } = await supabase
        .from("trainers")
        .insert({
          provider_id: input.providerId,
          name: input.name,
          bio: input.bio || null,
          qualifications: input.qualifications || null,
          experience_years: input.experienceYears,
          specializations: input.specializations,
          photo_url: input.photoUrl || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trainers"] }),
  });
}

export function useDeleteTrainer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (trainerId: string) => {
      const { error } = await supabase
        .from("trainers")
        .update({ is_active: false })
        .eq("id", trainerId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["trainers"] }),
  });
}
