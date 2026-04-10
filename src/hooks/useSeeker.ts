import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---- Browse Classes (Seeker) ----

export function useFeaturedClasses(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ["featured-classes", apartmentId],
    enabled: !!apartmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select(`
          id, title, short_description, cover_image_url, class_type,
          total_rating, rating_count, trial_available, trial_fee,
          is_featured, created_at, requires_common_area,
          class_categories(id, name, slug),
          provider_apartment_registrations!inner(
            id, apartment_id,
            service_providers(id, business_name, provider_type,
              users(full_name, avatar_url)
            )
          )
        `)
        .eq("status", "published")
        .eq("is_featured", true)
        .eq("provider_apartment_registrations.apartment_id", apartmentId!)
        .in("provider_apartment_registrations.status", ["pending", "approved"])
        .limit(10);
      if (error) throw error;
      return data;
    },
  });
}

export function useNewClasses(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ["new-classes", apartmentId],
    enabled: !!apartmentId,
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data, error } = await supabase
        .from("classes")
        .select(`
          id, title, short_description, cover_image_url, class_type,
          total_rating, rating_count, created_at, requires_common_area,
          class_categories(id, name, slug),
          provider_apartment_registrations!inner(
            id, apartment_id,
            service_providers(id, business_name, provider_type,
              users(full_name, avatar_url)
            )
          )
        `)
        .eq("status", "published")
        .eq("provider_apartment_registrations.apartment_id", apartmentId!)
        .in("provider_apartment_registrations.status", ["pending", "approved"])
        .gte("created_at", thirtyDaysAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });
}

export function usePopularClasses(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ["popular-classes", apartmentId],
    enabled: !!apartmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select(`
          id, title, short_description, cover_image_url, class_type,
          total_rating, rating_count, created_at, requires_common_area,
          class_categories(id, name, slug),
          provider_apartment_registrations!inner(
            id, apartment_id,
            service_providers(id, business_name, provider_type,
              users(full_name, avatar_url)
            )
          )
        `)
        .eq("status", "published")
        .eq("provider_apartment_registrations.apartment_id", apartmentId!)
        .in("provider_apartment_registrations.status", ["pending", "approved"])
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
    enabled: !!filters.apartmentId,
    queryFn: async () => {
      let query = supabase
        .from("classes")
        .select(`
          id, title, short_description, cover_image_url, class_type,
          skill_level, age_group_min, age_group_max, total_rating, rating_count,
          trial_available, trial_fee, created_at, category_id, requires_common_area,
          class_categories!inner(id, name, slug, parent_category_id),
          provider_apartment_registrations!inner(
            id, apartment_id,
            service_providers(id, business_name, provider_type,
              users(full_name, avatar_url)
            )
          ),
          batches(id, fee_amount, fee_frequency, status, max_batch_size, current_enrollment_count,
            batch_schedules(day_of_week, start_time, end_time)
          )
        `)
        .eq("status", "published")
        .eq("provider_apartment_registrations.apartment_id", filters.apartmentId!)
        .in("provider_apartment_registrations.status", ["pending", "approved"]);

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
          total_rating, rating_count, created_at,
          class_categories(id, name, slug, icon_name),
          provider_apartment_registrations(
            id, apartment_id,
            apartment_complexes(id, name, city, locality),
            service_providers(id, user_id, business_name, provider_type, bio,
              experience_years, qualifications, specializations, whatsapp_number,
              upi_id, upi_qr_image_url, is_verified, profile_photos,
              users(id, full_name, avatar_url)
            )
          ),
          batches(id, batch_name, batch_type, skill_level, age_group_min, age_group_max,
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
          qualifications, specializations, profile_photos, intro_video_url,
          whatsapp_number, is_verified,
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

export function useProviderClasses(providerId: string | undefined, apartmentId: string | undefined) {
  return useQuery({
    queryKey: ["provider-public-classes", providerId, apartmentId],
    enabled: !!providerId,
    queryFn: async () => {
      let query = supabase
        .from("classes")
        .select(`
          id, title, short_description, cover_image_url, class_type,
          total_rating, rating_count, status,
          class_categories(id, name, slug),
          provider_apartment_registrations!inner(
            id, apartment_id, provider_id
          )
        `)
        .eq("status", "published")
        .eq("provider_apartment_registrations.provider_id", providerId!);

      if (apartmentId) {
        query = query.eq("provider_apartment_registrations.apartment_id", apartmentId);
      }

      const { data, error } = await query.order("created_at", { ascending: false });
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
    },
  });
}

export function useCreateWaitlistEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      batchId: string;
      familyMemberId: string;
      requestedBy: string;
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
          requested_by: input.requestedBy,
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
          family_members(id, name, relationship, avatar_url),
          batches(
            id, batch_name, skill_level, fee_amount, fee_frequency, status,
            start_date, end_date, max_batch_size, current_enrollment_count,
            trainers(id, name, photo_url),
            batch_schedules(day_of_week, start_time, end_time),
            classes(
              id, title, cover_image_url, class_type,
              class_categories(name, slug),
              provider_apartment_registrations(
                service_providers(id, business_name,
                  users(full_name)
                )
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
          family_members(id, name, relationship, avatar_url, age_group),
          batches(
            id, batch_name, skill_level, fee_amount, fee_frequency, status,
            start_date, end_date, total_sessions, max_batch_size, current_enrollment_count,
            trainers(id, name, photo_url),
            batch_schedules(id, day_of_week, start_time, end_time),
            classes(
              id, title, cover_image_url, venue_details, class_type,
              class_categories(name),
              provider_apartment_registrations(
                service_providers(id, business_name, whatsapp_number, upi_id, upi_qr_image_url,
                  users(full_name, avatar_url)
                )
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
        .select("id, session_date, status, notes, marked_at")
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
      let query = supabase
        .from("class_materials")
        .select("id, title, description, material_type, file_url, external_url, created_at, batch_id")
        .eq("class_id", classId!)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      // Get materials for this class (either no batch or matching batch)
      const { data, error } = await query;
      if (error) throw error;
      return data?.filter((m) => !m.batch_id || m.batch_id === batchId) ?? data;
    },
  });
}
