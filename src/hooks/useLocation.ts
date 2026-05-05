/**
 * Location helpers — distance formatting, haversine fallback, and the
 * mutation that persists the seeker's home location to public.users.
 *
 * Geocoding helpers (forward/reverse) live in `@/integrations/mappls/geocode`
 * and require the Phase 3 edge function. For interactive picker UX, use
 * `<MapplsPicker />` instead.
 */

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { LatLng } from "@/integrations/mappls/geocode";

/** Format a kilometre value for display. */
export function formatDistance(km: number | null | undefined): string {
  if (km == null || isNaN(km)) return "";
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}

/** Haversine — straight-line km between two coordinates. Client-side fallback
 *  when we have lat/lng but don't want a round-trip to PostGIS. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export type LocationValue = {
  address: string;
  lat: number;
  lng: number;
};

/**
 * Persist a user's home location.
 *
 * Writes to `public.users.seeker_home_address` (text) and
 * `seeker_home_location` (PostGIS geography). PostGIS POINT input has
 * to be `POINT(lng lat)` in WKT — note the order is lng-first.
 */
export function useUpdateSeekerLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { userId: string } & LocationValue) => {
      // Save text address + PostGIS geography column + explicit lat/lng columns
      const { error } = await supabase
        .from("users")
        .update({
          seeker_home_address: input.address,
          // PostGIS EWKT: POINT(lng lat) — lng first is required by WKT spec
          seeker_home_location: `SRID=4326;POINT(${input.lng} ${input.lat})`,
          // Denormalized for client-side distance filtering (migration 021)
          seeker_home_lat: input.lat,
          seeker_home_lng: input.lng,
        })
        .eq("id", input.userId);

      if (!error) return input;

      // If the geography column doesn't exist yet (migration not applied),
      // fall back to saving the text address + explicit lat/lng only.
      if (error.message?.includes("seeker_home_location") || error.code === "42703") {
        const { error: textErr } = await supabase
          .from("users")
          .update({
            seeker_home_address: input.address,
            seeker_home_lat: input.lat,
            seeker_home_lng: input.lng,
          })
          .eq("id", input.userId);
        if (textErr) throw textErr;
        console.warn("[useLocation] seeker_home_location column missing — saved address + lat/lng only. Run migration 010 + 021.");
        return input;
      }

      throw error;
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["user-profile", variables.userId] });
      qc.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
}

/**
 * Persist a provider's home base location (used as fallback for
 * home-based classes). Writes to public.service_providers.
 */
export function useUpdateProviderHomeLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { providerId: string } & LocationValue) => {
      const { error } = await supabase
        .from("service_providers")
        .update({
          home_address: input.address,
          home_location: `SRID=4326;POINT(${input.lng} ${input.lat})` as unknown as never,
        })
        .eq("id", input.providerId);
      if (error) throw error;
      return input;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["provider-profile"] });
    },
  });
}
