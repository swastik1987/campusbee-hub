import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---- Platform Settings (read-only, public) ----

/**
 * Fetches all rows from platform_settings as a key→value map.
 * Results are cached for 5 minutes; defaults are applied in consuming code.
 * Keys used by trust markers:
 *   new_class_days_threshold    (default "7")
 *   popular_enrollment_min      (default "10")
 *   popular_rating_min          (default "4.0")
 *   popular_rating_count_min    (default "5")
 */
export function usePlatformSettings() {
  return useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("platform_settings")
        .select("key, value");
      const settings: Record<string, string> = {};
      (data ?? []).forEach((row: any) => {
        if (row.key) settings[row.key] = row.value ?? "";
      });
      return settings;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ---- Active Sponsored Class IDs (Seeker Explore) ----

/**
 * Returns a Set of class IDs that currently have an active sponsored listing
 * **for the given seeker location** (Phase 8: region + per-category slot count).
 *
 * Callers can pass `null`/`undefined` for lat/lng when the seeker hasn't set
 * a home location — the hook returns an empty Set in that case.  Used by the
 * Explore page to mark sponsored cards and sort them to the top of results.
 */
export function useActiveSponsoredClassIds(args?: {
  lat?: number | null;
  lng?: number | null;
  categoryId?: string | null;
}) {
  const lat = args?.lat ?? null;
  const lng = args?.lng ?? null;
  const categoryId = args?.categoryId ?? null;
  return useQuery({
    queryKey: ["active-sponsored-class-ids", lat, lng, categoryId],
    enabled: typeof lat === "number" && typeof lng === "number",
    staleTime: 2 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("sponsored_for_location" as never, {
        p_lat: lat as number,
        p_lng: lng as number,
        p_category_id: categoryId ?? null,
      } as never);
      if (error) throw error;
      return new Set<string>(
        ((data ?? []) as unknown as { class_id: string }[]).map((d) => d.class_id)
      );
    },
  });
}

// ---- Featured / Sponsored Classes (Seeker) ----

