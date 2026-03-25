import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---- Categories ----

export function useCategories() {
  return useQuery({
    queryKey: ["categories-all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_categories")
        .select("id, name, slug, icon_name, parent_category_id, display_order, is_active")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data;
    },
  });
}

// ---- Provider Classes ----

export function useProviderClasses(registrationIds: string[], statusFilter?: string) {
  return useQuery({
    queryKey: ["provider-classes", registrationIds, statusFilter],
    enabled: registrationIds.length > 0,
    queryFn: async () => {
      let query = supabase
        .from("classes")
        .select(`
          id, title, short_description, cover_image_url, class_type, status,
          is_featured, total_rating, rating_count, created_at,
          provider_registration_id,
          category_id, class_categories(name, slug, icon_name),
          provider_apartment_registrations(apartment_id, apartment_complexes(name))
        `)
        .in("provider_registration_id", registrationIds)
        .order("created_at", { ascending: false });

      if (statusFilter && statusFilter !== "all") {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useClassDetail(classId: string | undefined) {
  return useQuery({
    queryKey: ["class-detail", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select(`
          id, title, description, short_description, cover_image_url, gallery_urls,
          promo_video_url, class_type, skill_level, age_group_min, age_group_max,
          venue_details, what_to_bring, trial_available, trial_fee, status,
          is_featured, total_rating, rating_count, provider_registration_id, category_id,
          created_at, updated_at,
          class_categories(id, name, slug, icon_name),
          provider_apartment_registrations(id, apartment_id, provider_id,
            apartment_complexes(id, name, city, locality),
            service_providers(id, user_id, business_name, provider_type, bio, experience_years, whatsapp_number, upi_id, upi_qr_image_url, is_verified,
              users(full_name, avatar_url)
            )
          )
        `)
        .eq("id", classId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

// ---- Create / Update Class ----

export function useCreateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      providerRegistrationId: string;
      categoryId: string;
      title: string;
      description: string;
      shortDescription: string;
      classType: string;
      skillLevel: string[];
      ageGroupMin: number | null;
      ageGroupMax: number | null;
      venueDetails: string;
      whatToBring: string;
      coverImageUrl: string;
      galleryUrls: string[];
      promoVideoUrl: string;
      trialAvailable: boolean;
      trialFee: number;
      status: string;
    }) => {
      const { data, error } = await supabase
        .from("classes")
        .insert({
          provider_registration_id: input.providerRegistrationId,
          category_id: input.categoryId,
          title: input.title,
          description: input.description || null,
          short_description: input.shortDescription || null,
          class_type: input.classType,
          skill_level: input.skillLevel,
          age_group_min: input.ageGroupMin,
          age_group_max: input.ageGroupMax,
          venue_details: input.venueDetails || null,
          what_to_bring: input.whatToBring || null,
          cover_image_url: input.coverImageUrl || null,
          gallery_urls: input.galleryUrls,
          promo_video_url: input.promoVideoUrl || null,
          trial_available: input.trialAvailable,
          trial_fee: input.trialFee,
          status: input.status,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-classes"] });
    },
  });
}

export function useUpdateClassStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ classId, status }: { classId: string; status: string }) => {
      const { error } = await supabase
        .from("classes")
        .update({ status })
        .eq("id", classId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-classes"] });
      qc.invalidateQueries({ queryKey: ["class-detail"] });
    },
  });
}

export function useUpdateClass() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      classId: string;
      title?: string;
      description?: string;
      shortDescription?: string;
      classType?: string;
      skillLevel?: string[];
      ageGroupMin?: number | null;
      ageGroupMax?: number | null;
      venueDetails?: string;
      whatToBring?: string;
      coverImageUrl?: string;
      galleryUrls?: string[];
      promoVideoUrl?: string;
      trialAvailable?: boolean;
      trialFee?: number;
      status?: string;
      isFeatured?: boolean;
    }) => {
      const { classId, ...fields } = input;
      const updateObj: any = {};
      if (fields.title !== undefined) updateObj.title = fields.title;
      if (fields.description !== undefined) updateObj.description = fields.description || null;
      if (fields.shortDescription !== undefined) updateObj.short_description = fields.shortDescription || null;
      if (fields.classType !== undefined) updateObj.class_type = fields.classType;
      if (fields.skillLevel !== undefined) updateObj.skill_level = fields.skillLevel;
      if (fields.ageGroupMin !== undefined) updateObj.age_group_min = fields.ageGroupMin;
      if (fields.ageGroupMax !== undefined) updateObj.age_group_max = fields.ageGroupMax;
      if (fields.venueDetails !== undefined) updateObj.venue_details = fields.venueDetails || null;
      if (fields.whatToBring !== undefined) updateObj.what_to_bring = fields.whatToBring || null;
      if (fields.coverImageUrl !== undefined) updateObj.cover_image_url = fields.coverImageUrl || null;
      if (fields.galleryUrls !== undefined) updateObj.gallery_urls = fields.galleryUrls;
      if (fields.promoVideoUrl !== undefined) updateObj.promo_video_url = fields.promoVideoUrl || null;
      if (fields.trialAvailable !== undefined) updateObj.trial_available = fields.trialAvailable;
      if (fields.trialFee !== undefined) updateObj.trial_fee = fields.trialFee;
      if (fields.status !== undefined) updateObj.status = fields.status;
      if (fields.isFeatured !== undefined) updateObj.is_featured = fields.isFeatured;

      const { error } = await supabase.from("classes").update(updateObj).eq("id", classId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-classes"] });
      qc.invalidateQueries({ queryKey: ["class-detail"] });
    },
  });
}

