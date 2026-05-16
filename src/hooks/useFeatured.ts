/**
 * Banner-image upload helper for the legacy banner picker on
 * `/provider/classes/:classId` (ProviderClassDetail). Writes into the
 * `class-images` bucket under `<classId>/banners/`.
 *
 * The richer Phase 8 sponsored / featured-banner workflow lives in
 * `useSponsored.ts` — this file used to host a thicket of v1-era hooks
 * (`useActiveFeaturedListings`, `useProviderSponsoredRequests`,
 * `useRequestSponsoredListing`, `useProviderFeaturedBanners`, plus six
 * `@deprecated` no-op stubs for the legacy admin queue). All of those
 * had zero callers post-Phase 8 and were removed in the May 2026
 * dead-code sweep.
 */

import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
