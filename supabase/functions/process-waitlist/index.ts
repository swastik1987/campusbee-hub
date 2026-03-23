// Supabase Edge Function: process-waitlist
// Trigger: Called when an enrollment is dropped from a batch
// Purpose: Offer the open spot to the next person on the waitlist

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

    const { batch_id } = await req.json();
    if (!batch_id) {
      return new Response(
        JSON.stringify({ error: "batch_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Decrement the batch enrollment count
    const { data: batch } = await supabase
      .from("batches")
      .select("id, batch_name, current_enrollment_count, max_batch_size, class_id")
      .eq("id", batch_id)
      .single();

    if (!batch) {
      return new Response(
        JSON.stringify({ error: "Batch not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newCount = Math.max(0, (batch.current_enrollment_count ?? 0) - 1);
    await supabase
      .from("batches")
      .update({ current_enrollment_count: newCount })
      .eq("id", batch_id);

    // Get the class title for notifications
    const { data: cls } = await supabase
      .from("classes")
      .select("title")
      .eq("id", batch.class_id)
      .single();

    // Find the next person on the waitlist
    const { data: nextWaiter } = await supabase
      .from("waitlist_entries")
      .select("id, requested_by, family_member_id, batch_id")
      .eq("batch_id", batch_id)
      .eq("status", "waiting")
      .order("position", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!nextWaiter) {
      // Update batch status back to active if it was full
      if (batch.current_enrollment_count >= batch.max_batch_size) {
        await supabase
          .from("batches")
          .update({ status: "active" })
          .eq("id", batch_id);
      }
      return new Response(
        JSON.stringify({ success: true, message: "No waitlist entries to process" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Offer the spot — 24-hour window
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    await supabase
      .from("waitlist_entries")
      .update({
        status: "offered",
        offered_at: now.toISOString(),
        offer_expires_at: expiresAt.toISOString(),
      })
      .eq("id", nextWaiter.id);

    // Notify the user
    const className = cls?.title ?? "a class";
    await supabase.from("notifications").insert({
      user_id: nextWaiter.requested_by,
      title: "Spot Available!",
      body: `A spot opened in ${className} (${batch.batch_name})! Enroll within 24 hours before it's offered to the next person.`,
      notification_type: "waitlist_offered",
      reference_type: "waitlist",
      reference_id: nextWaiter.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        offered_to: nextWaiter.requested_by,
        expires_at: expiresAt.toISOString(),
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
