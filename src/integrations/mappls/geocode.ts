/**
 * Mappls geocoding helpers.
 *
 * IMPORTANT: Mappls REST APIs (geocode / reverse-geocode / Places search)
 * use OAuth2 with a CLIENT_ID + CLIENT_SECRET that must NEVER ship to the
 * browser. All REST calls therefore proxy through the Supabase edge
 * function `mappls-proxy` (Phase 3) which holds the secrets.
 *
 * For interactive picker UX (Phase 2) we do everything client-side via the
 * JS SDK's built-in Places autocomplete widget — that one does work with
 * just the public Web SDK key (VITE_MAPPLS_API_KEY).
 *
 * The wrappers below exist so app code can call `geocodeAddress(...)` etc.
 * once the proxy edge function lands, without touching call sites.
 */

import { supabase } from "@/integrations/supabase/client";

export type LatLng = { lat: number; lng: number };
export type GeocodeResult = LatLng & { formatted_address: string };

/**
 * Forward-geocode an address string. Goes through the `mappls-proxy` edge
 * function — until that exists (Phase 3) this throws a clear error so
 * components fall back to the picker UX.
 */
export async function geocodeAddress(address: string): Promise<GeocodeResult> {
  const { data, error } = await supabase.functions.invoke("mappls-proxy", {
    body: { op: "geocode", address },
  });
  if (error) throw error;
  return data as GeocodeResult;
}

/**
 * Reverse-geocode a coordinate. Same edge-function proxy.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string> {
  const { data, error } = await supabase.functions.invoke("mappls-proxy", {
    body: { op: "reverse_geocode", lat, lng },
  });
  if (error) throw error;
  return (data as { formatted_address: string }).formatted_address;
}
