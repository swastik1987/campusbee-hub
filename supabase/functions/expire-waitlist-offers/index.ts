// Supabase Edge Function: expire-waitlist-offers
// Schedule: Hourly via cron
// Purpose: Expire stale waitlist offers and move to the next person in line

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

    const now = new Date().toISOString();

    // Find all expired offers
    const { data: expiredOffers, error: fetchErr } = await supabase
      .from("waitlist_entries")
      .select("id, batch_id, requested_by")
      .eq("status", "offered")
      .lt("offer_expires_at", now);

    if (fetchErr) throw fetchErr;

    let expiredCount = 0;
    let reofferedCount = 0;

    for (const offer of expiredOffers ?? []) {
      // Mark as expired
      await supabase
        .from("waitlist_entries")
        .update({ status: "expired" })
        .eq("id", offer.id);

      expiredCount++;

      // Notify the user their offer expired
      await supabase.from("notifications").insert({
        user_id: offer.requested_by,
        title: "Waitlist Offer Expired",
        body: "Your waitlist spot offer has expired because it wasn't claimed within 24 hours.",
        notification_type: "waitlist_expired",
        reference_type: "waitlist",
        reference_id: offer.id,
      });

      // Find the next person in line for this batch
      const { data: nextWaiter } = await supabase
        .from("waitlist_entries")
        .select("id, requested_by")
        .eq("batch_id", offer.batch_id)
        .eq("status", "waiting")
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (nextWaiter) {
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await supabase
          .from("waitlist_entries")
          .update({
            status: "offered",
            offered_at: new Date().toISOString(),
            offer_expires_at: expiresAt.toISOString(),
          })
          .eq("id", nextWaiter.id);

        // Get batch/class info for notification
        const { data: batch } = await supabase
          .from("batches")
          .select("batch_name, class_id, classes(title)")
          .eq("id", offer.batch_id)
          .single();

        const className = (batch?.classes as any)?.title ?? "a class";
        const batchName = batch?.batch_name ?? "";

        await supabase.from("notifications").insert({
          user_id: nextWaiter.requested_by,
          title: "Spot Available!",
          body: `A spot opened in ${className} (${batchName})! Enroll within 24 hours.`,
          notification_type: "waitlist_offered",
          reference_type: "waitlist",
          reference_id: nextWaiter.id,
        });

        reofferedCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        expired: expiredCount,
        reoffered: reofferedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
