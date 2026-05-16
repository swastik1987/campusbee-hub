// Supabase Edge Function: revert-expired-coach-assignments
//
// Schedule: daily (e.g. 02:00 IST) via Supabase cron.
//
// Purpose: finds active coach_assignments rows whose valid_until has passed,
// marks them 'ended', and — for temporary swaps with original_coach_id set —
// re-instates the original coach's active assignment for that scope.
//
// Delegates to the SECURITY DEFINER RPC `revert_expired_coach_assignments()`
// so all transitions run inside a single DB round-trip.

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

    const { data, error } = await supabase.rpc("revert_expired_coach_assignments");
    if (error) throw error;

    return new Response(
      JSON.stringify({
        ok: true,
        reverted: (data as number) ?? 0,
        ran_at: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("revert-expired-coach-assignments failed", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