/** Returns active sponsored class listings. Falls back to top-rated published classes. */
export function useFeaturedClasses(_apartmentId?: string) {
  return useQuery({
    queryKey: ["featured-classes"],
    queryFn: async () => {
      // Query sponsored_listings that are currently active
      const today = new Date().toISOString();
      const { data: sponsored, error: sErr } = await supabase
        .from("sponsored_listings")
        .select(`
          id, class_id, slot_position,
          classes(
            id, title, short_description, cover_image_url, class_type,
            total_rating, rating_count, trial_available, trial_fee, created_at,
            class_categories(id, name, slug),
            service_providers(id, business_name, provider_type,
              users(full_name, avatar_url)
            )
          )
        `)
        .eq("status", "active")
        .lte("valid_from", today)
        .gte("valid_until", today)
        .order("slot_position")
        .limit(10);

      if (!sErr && sponsored && sponsored.length > 0) {
        return sponsored;
      }

      // Fallback: top-rated published classes
      const { data, error } = await supabase
        .from("classes")
        .select(`
          id, title, short_description, cover_image_url, class_type,
          total_rating, rating_count, trial_available, trial_fee, created_at,
          class_categories(id, name, slug),
          service_providers(id, business_name, provider_type,
            users(full_name, avatar_url)
          )
        `)
        .eq("status", "published")
        .eq("moderation_status", "approved")
        .order("total_rating", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });
}

export function useNewClasses(_apartmentId?: string) {
  return useQuery({
    queryKey: ["new-classes"],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("classes")
        .select(`
          id, title, short_description, cover_image_url, class_type,
          total_rating, rating_count, created_at,
          class_categories(id, name, slug),
          service_providers(id, business_name, provider_type,
            users(full_name, avatar_url)
          )
        `)
        .eq("status", "published")
        .eq("moderation_status", "approved")
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });
}

export function usePopularClasses(_apartmentId?: string) {
  return useQuery({
    queryKey: ["popular-classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select(`
          id, title, short_description, cover_image_url, class_type,
          total_rating, rating_count, created_at,
          class_categories(id, name, slug),
          service_providers(id, business_name, provider_type,
            users(full_name, avatar_url)
          )
        `)
        .eq("status", "published")
        .eq("moderation_status", "approved")
        .order("rating_count", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
  });
}

export function useExploreClasses(filters: {
  apartmentId?: string;
  search?: string;
  categoryIds?: string[];
  skillLevel?: string;
  dayOfWeek?: number;
  sort?: string;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: ["explore-classes", filters],
    queryFn: async () => {
      let query = supabase
        .from("classes")
        .select(`
          id, title, short_description, cover_image_url, class_type,
          skill_level, age_group_min, age_group_max, total_rating, rating_count,
          trial_available, trial_fee, created_at, category_id, address,
          is_home_based, home_radius_km, location_lat, location_lng,
          class_categories!inner(id, name, slug, parent_id),
          service_providers(id, business_name, provider_type,
            users(full_name, avatar_url)
          ),
          batches(id, fee_amount, fee_frequency, status, max_batch_size, current_enrollment_count,
            batch_schedules(day_of_week, start_time, end_time)
          )
        `)
        .eq("status", "published")
        .eq("moderation_status", "approved");

      if (filters.categoryIds && filters.categoryIds.length > 0) {
        query = query.in("category_id", filters.categoryIds);
      }

      if (filters.search) {
        const safe = filters.search.replace(/%/g, "\\%").replace(/_/g, "\\_");
        query = query.or(`title.ilike.%${safe}%,short_description.ilike.%${safe}%`);
      }

      switch (filters.sort) {
        case "rating":
          query = query.order("total_rating", { ascending: false });
          break;
        case "newest":
          query = query.order("created_at", { ascending: false });
          break;
        case "popular":
          query = query.order("rating_count", { ascending: false });
          break;
        default:
          query = query.order("created_at", { ascending: false });
      }

      query = query.range(
        filters.offset ?? 0,
        (filters.offset ?? 0) + (filters.limit ?? 20) - 1
      );

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// ---- Seeker Class Detail (with batches + schedules) ----

export function useSeekerClassDetail(classId: string | undefined) {
  return useQuery({
    queryKey: ["seeker-class-detail", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select(`
          id, title, description, short_description, cover_image_url, gallery_urls,
          promo_video_url, class_type, skill_level, age_group_min, age_group_max,
          venue_details, what_to_bring, trial_available, trial_fee, status,
          total_rating, rating_count, created_at, address, is_home_based,
          location_lat, location_lng,
          class_categories(id, name, slug, icon),
          service_providers(
            id, user_id, business_name, provider_type, bio,
            experience_years, qualifications, specializations, whatsapp_number,
            upi_id, upi_qr_image_url, is_verified,
            users(id, full_name, avatar_url)
          ),
          batches(
            id, batch_name, batch_type, skill_level, age_group_min, age_group_max,
            max_batch_size, current_enrollment_count, fee_amount, fee_frequency, registration_fee,
            start_date, end_date, status, registration_mode, auto_waitlist, trainer_id,
            trainers(id, name, photo_url, specializations),
            batch_schedules(id, day_of_week, start_time, end_time)
          ),
          class_addons(id, name, description, fee_amount, fee_type, is_mandatory)
        `)
        .eq("id", classId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

// ---- Provider Profile (Seeker view) ----

export function useProviderProfile(providerId: string | undefined) {
  return useQuery({
    queryKey: ["provider-profile", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_providers")
        .select(`
          id, user_id, provider_type, business_name, bio, experience_years,
          qualifications, specializations, intro_video_url,
          whatsapp_number, is_verified, subscription_tier,
          users(id, full_name, avatar_url),
          trainers(id, name, bio, specializations, photo_url, experience_years)
        `)
        .eq("id", providerId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useProviderClasses(providerId: string | undefined, _apartmentId?: string) {
  return useQuery({
    queryKey: ["provider-public-classes", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select(`
          id, title, short_description, cover_image_url, class_type,
          total_rating, rating_count, status,
          class_categories(id, name, slug)
        `)
        .eq("provider_id", providerId!)
        .eq("status", "published")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ---- Trainers for a provider ----

export function useProviderTrainers(providerId: string | undefined) {
  return useQuery({
    queryKey: ["provider-trainers", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trainers")
        .select("id, name, bio, qualifications, experience_years, specializations, photo_url")
        .eq("provider_id", providerId!)
        .eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });
}

// ---- Reviews ----

export function useClassReviews(classId: string | undefined) {
  return useQuery({
    queryKey: ["class-reviews", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select(`
          id, rating, review_text, is_verified, provider_reply, provider_replied_at, created_at,
          users(full_name, avatar_url)
        `)
        .eq("class_id", classId!)
        .eq("is_visible", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      classId: string;
      reviewerUserId: string;
      enrollmentId?: string;
      rating: number;
      reviewText: string;
    }) => {
      const { error } = await supabase.from("reviews").insert({
        class_id: input.classId,
        reviewer_user_id: input.reviewerUserId,
        enrollment_id: input.enrollmentId || null,
        rating: input.rating,
        review_text: input.reviewText || null,
        is_verified: !!input.enrollmentId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["class-reviews"] });
      qc.invalidateQueries({ queryKey: ["seeker-class-detail"] });
    },
  });
}

// ---- Enrollments ----

export function useCreateEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      batchId: string;
      familyMemberId: string;
      enrolledBy: string;
      selectedAddonIds: string[];
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("enrollments")
        .insert({
          batch_id: input.batchId,
          family_member_id: input.familyMemberId,
          enrolled_by: input.enrolledBy,
          selected_addon_ids: input.selectedAddonIds,
          notes: input.notes || null,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-enrollments"] });
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["seeker-class-detail"] });
      qc.invalidateQueries({ queryKey: ["enroll-batch"] });
      qc.invalidateQueries({ queryKey: ["provider-enrollments"] });
    },
  });
}

export function useCreateWaitlistEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      batchId: string;
      familyMemberId: string;
      requestedBy: string; // kept for API compat; not stored in v2 waitlist_entries
    }) => {
      // Get current max position
      const { data: existing } = await supabase
        .from("waitlist_entries")
        .select("position")
        .eq("batch_id", input.batchId)
        .order("position", { ascending: false })
        .limit(1);

      const nextPosition = (existing?.[0]?.position ?? 0) + 1;

      const { data, error } = await supabase
        .from("waitlist_entries")
        .insert({
          batch_id: input.batchId,
          family_member_id: input.familyMemberId,
          position: nextPosition,
        })
        .select("id, position")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-enrollments"] });
    },
  });
}

export function useRecordPayment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      enrollmentId: string;
      payerUserId: string;
      providerId: string;
      amount: number;
      paymentType: string;
      upiTransactionId?: string;
      receiptUrl?: string;
      paymentPeriodStart?: string;
      paymentPeriodEnd?: string;
    }) => {
      const { data, error } = await supabase
        .from("payments")
        .insert({
          enrollment_id: input.enrollmentId,
          payer_user_id: input.payerUserId,
          provider_id: input.providerId,
          amount: input.amount,
          payment_type: input.paymentType,
          upi_transaction_id: input.upiTransactionId || null,
          receipt_url: input.receiptUrl || null,
          payment_period_start: input.paymentPeriodStart || null,
          payment_period_end: input.paymentPeriodEnd || null,
          status: "recorded",
          paid_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["enrollment-payments"] });
    },
  });
}

export function useUploadPaymentScreenshot() {
  return useMutation({
    mutationFn: async ({ paymentId, file }: { paymentId: string; file: File }) => {
      const ext = file.name.split(".").pop();
      const path = `${paymentId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("payment-screenshots").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("payment-screenshots").getPublicUrl(path);
      return data.publicUrl;
    },
  });
}

// ---- My Enrollments (Seeker) ----

export function useMyEnrollments(userId: string | undefined, status?: string) {
  return useQuery({
    queryKey: ["my-enrollments", userId, status],
    enabled: !!userId,
    queryFn: async () => {
      let query = supabase
        .from("enrollments")
        .select(`
          id, status, enrolled_at, selected_addon_ids, notes, created_at,
          family_members(id, full_name, relationship, avatar_url),
          batches(
            id, batch_name, skill_level, fee_amount, fee_frequency, status,
            start_date, end_date, max_batch_size, current_enrollment_count,
            trainers(id, name, photo_url),
            batch_schedules(day_of_week, start_time, end_time),
            classes(
              id, title, cover_image_url, class_type,
              class_categories(name, slug),
              service_providers(id, business_name,
                users(full_name)
              )
            )
          )
        `)
        .eq("enrolled_by", userId!)
        .order("created_at", { ascending: false });

      if (status === "active") {
        query = query.in("status", ["active", "pending"]);
      } else if (status === "completed") {
        query = query.eq("status", "completed");
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

// ---- Enrollment Detail ----

export function useEnrollmentDetail(enrollmentId: string | undefined) {
  return useQuery({
    queryKey: ["enrollment-detail", enrollmentId],
    enabled: !!enrollmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("enrollments")
        .select(`
          id, status, enrolled_at, selected_addon_ids, notes, created_at,
          family_members(id, full_name, relationship, avatar_url, age_group),
          batches(
            id, batch_name, skill_level, fee_amount, fee_frequency, status,
            start_date, end_date, total_sessions, max_batch_size, current_enrollment_count,
            trainers(id, name, photo_url),
            batch_schedules(id, day_of_week, start_time, end_time),
            classes(
              id, title, cover_image_url, venue_details, class_type,
              class_categories(name),
              service_providers(id, business_name, whatsapp_number, upi_id, upi_qr_image_url,
                users(full_name, avatar_url)
              )
            )
          )
        `)
        .eq("id", enrollmentId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useEnrollmentAttendance(enrollmentId: string | undefined) {
  return useQuery({
    queryKey: ["enrollment-attendance", enrollmentId],
    enabled: !!enrollmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_records")
        .select("id, session_date, status, notes")
        .eq("enrollment_id", enrollmentId!)
        .order("session_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useEnrollmentPayments(enrollmentId: string | undefined) {
  return useQuery({
    queryKey: ["enrollment-payments", enrollmentId],
    enabled: !!enrollmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("id, amount, payment_type, status, paid_at, payment_period_start, payment_period_end, upi_transaction_id, confirmed_at")
        .eq("enrollment_id", enrollmentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useEnrollmentMaterials(classId: string | undefined, batchId: string | undefined) {
  return useQuery({
    queryKey: ["enrollment-materials", classId, batchId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_materials")
        .select("id, title, description, material_type, file_url, external_url, created_at, batch_id")
        .eq("class_id", classId!)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data?.filter((m) => !m.batch_id || m.batch_id === batchId) ?? data;
    },
  });
}
