import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

// ---- Become a Provider (v2: auto-approved, no apartment registration) ----

export function useCreateProvider() {
  const { refreshProfile } = useUser();

  return useMutation({
    mutationFn: async (input: {
      userId: string;
      providerType: "individual" | "academy";
      businessName: string;
      bio: string;
      experienceYears: number | null;
      qualifications: string;
      specializations: string[];
      specializationCategoryIds: string[];
      introVideoUrl: string;
      whatsappNumber: string;
      upiId: string;
      upiQrImageUrl: string;
    }) => {
      const providerFields = {
        user_id: input.userId,
        provider_type: input.providerType,
        business_name: input.businessName || null,
        bio: input.bio || null,
        experience_years: input.experienceYears,
        qualifications: input.qualifications || null,
        specializations: input.specializations,
        specialization_category_ids: input.specializationCategoryIds,
        intro_video_url: input.introVideoUrl || null,
        whatsapp_number: input.whatsappNumber || null,
        upi_id: input.upiId || null,
        upi_qr_image_url: input.upiQrImageUrl || null,
        is_verified: false,
        subscription_tier: "basic" as const,
      };

      // Upsert service_providers row (handles re-application)
      const { data: existing } = await supabase
        .from("service_providers")
        .select("id")
        .eq("user_id", input.userId)
        .maybeSingle();

      let providerId: string;

      if (existing) {
        const { error: upErr } = await supabase
          .from("service_providers")
          .update(providerFields)
          .eq("id", existing.id);
        if (upErr) throw upErr;
        providerId = existing.id;
      } else {
        const { data: provider, error: pErr } = await supabase
          .from("service_providers")
          .insert(providerFields)
          .select("id")
          .single();
        if (pErr) throw pErr;
        providerId = provider.id;
      }

      // Mark user as provider (auto-approved — no apartment admin gate in v2)
      const { error: uErr } = await supabase
        .from("users")
        .update({ is_provider: true })
        .eq("id", input.userId);
      if (uErr) throw uErr;

      return { id: providerId };
    },
    onSuccess: async () => {
      await refreshProfile();
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

// ---- Provider Dashboard Data (v2: all queries use provider_id directly) ----

/**
 * Coach scope model:
 *   A coach can be assigned at CLASS scope (covers every batch in that class)
 *   or at BATCH scope (just that one batch). The two sets are UNIONed —
 *   i.e. allowed_batches = batches WHERE class_id ∈ scopedClassIds OR id ∈ scopedBatchIds.
 *   Allowed classes = scopedClassIds ∪ parent-class-of(scopedBatchIds).
 *
 *   `isCoachScope` flips on when EITHER list is provided. Admin omits the
 *   scope entirely (omitted means "no scope filter — admin sees everything").
 */
type CoachScope = { scopedClassIds?: string[]; scopedBatchIds?: string[] };

async function resolveCoachScopedIds(
  providerId: string,
  scope: CoachScope,
): Promise<{ classIds: string[]; batchIds: string[] }> {
  const scopedClassIds = new Set(scope.scopedClassIds ?? []);
  const scopedBatchIds = new Set(scope.scopedBatchIds ?? []);

  // Pull every class for the academy, then narrow client-side to the union.
  const { data: classes } = await supabase
    .from("classes")
    .select("id")
    .eq("provider_id", providerId);
  const classIds = (classes ?? []).map((c) => c.id);
  if (classIds.length === 0) return { classIds: [], batchIds: [] };

  const { data: batches } = await supabase
    .from("batches")
    .select("id, class_id")
    .in("class_id", classIds);
  const allowedBatches = (batches ?? []).filter(
    (b) => scopedClassIds.has(b.class_id) || scopedBatchIds.has(b.id),
  );
  const allowedClassIds = new Set<string>(scopedClassIds);
  allowedBatches.forEach((b) => allowedClassIds.add(b.class_id));

  return {
    classIds: Array.from(allowedClassIds),
    batchIds: allowedBatches.map((b) => b.id),
  };
}

/**
 * @param scope Optional coach scoping. When provided, results are limited to
 * the union of `scopedClassIds`-batches and `scopedBatchIds`. Admin omits.
 */
export function useProviderStats(
  providerId: string | undefined,
  scope?: CoachScope
) {
  const scopedClassIds = scope?.scopedClassIds;
  const scopedBatchIds = scope?.scopedBatchIds;
  const isCoachScope = !!scope;
  return useQuery({
    queryKey: [
      "provider-stats",
      providerId,
      scopedClassIds?.join(",") ?? "",
      scopedBatchIds?.join(",") ?? "",
    ],
    enabled: !!providerId,
    queryFn: async () => {
      let allowedClassIds: string[] | null = null;
      let allowedBatchIds: string[] | null = null;
      if (isCoachScope) {
        const resolved = await resolveCoachScopedIds(providerId!, scope!);
        allowedClassIds = resolved.classIds;
        allowedBatchIds = resolved.batchIds;
      }

      // ── Active classes count (published only) ───────────────────────────
      let classCount = 0;
      if (isCoachScope) {
        if (allowedClassIds && allowedClassIds.length > 0) {
          const { count } = await supabase
            .from("classes")
            .select("id", { count: "exact", head: true })
            .eq("provider_id", providerId!)
            .eq("status", "published")
            .in("id", allowedClassIds);
          classCount = count ?? 0;
        }
      } else {
        const { count } = await supabase
          .from("classes")
          .select("id", { count: "exact", head: true })
          .eq("provider_id", providerId!)
          .eq("status", "published");
        classCount = count ?? 0;
      }

      // ── Active students count ───────────────────────────────────────────
      let studentCount = 0;
      let batchIds: string[] = [];

      if (isCoachScope) {
        batchIds = allowedBatchIds ?? [];
      } else {
        const { data: classes } = await supabase
          .from("classes")
          .select("id")
          .eq("provider_id", providerId!);
        const classIds = classes?.map((c) => c.id) ?? [];
        if (classIds.length > 0) {
          const { data: batches } = await supabase
            .from("batches")
            .select("id")
            .in("class_id", classIds);
          batchIds = batches?.map((b) => b.id) ?? [];
        }
      }

      if (batchIds.length > 0) {
        const { count: sCount } = await supabase
          .from("enrollments")
          .select("id", { count: "exact", head: true })
          .in("batch_id", batchIds)
          .eq("status", "active");
        studentCount = sCount ?? 0;
      }

      // ── Pending payments ────────────────────────────────────────────────
      let pendingPayments = 0;
      if (isCoachScope) {
        if (batchIds.length > 0) {
          // Find pending payments whose enrollment belongs to an allowed batch
          const { data: payRows } = await supabase
            .from("payments")
            .select("id, enrollments!inner(batch_id)")
            .eq("provider_id", providerId!)
            .eq("status", "recorded");
          const allowed = new Set(batchIds);
          type PayRow = { id: string; enrollments?: { batch_id: string } | null };
          pendingPayments = ((payRows ?? []) as unknown as PayRow[]).filter((p) =>
            p.enrollments ? allowed.has(p.enrollments.batch_id) : false
          ).length;
        }
      } else {
        const { count } = await supabase
          .from("payments")
          .select("id", { count: "exact", head: true })
          .eq("provider_id", providerId!)
          .eq("status", "recorded");
        pendingPayments = count ?? 0;
      }

      return {
        activeClasses: classCount,
        activeStudents: studentCount,
        pendingPayments,
      };
    },
  });
}

export function useProviderTodaySchedule(
  providerId: string | undefined,
  scope?: CoachScope
) {
  const today = new Date().getDay(); // 0=Sun
  const scopedClassIds = scope?.scopedClassIds;
  const scopedBatchIds = scope?.scopedBatchIds;
  const isCoachScope = !!scope;
  return useQuery({
    queryKey: [
      "provider-today-schedule",
      providerId,
      today,
      scopedClassIds?.join(",") ?? "",
      scopedBatchIds?.join(",") ?? "",
    ],
    enabled: !!providerId,
    queryFn: async () => {
      let allowedClassIds: Set<string> | null = null;
      let allowedBatchIds: Set<string> | null = null;
      if (isCoachScope) {
        const resolved = await resolveCoachScopedIds(providerId!, scope!);
        allowedClassIds = new Set(resolved.classIds);
        allowedBatchIds = new Set(resolved.batchIds);
        if (allowedClassIds.size === 0) return [];
      }

      let classQuery = supabase
        .from("classes")
        .select("id, title")
        .eq("provider_id", providerId!)
        .eq("status", "published");
      if (allowedClassIds) classQuery = classQuery.in("id", Array.from(allowedClassIds));
      const { data: classes } = await classQuery;
      if (!classes?.length) return [];

      const classIds = classes.map((c) => c.id);
      let batchQuery = supabase
        .from("batches")
        .select("id, batch_name, class_id, status")
        .in("class_id", classIds)
        .in("status", ["active", "full"]);
      if (allowedBatchIds && allowedBatchIds.size > 0) {
        batchQuery = batchQuery.in("id", Array.from(allowedBatchIds));
      }
      const { data: batches } = await batchQuery;
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

export function useProviderUpcomingSchedule(
  providerId: string | undefined,
  scope?: CoachScope
) {
  const scopedClassIds = scope?.scopedClassIds;
  const scopedBatchIds = scope?.scopedBatchIds;
  const isCoachScope = !!scope;
  const today = new Date();
  const upcomingDays = [1, 2, 3].map((offset) => {
    const d = new Date(today);
    d.setDate(d.getDate() + offset);
    return { dayOfWeek: d.getDay(), date: d };
  });
  const dayNumbers = upcomingDays.map((d) => d.dayOfWeek);

  return useQuery({
    queryKey: [
      "provider-upcoming-schedule",
      providerId,
      dayNumbers.join(","),
      scopedClassIds?.join(",") ?? "",
      scopedBatchIds?.join(",") ?? "",
    ],
    enabled: !!providerId,
    queryFn: async () => {
      let allowedClassIds: Set<string> | null = null;
      let allowedBatchIds: Set<string> | null = null;
      if (isCoachScope) {
        const resolved = await resolveCoachScopedIds(providerId!, scope!);
        allowedClassIds = new Set(resolved.classIds);
        allowedBatchIds = new Set(resolved.batchIds);
        if (allowedClassIds.size === 0) return [];
      }

      let classQuery = supabase
        .from("classes")
        .select("id, title")
        .eq("provider_id", providerId!)
        .eq("status", "published");
      if (allowedClassIds) classQuery = classQuery.in("id", Array.from(allowedClassIds));
      const { data: classes } = await classQuery;
      if (!classes?.length) return [];

      const classIds = classes.map((c) => c.id);
      let batchQuery = supabase
        .from("batches")
        .select("id, batch_name, class_id, status")
        .in("class_id", classIds)
        .in("status", ["active", "full"]);
      if (allowedBatchIds && allowedBatchIds.size > 0) {
        batchQuery = batchQuery.in("id", Array.from(allowedBatchIds));
      }
      const { data: batches } = await batchQuery;
      if (!batches?.length) return [];

      const batchIds = batches.map((b) => b.id);
      const { data: schedules } = await supabase
        .from("batch_schedules")
        .select("id, batch_id, day_of_week, start_time, end_time")
        .in("batch_id", batchIds)
        .in("day_of_week", dayNumbers)
        .eq("is_active", true)
        .order("start_time");

      return upcomingDays.map((day) => {
        const daySchedules = (schedules ?? [])
          .filter((s) => s.day_of_week === day.dayOfWeek)
          .map((s) => {
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
        return { date: day.date, dayOfWeek: day.dayOfWeek, schedules: daySchedules };
      });
    },
  });
}

export function usePendingEnrollments(providerId: string | undefined) {
  return useQuery({
    queryKey: ["pending-enrollments", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data: classes } = await supabase
        .from("classes")
        .select("id, title")
        .eq("provider_id", providerId!);
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
        .select("id, batch_id, family_member_id, enrolled_at, family_members(full_name, relationship)")
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
          memberName: (e.family_members as any)?.full_name ?? "",
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

// ---- Provider: All active batches (for attendance picker) ----

export function useProviderActiveBatches(
  providerId: string | undefined,
  scope?: CoachScope
) {
  const scopedClassIds = scope?.scopedClassIds;
  const scopedBatchIds = scope?.scopedBatchIds;
  const isCoachScope = !!scope;
  return useQuery({
    queryKey: [
      "provider-active-batches",
      providerId,
      scopedClassIds?.join(",") ?? "",
      scopedBatchIds?.join(",") ?? "",
    ],
    enabled: !!providerId,
    queryFn: async () => {
      let allowedClassIds: Set<string> | null = null;
      let allowedBatchIds: Set<string> | null = null;
      if (isCoachScope) {
        const resolved = await resolveCoachScopedIds(providerId!, scope!);
        allowedClassIds = new Set(resolved.classIds);
        allowedBatchIds = new Set(resolved.batchIds);
        if (allowedClassIds.size === 0) return [];
      }

      let classQuery = supabase
        .from("classes")
        .select("id, title")
        .eq("provider_id", providerId!)
        .eq("status", "published");
      if (allowedClassIds) classQuery = classQuery.in("id", Array.from(allowedClassIds));
      const { data: classes } = await classQuery;
      if (!classes?.length) return [];

      const classIds = classes.map((c) => c.id);
      let batchQuery = supabase
        .from("batches")
        .select("id, batch_name, class_id, status")
        .in("class_id", classIds)
        .in("status", ["active", "full"])
        .order("batch_name");
      if (allowedBatchIds && allowedBatchIds.size > 0) {
        batchQuery = batchQuery.in("id", Array.from(allowedBatchIds));
      }
      const { data: batches, error } = await batchQuery;
      if (error) throw error;

      return (batches ?? []).map((b) => {
        const cls = classes.find((c) => c.id === b.class_id);
        return {
          batchId: b.id,
          batchName: b.batch_name,
          classTitle: cls?.title ?? "",
          classId: b.class_id,
        };
      });
    },
  });
}

// ---- Backward-compat stubs (v1 hooks no longer active in v2) ----

/** @deprecated v2 has no apartment registrations */
export function useProviderRegistrations(_providerId: string | undefined) {
  return useQuery({
    queryKey: ["provider-registrations-stub"],
    queryFn: async () => [] as any[],
    staleTime: Infinity,
  });
}

/** @deprecated v2 has no apartment-level commercial terms */
export function useProviderPendingTerms(_providerId: string | undefined) {
  return useQuery({
    queryKey: ["provider-pending-terms-stub"],
    queryFn: async () => [] as any[],
    staleTime: Infinity,
  });
}

/** @deprecated v2 has no apartment-level commercial terms */
export function useRespondToTerms() {
  return useMutation({ mutationFn: async (_: any) => {} });
}

/** @deprecated v2 has no class-level commercial terms or common-area approval */
export function useProviderClassActionItems(_registrationIds: string[]) {
  return useQuery({
    queryKey: ["provider-class-actions-stub"],
    queryFn: async () => [] as any[],
    staleTime: Infinity,
  });
}

/** @deprecated v2 has no class-level commercial terms */
export function useRespondToClassTerms() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (_: { classId: string; accept: boolean }) => {},
    onSuccess: () => qc.invalidateQueries({ queryKey: ["provider-class-actions"] }),
  });
}
