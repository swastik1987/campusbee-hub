import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---- Seeker: Active Sponsored Listings ----

/**
 * v2 replacement for the v1 featured_class_listings query.
 * Returns active sponsored_listings for the area (no apartment binding).
 * _apartmentId kept for API compat; ignored in v2.
 */
export function useActiveFeaturedListings(_apartmentId?: string) {
  return useQuery({
    queryKey: ["sponsored-listings-active"],
    queryFn: async () => {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from("sponsored_listings")
        .select(`
          id, class_id, slot_position, radius_km, valid_from, valid_until,
          classes(
            id, title, short_description, cover_image_url,
            class_categories(name, slug),
            service_providers(id, business_name,
              users(full_name, avatar_url)
            )
          )
        `)
        .eq("status", "active")
        .lte("valid_from", now)
        .gte("valid_until", now)
        .order("slot_position")
        .limit(10);
      if (error) throw error;
      return data;
    },
  });
}

// ---- Provider: My Sponsored Listing Requests ----

export function useProviderSponsoredRequests(providerId: string | undefined) {
  return useQuery({
    queryKey: ["provider-sponsored", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sponsored_listings")
        .select(`
          id, class_id, provider_id, status, slot_position,
          radius_km, valid_from, valid_until,
          off_app_payment_ref, rejection_reason,
          requested_at, reviewed_at,
          classes(title, cover_image_url)
        `)
        .eq("provider_id", providerId!)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ---- Provider: Request a Sponsored Slot ----

export function useRequestSponsoredListing() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      classId: string;
      providerId: string;
      offAppPaymentRef?: string;
      radiusKm?: number;
    }) => {
      const { data, error } = await supabase
        .from("sponsored_listings")
        .insert({
          class_id: input.classId,
          provider_id: input.providerId,
          status: "pending",
          radius_km: input.radiusKm ?? 10,
          off_app_payment_ref: input.offAppPaymentRef || null,
          requested_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-sponsored"] });
      qc.invalidateQueries({ queryKey: ["sponsored-listings-active"] });
    },
  });
}

// ---- Upload Banner Image ----

export function useUploadBannerImage() {
  return useMutation({
    mutationFn: async ({ classId, file }: { classId: string; file: File }) => {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${classId}/banners/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("class-images")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("class-images").getPublicUrl(path);
      return data.publicUrl;
    },
  });
}

// ---- Featured Banners (Premium providers) ----

export function useProviderFeaturedBanners(providerId: string | undefined) {
  return useQuery({
    queryKey: ["provider-featured-banners", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("featured_banners")
        .select("id, image_url, target_url, status, valid_from, valid_until, click_count, impression_count")
        .eq("provider_id", providerId!)
        .order("valid_from", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

// ---- Backward-compat stubs (v1 hooks — removed in v2) ----

/** @deprecated Use useProviderSponsoredRequests instead */
export function useProviderFeaturedRequests(
  providerId: string | undefined,
  _apartmentRegIds: string[]
) {
  return useProviderSponsoredRequests(providerId);
}

/** @deprecated No-op in v2 (no featured_class_listings table) */
export function useRequestFeaturedListing() {
  return useMutation({ mutationFn: async (_: any) => {} });
}

/** @deprecated No-op in v2 */
export function useAdminFeaturedRequests(_apartmentId: string | undefined) {
  return useQuery({
    queryKey: ["admin-featured-stub"],
    queryFn: async () => [] as any[],
    staleTime: Infinity,
  });
}

/** @deprecated No-op in v2 */
export function useAdminRespondFeatured() {
  return useMutation({ mutationFn: async (_: any) => {} });
}

/** @deprecated No-op in v2 */
export function useAdminRejectFeatured() {
  return useMutation({ mutationFn: async (_: any) => {} });
}

/** @deprecated No-op in v2 */
export function useProviderRespondToFeaturedFee() {
  return useMutation({ mutationFn: async (_: any) => {} });
}

/** @deprecated No-op in v2 */
export function useAdminDeactivateFeatured() {
  return useMutation({ mutationFn: async (_: any) => {} });
}

/** @deprecated No-op in v2 */
export function useAdminReactivateFeatured() {
  return useMutation({ mutationFn: async (_: any) => {} });
}
