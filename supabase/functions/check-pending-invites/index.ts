// Supabase Edge Function: check-pending-invites
// Trigger: Called on user login
// Purpose: Match pending invites to the logged-in user's phone/email and return count

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

    const { user_id } = await req.json();
    if (!user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the user's email and phone
    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("id, email, mobile_number")
      .eq("id", user_id)
      .single();

    if (userErr || !user) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Find pending invites that match this user's email or phone but don't yet have invited_user_id set
    const now = new Date().toISOString();
    const conditions: string[] = [];
    if (user.email) conditions.push(`invited_email.eq.${user.email}`);
    if (user.mobile_number) conditions.push(`invited_phone.eq.${user.mobile_number}`);

    if (conditions.length > 0) {
      // Update invites that match by email/phone to set the invited_user_id
      // Only match non-expired invites
      const { data: matchingInvites } = await supabase
        .from("family_invites")
        .select("id")
        .is("invited_user_id", null)
        .eq("status", "pending")
        .gt("expires_at", now)
        .or(conditions.join(","));

      if (matchingInvites && matchingInvites.length > 0) {
        const ids = matchingInvites.map((i) => i.id);
        await supabase
          .from("family_invites")
          .update({ invited_user_id: user.id })
          .in("id", ids);
      }
    }

    // Now count all pending invites for this user (by user_id, email, or phone)
    const allConditions: string[] = [`invited_user_id.eq.${user.id}`];
    if (user.email) allConditions.push(`invited_email.eq.${user.email}`);
    if (user.mobile_number) allConditions.push(`invited_phone.eq.${user.mobile_number}`);

    const { count, error: countErr } = await supabase
      .from("family_invites")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending")
      .gt("expires_at", now)
      .or(allConditions.join(","));

    if (countErr) throw countErr;

    return new Response(
      JSON.stringify({
        success: true,
        pending_invite_count: count ?? 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message ?? "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
