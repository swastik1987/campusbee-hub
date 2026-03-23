// Supabase Edge Function: expire-family-invites
// Schedule: Daily via cron
// Purpose: Expire pending family invites that have passed their expiry date

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

    // Find all pending invites that have expired
    const { data: expiredInvites, error: fetchErr } = await supabase
      .from("family_invites")
      .select("id, invited_by, invited_phone, invited_email, invited_user_id, family_id")
      .eq("status", "pending")
      .lt("expires_at", now);

    if (fetchErr) throw fetchErr;

    let expiredCount = 0;

    for (const invite of expiredInvites ?? []) {
      // Mark as expired
      await supabase
        .from("family_invites")
        .update({ status: "expired" })
        .eq("id", invite.id);

      expiredCount++;

      // Determine who was invited for the notification message
      let invitedName = invite.invited_email ?? invite.invited_phone ?? "someone";
      if (invite.invited_user_id) {
        const { data: invitedUser } = await supabase
          .from("users")
          .select("full_name")
          .eq("id", invite.invited_user_id)
          .single();
        if (invitedUser?.full_name) invitedName = invitedUser.full_name;
      }

      // Notify the inviter
      await supabase.from("notifications").insert({
        user_id: invite.invited_by,
        title: "Family Invite Expired",
        body: `Your family invite to ${invitedName} has expired. You can send a new invite from the Family Management page.`,
        notification_type: "family_invite_expired",
        reference_type: "family",
        reference_id: invite.family_id,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        expired_count: expiredCount,
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
