import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---- Seeker: Active Featured Listings ----

export function useActiveFeaturedListings(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ["featured-listings", apartmentId],
    enabled: !!apartmentId,
    queryFn: async () => {
      const today = new Date().toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("featured_class_listings")
        .select(`
          id, class_id, banner_image_url, display_order, valid_until,
          classes(id, title, short_description, cover_image_url, provider_registration_id)
        `)
        .eq("apartment_id", apartmentId!)
        .eq("status", "active")
        .lte("valid_from", today)
        .gte("valid_until", today)
        .order("display_order")
        .limit(10);
      if (error) throw error;
      return data;
    },
  });
}

// ---- Provider: My Featured Requests ----

export function useProviderFeaturedRequests(
  providerId: string | undefined,
  apartmentRegIds: string[]
) {
  return useQuery({
    queryKey: ["provider-featured", providerId, apartmentRegIds],
    enabled: !!providerId && apartmentRegIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("featured_class_listings")
        .select(`
          id, class_id, apartment_id, provider_registration_id,
          banner_image_url, requested_at, requested_by,
          ad_fee, valid_from, valid_until, admin_notes,
          responded_by, responded_at, fee_status, status,
          display_order, created_at, updated_at,
          classes(title)
        `)
        .in("provider_registration_id", apartmentRegIds)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ---- Provider: Request a Featured Listing ----

interface RequestFeaturedInput {
  classId: string;
  apartmentId: string;
  providerRegistrationId: string;
  bannerImageUrl: string;
  requestedBy: string;
}

export function useRequestFeaturedListing() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: RequestFeaturedInput) => {
      const { data, error } = await supabase
        .from("featured_class_listings")
        .insert({
          class_id: input.classId,
          apartment_id: input.apartmentId,
          provider_registration_id: input.providerRegistrationId,
          banner_image_url: input.bannerImageUrl,
          requested_by: input.requestedBy,
          requested_at: new Date().toISOString(),
          status: "pending_approval",
          fee_status: "pending",
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-featured"] });
      queryClient.invalidateQueries({ queryKey: ["featured-listings"] });
    },
  });
}

// ---- Admin: All Featured Requests for Apartment ----

export function useAdminFeaturedRequests(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ["admin-featured", apartmentId],
    enabled: !!apartmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("featured_class_listings")
        .select(`
          id, class_id, apartment_id, provider_registration_id,
          banner_image_url, requested_at, requested_by,
          ad_fee, valid_from, valid_until, admin_notes,
          responded_by, responded_at, fee_status, status,
          display_order, created_at, updated_at,
          classes(title, cover_image_url),
          provider_apartment_registrations(
            service_providers(
              business_name,
              users(full_name)
            )
          )
        `)
        .eq("apartment_id", apartmentId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ---- Admin: Respond with Fee Proposal ----

interface AdminRespondInput {
  listingId: string;
  adFee: number;
  validFrom: string;
  validUntil: string;
  adminNotes?: string;
  respondedBy: string;
}

export function useAdminRespondFeatured() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AdminRespondInput) => {
      const { data, error } = await supabase
        .from("featured_class_listings")
        .update({
          ad_fee: input.adFee,
          valid_from: input.validFrom,
          valid_until: input.validUntil,
          admin_notes: input.adminNotes,
          responded_by: input.respondedBy,
          responded_at: new Date().toISOString(),
          fee_status: "fee_proposed",
          status: "fee_proposed",
        })
        .eq("id", input.listingId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-featured"] });
      queryClient.invalidateQueries({ queryKey: ["provider-featured"] });
      queryClient.invalidateQueries({ queryKey: ["featured-listings"] });
    },
  });
}

// ---- Admin: Reject Featured Request ----

interface AdminRejectInput {
  listingId: string;
  adminNotes?: string;
  respondedBy: string;
}

export function useAdminRejectFeatured() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: AdminRejectInput) => {
      const { data, error } = await supabase
        .from("featured_class_listings")
        .update({
          status: "rejected",
          admin_notes: input.adminNotes,
          responded_by: input.respondedBy,
          responded_at: new Date().toISOString(),
        })
        .eq("id", input.listingId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-featured"] });
      queryClient.invalidateQueries({ queryKey: ["provider-featured"] });
      queryClient.invalidateQueries({ queryKey: ["featured-listings"] });
    },
  });
}

// ---- Provider: Accept or Reject Proposed Fee ----

interface ProviderRespondToFeeInput {
  listingId: string;
  accept: boolean;
}

export function useProviderRespondToFeaturedFee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ProviderRespondToFeeInput) => {
      const updates = input.accept
        ? {
            fee_status: "accepted" as const,
            fee_accepted_at: new Date().toISOString(),
            status: "active" as const,
          }
        : {
            fee_status: "rejected" as const,
            status: "cancelled" as const,
          };

      const { data, error } = await supabase
        .from("featured_class_listings")
        .update(updates)
        .eq("id", input.listingId)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider-featured"] });
      queryClient.invalidateQueries({ queryKey: ["admin-featured"] });
      queryClient.invalidateQueries({ queryKey: ["featured-listings"] });
    },
  });
}

// ---- Upload Banner Image to Supabase Storage ----

interface UploadBannerInput {
  classId: string;
  file: File;
}

export function useUploadBannerImage() {
  return useMutation({
    mutationFn: async (input: UploadBannerInput) => {
      const ext = input.file.name.split(".").pop() || "jpg";
      const path = `${input.classId}/banners/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("class-images")
        .upload(path, input.file, {
          cacheControl: "3600",
          upsert: false,
        });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("class-images")
        .getPublicUrl(path);

      return data.publicUrl;
    },
  });
}
