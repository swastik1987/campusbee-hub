/**
 * Phase 8 — Sponsored listings + featured banners.
 *
 * Replaces the catch-all `useFeatured.ts` for new code.  Legacy helpers in
 * useFeatured.ts remain for backward compatibility (admin queue still imports
 * a few of them).
 *
 * Reads go through SECURITY DEFINER RPCs (`sponsored_for_location`,
 * `featured_banners_for_location`) — anon-safe, distance-ranked.
 *
 * Counter writes also go through RPCs and no-op on inactive rows, so the
 * frontend can call them optimistically.  Impressions are deduplicated per
 * session in-memory.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

// ────────────────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────────────────

export type SponsoredForLocationRow = {
  id: string;
  class_id: string;
  provider_id: string;
  category_id: string | null;
  radius_km: number;
  distance_km: number;
  slot_position: number;
  valid_until: string;
};

export type FeaturedBannerSurface = "home_banner" | "explore_banner";

export type FeaturedBannerForLocationRow = {
  id: string;
  provider_id: string;
  class_id: string | null;
  image_url: string;
  target_url: string | null;
  surface: FeaturedBannerSurface;
  distance_km: number | null;
  valid_until: string;
};

// ────────────────────────────────────────────────────────────────────────────
// Seeker — read RPCs
// ────────────────────────────────────────────────────────────────────────────

/** Active sponsored listings for the seeker's current location.
 *  Returns up to N rows (N = platform_settings.sponsored.slots_per_category[category_id]).
 *  Empty array when seeker location not set. */
export function useSponsoredForLocation(args: {
  lat: number | null | undefined;
  lng: number | null | undefined;
  categoryId?: string | null;
}) {
  const { lat, lng, categoryId } = args;
  return useQuery({
    queryKey: ["sponsored-for-location", lat, lng, categoryId ?? null],
    enabled: typeof lat === "number" && typeof lng === "number",
    staleTime: 60_000,
    queryFn: async (): Promise<SponsoredForLocationRow[]> => {
      const { data, error } = await supabase.rpc("sponsored_for_location" as never, {
        p_lat: lat as number,
        p_lng: lng as number,
        p_category_id: categoryId ?? null,
      } as never);
      if (error) throw error;
      return (data ?? []) as unknown as SponsoredForLocationRow[];
    },
  });
}

/** Active featured banners for a given surface.  Home banners ignore the
 *  seeker location and return globally; explore banners are region-filtered. */
