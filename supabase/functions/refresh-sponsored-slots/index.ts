// Supabase Edge Function: refresh-sponsored-slots
//
// Schedule: every 15 minutes via Supabase cron.
//
// Purpose: mature sponsored_listings and featured_banners state.
//   - status='approved' AND valid_from <= now() <= valid_until → 'active'
//   - status IN ('approved','active') AND valid_until < now()  → 'expired'
//
// Delegates to the SECURITY DEFINER RPC `refresh_sponsored_lifecycle()` so
// the entire transition runs in a single DB round-trip and covers both
// sponsored_listings and featured_banners.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase.rpc("refresh_sponsored_lifecycle");
    if (error) throw error;

    const result = (data && (Array.isArray(data) ? data[0] : data)) ?? {};

    return new Response(
      JSON.stringify({
        ok: true,
        sponsored_activated: result.sponsored_activated ?? 0,
        sponsored_expired: result.sponsored_expired ?? 0,
        banners_activated: result.banners_activated ?? 0,
        banners_expired: result.banners_expired ?? 0,
        ran_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("refresh-sponsored-slots failed", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