export function useUploadClassImage() {
  return useMutation({
    mutationFn: async ({ classId, file, folder }: { classId: string; file: File; folder: string }) => {
      const ext = file.name.split(".").pop();
      const path = `${classId}/${folder}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("class-images").upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from("class-images").getPublicUrl(path);
      return data.publicUrl;
    },
  });
}

// ---- Batches ----

export function useBatches(classId: string | undefined) {
  return useQuery({
    queryKey: ["batches", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("batches")
        .select(`
          id, class_id, trainer_id, batch_name, batch_type, skill_level,
          age_group_min, age_group_max, max_batch_size, current_enrollment_count,
          fee_amount, fee_frequency, start_date, end_date, total_sessions,
          status, registration_mode, auto_waitlist, notes, created_at,
          trainers(id, name, photo_url)
        `)
        .eq("class_id", classId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useBatchSchedules(batchId: string | undefined) {
  return useQuery({
    queryKey: ["batch-schedules", batchId],
    enabled: !!batchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("batch_schedules")
        .select("id, batch_id, day_of_week, start_time, end_time, is_active")
        .eq("batch_id", batchId!)
        .eq("is_active", true)
        .order("day_of_week");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      classId: string;
      trainerId: string | null;
      batchName: string;
      batchType: string;
      skillLevel: string | null;
      ageGroupMin: number | null;
      ageGroupMax: number | null;
      maxBatchSize: number;
      feeAmount: number;
      feeFrequency: string;
      startDate: string | null;
      endDate: string | null;
      totalSessions: number | null;
      registrationMode: string;
      autoWaitlist: boolean;
      notes: string;
      registrationFee?: number;
      status: string;
      schedules: { dayOfWeek: number; startTime: string; endTime: string }[];
    }) => {
      const { data: batch, error: bErr } = await supabase
        .from("batches")
        .insert({
          class_id: input.classId,
          trainer_id: input.trainerId,
          batch_name: input.batchName,
          batch_type: input.batchType,
          skill_level: input.skillLevel,
          age_group_min: input.ageGroupMin,
          age_group_max: input.ageGroupMax,
          max_batch_size: input.maxBatchSize,
          fee_amount: input.feeAmount,
          fee_frequency: input.feeFrequency,
          start_date: input.startDate,
          end_date: input.endDate,
          total_sessions: input.totalSessions,
          registration_mode: input.registrationMode,
          auto_waitlist: input.autoWaitlist,
          notes: input.notes || null,
          registration_fee: input.registrationFee ?? 0,
          status: input.status,
        })
        .select("id")
        .single();
      if (bErr) throw bErr;

      // Create schedules
      if (input.schedules.length > 0) {
        const scheds = input.schedules.map((s) => ({
          batch_id: batch.id,
          day_of_week: s.dayOfWeek,
          start_time: s.startTime,
          end_time: s.endTime,
        }));
        const { error: sErr } = await supabase.from("batch_schedules").insert(scheds);
        if (sErr) throw sErr;
      }

      return batch;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
    },
  });
}

export function useUpdateBatchStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ batchId, status }: { batchId: string; status: string }) => {
      const { error } = await supabase
        .from("batches")
        .update({ status })
        .eq("id", batchId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["batches"] }),
  });
}

export function useUpdateBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      batchId: string;
      batchName?: string;
      maxBatchSize?: number;
      feeAmount?: number;
      feeFrequency?: string;
      registrationFee?: number;
      startDate?: string | null;
      endDate?: string | null;
      totalSessions?: number | null;
      registrationMode?: string;
      autoWaitlist?: boolean;
      notes?: string;
      status?: string;
    }) => {
      const { batchId, ...fields } = input;
      const updateObj: any = {};
      if (fields.batchName !== undefined) updateObj.batch_name = fields.batchName;
      if (fields.maxBatchSize !== undefined) updateObj.max_batch_size = fields.maxBatchSize;
      if (fields.feeAmount !== undefined) updateObj.fee_amount = fields.feeAmount;
      if (fields.feeFrequency !== undefined) updateObj.fee_frequency = fields.feeFrequency;
      if (fields.registrationFee !== undefined) updateObj.registration_fee = fields.registrationFee;
      if (fields.startDate !== undefined) updateObj.start_date = fields.startDate;
      if (fields.endDate !== undefined) updateObj.end_date = fields.endDate;
      if (fields.totalSessions !== undefined) updateObj.total_sessions = fields.totalSessions;
      if (fields.registrationMode !== undefined) updateObj.registration_mode = fields.registrationMode;
      if (fields.autoWaitlist !== undefined) updateObj.auto_waitlist = fields.autoWaitlist;
      if (fields.notes !== undefined) updateObj.notes = fields.notes || null;
      if (fields.status !== undefined) updateObj.status = fields.status;

      const { error } = await supabase.from("batches").update(updateObj).eq("id", batchId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["batches"] });
      qc.invalidateQueries({ queryKey: ["class-detail"] });
    },
  });
}

// ---- Class Addons ----

export function useClassAddons(classId: string | undefined) {
  return useQuery({
    queryKey: ["class-addons", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_addons")
        .select("id, class_id, name, description, fee_amount, fee_type, is_mandatory, is_active")
        .eq("class_id", classId!)
        .eq("is_active", true)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateAddon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      classId: string;
      name: string;
      description: string;
      feeAmount: number;
      feeType: string;
      isMandatory: boolean;
    }) => {
      const { error } = await supabase.from("class_addons").insert({
        class_id: input.classId,
        name: input.name,
        description: input.description || null,
        fee_amount: input.feeAmount,
        fee_type: input.feeType,
        is_mandatory: input.isMandatory,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["class-addons"] }),
  });
}

export function useDeleteAddon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (addonId: string) => {
      const { error } = await supabase
        .from("class_addons")
        .update({ is_active: false })
        .eq("id", addonId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["class-addons"] }),
  });
}