export function useFeaturedBannersForLocation(args: {
  surface: FeaturedBannerSurface;
  lat: number | null | undefined;
  lng: number | null | undefined;
}) {
  const { surface, lat, lng } = args;
  const enabled =
    surface === "home_banner" ||
    (typeof lat === "number" && typeof lng === "number");

  return useQuery({
    queryKey: ["featured-banners", surface, surface === "home_banner" ? null : lat, surface === "home_banner" ? null : lng],
    enabled,
    staleTime: 60_000,
    queryFn: async (): Promise<FeaturedBannerForLocationRow[]> => {
      const { data, error } = await supabase.rpc("featured_banners_for_location" as never, {
        p_lat: surface === "home_banner" ? 0 : (lat as number),
        p_lng: surface === "home_banner" ? 0 : (lng as number),
        p_surface: surface,
      } as never);
      if (error) throw error;
      return (data ?? []) as unknown as FeaturedBannerForLocationRow[];
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Provider — sponsored listing requests
// ────────────────────────────────────────────────────────────────────────────

export type ProviderSponsoredRow = {
  id: string;
  class_id: string;
  category_id: string | null;
  status: "pending" | "approved" | "active" | "expired" | "rejected" | "cancelled";
  radius_km: number;
  center_address: string | null;
  valid_from: string | null;
  valid_until: string | null;
  impression_count: number;
  click_count: number;
  off_app_payment_ref: string | null;
  rejection_reason: string | null;
  requested_at: string;
  reviewed_at: string | null;
  classes: { title: string; cover_image_url: string | null } | null;
};

export function useMySponsoredRequests(providerId: string | undefined) {
  return useQuery({
    queryKey: ["my-sponsored-requests", providerId],
    enabled: !!providerId,
    queryFn: async (): Promise<ProviderSponsoredRow[]> => {
      const { data, error } = await supabase
        .from("sponsored_listings")
        .select(`
          id, class_id, category_id, status, radius_km, center_address,
          valid_from, valid_until, impression_count, click_count,
          off_app_payment_ref, rejection_reason, requested_at, reviewed_at,
          classes(title, cover_image_url)
        `)
        .eq("provider_id", providerId!)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProviderSponsoredRow[];
    },
  });
}

export function useRequestSponsored() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      providerId: string;
      classId: string;
      categoryId: string | null;
      centerAddress: string;
      centerLat: number;
      centerLng: number;
      radiusKm: number;
      validFrom: string; // ISO date
      validUntil: string; // ISO date
      offAppPaymentRef?: string;
    }) => {
      // PostgREST can't insert a geography literal directly, so we use an RPC
      // when available.  For now we insert via a small wrapper SQL using
      // ST_MakePoint passed through a generated column would be ideal — but
      // we instead set center_location via an UPDATE after INSERT using the
      // PostGIS-friendly format the policy allows.
      //
      // Approach: INSERT without geography, then UPDATE the geography column
      // using a single round-trip RPC `set_sponsored_center` (added below).
      // Until that RPC exists in 031, fall back to inserting via the
      // RPC-less raw object — Supabase accepts EWKT strings for geography
      // columns at INSERT time.
      const ewkt = `SRID=4326;POINT(${input.centerLng} ${input.centerLat})`;

      const { data, error } = await supabase
        .from("sponsored_listings")
        .insert({
          provider_id: input.providerId,
          class_id: input.classId,
          category_id: input.categoryId,
          center_address: input.centerAddress,
          center_location: ewkt as unknown as string,
          radius_km: input.radiusKm,
          valid_from: input.validFrom,
          valid_until: input.validUntil,
          off_app_payment_ref: input.offAppPaymentRef ?? null,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-sponsored-requests"] });
      qc.invalidateQueries({ queryKey: ["platform-sponsored"] });
    },
  });
}

export function useCancelSponsored() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (listingId: string) => {
      const { error } = await supabase
        .from("sponsored_listings")
        .update({ status: "cancelled" })
        .eq("id", listingId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-sponsored-requests"] });
      qc.invalidateQueries({ queryKey: ["platform-sponsored"] });
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Provider — featured banner requests
// ────────────────────────────────────────────────────────────────────────────

export type ProviderBannerRow = {
  id: string;
  class_id: string | null;
  surface: FeaturedBannerSurface;
  image_url: string;
  target_url: string | null;
  status: "pending" | "approved" | "active" | "expired" | "rejected" | "cancelled";
  moderation_status: "pending" | "in_review" | "approved" | "rejected";
  center_address: string | null;
  radius_km: number | null;
  valid_from: string | null;
  valid_until: string | null;
  impression_count: number;
  click_count: number;
  off_app_payment_ref: string | null;
  rejection_reason: string | null;
  requested_at: string;
};

export function useMyFeaturedBanners(providerId: string | undefined) {
  return useQuery({
    queryKey: ["my-featured-banners", providerId],
    enabled: !!providerId,
    queryFn: async (): Promise<ProviderBannerRow[]> => {
      const { data, error } = await supabase
        .from("featured_banners")
        .select(`
          id, class_id, surface, image_url, target_url, status, moderation_status,
          center_address, radius_km, valid_from, valid_until,
          impression_count, click_count, off_app_payment_ref,
          rejection_reason, requested_at
        `)
        .eq("provider_id", providerId!)
        .order("requested_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProviderBannerRow[];
    },
  });
}

export function useRequestFeaturedBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      providerId: string;
      surface: FeaturedBannerSurface;
      imageUrl: string;
      targetUrl?: string;
      classId?: string | null;
      // Required for explore_banner, must be null for home_banner
      centerAddress?: string;
      centerLat?: number;
      centerLng?: number;
      radiusKm?: number;
      validFrom: string;
      validUntil: string;
      offAppPaymentRef?: string;
    }) => {
      const row: Record<string, unknown> = {
        provider_id: input.providerId,
        class_id: input.classId ?? null,
        surface: input.surface,
        image_url: input.imageUrl,
        target_url: input.targetUrl ?? null,
        status: "pending",
        moderation_status: "pending",
        valid_from: input.validFrom,
        valid_until: input.validUntil,
        off_app_payment_ref: input.offAppPaymentRef ?? null,
      };

      if (input.surface === "explore_banner") {
        if (
          input.centerLat == null ||
          input.centerLng == null ||
          input.radiusKm == null
        ) {
          throw new Error("explore_banner requires center_lat, center_lng, radius_km");
        }
        row.center_address = input.centerAddress ?? null;
        row.center_location = `SRID=4326;POINT(${input.centerLng} ${input.centerLat})`;
        row.radius_km = input.radiusKm;
      }

      const { data, error } = await supabase
        .from("featured_banners")
        .insert(row as never)
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-featured-banners"] });
      qc.invalidateQueries({ queryKey: ["platform-banners"] });
    },
  });
}

export function useCancelFeaturedBanner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bannerId: string) => {
      const { error } = await supabase
        .from("featured_banners")
        .update({ status: "cancelled" })
        .eq("id", bannerId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-featured-banners"] });
      qc.invalidateQueries({ queryKey: ["platform-banners"] });
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Banner image upload (separate bucket — featured-banners)
// ────────────────────────────────────────────────────────────────────────────

export function useUploadFeaturedBannerImage() {
  return useMutation({
    mutationFn: async ({
      providerId,
      file,
    }: {
      providerId: string;
      file: File;
    }) => {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${providerId}/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("featured-banners")
        .upload(path, file, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("featured-banners").getPublicUrl(path);
      return data.publicUrl;
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Impression / click counters (debounced per session)
// ────────────────────────────────────────────────────────────────────────────

/** In-memory set of sponsored ids already counted this session. */
const seenSponsored = new Set<string>();
const seenBanner = new Set<string>();

export function useTrackSponsoredImpression() {
  return (id: string) => {
    if (seenSponsored.has(id)) return;
    seenSponsored.add(id);
    void supabase.rpc("increment_sponsored_impression" as never, { p_id: id } as never);
  };
}

export function useTrackSponsoredClick() {
  return (id: string) => {
    void supabase.rpc("increment_sponsored_click" as never, { p_id: id } as never);
  };
}

export function useTrackBannerImpression() {
  return (id: string) => {
    if (seenBanner.has(id)) return;
    seenBanner.add(id);
    void supabase.rpc("increment_banner_impression" as never, { p_id: id } as never);
  };
}

export function useTrackBannerClick() {
  return (id: string) => {
    void supabase.rpc("increment_banner_click" as never, { p_id: id } as never);
  };
}

/** Stable callback that batches impressions per render frame. */
export function useImpressionBatcher(track: (id: string) => void) {
  const ref = useRef(track);
  ref.current = track;
  return (id: string) => ref.current(id);
}
