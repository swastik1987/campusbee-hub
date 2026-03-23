// Supabase Edge Function: handle-invite-accept
// Trigger: Called when an invitee accepts a family invite
// Purpose: Validates invite, creates family link, handles merge, sends notifications

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

    const { invite_id, user_id, merge_old_family_id } = await req.json();

    if (!invite_id || !user_id) {
      return new Response(
        JSON.stringify({ error: "invite_id and user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Fetch and validate the invite
    const { data: invite, error: inviteErr } = await supabase
      .from("family_invites")
      .select(`
        id, family_id, invited_by, status, expires_at, invite_type, claimed_member_id,
        families(id, apartment_id, apartment_complexes(name))
      `)
      .eq("id", invite_id)
      .single();

    if (inviteErr || !invite) {
      return new Response(
        JSON.stringify({ error: "Invite not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (invite.status !== "pending") {
      return new Response(
        JSON.stringify({ error: `Invite has already been ${invite.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      // Auto-expire it
      await supabase
        .from("family_invites")
        .update({ status: "expired" })
        .eq("id", invite_id);

      return new Response(
        JSON.stringify({ error: "This invite has expired" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user already has an active link to this family
    const { data: existingLink } = await supabase
      .from("family_links")
      .select("id")
      .eq("family_id", invite.family_id)
      .eq("user_id", user_id)
      .eq("status", "active")
      .maybeSingle();

    if (existingLink) {
      // Already linked — just mark invite as accepted
      await supabase
        .from("family_invites")
        .update({
          status: "accepted",
          accepted_by: user_id,
          accepted_at: new Date().toISOString(),
        })
        .eq("id", invite_id);

      return new Response(
        JSON.stringify({ success: true, message: "Already linked to this family" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Create the family_links row for the accepting user
    const { error: linkErr } = await supabase
      .from("family_links")
      .insert({
        family_id: invite.family_id,
        user_id: user_id,
        role: "member",
        status: "active",
        linked_via: invite.invite_type === "claim_member" ? "claim" : "invite",
      });

    if (linkErr) throw linkErr;

    // 3. Handle merge if the accepting user has an existing family
    let mergedMemberCount = 0;
    if (merge_old_family_id && merge_old_family_id !== invite.family_id) {
      // Move all family members from old family to the new one
      const { data: movedMembers, error: moveErr } = await supabase
        .from("family_members")
        .update({ family_id: invite.family_id })
        .eq("family_id", merge_old_family_id)
        .select("id");

      if (moveErr) throw moveErr;
      mergedMemberCount = movedMembers?.length ?? 0;

      // Move enrollments tied to old family members are already covered
      // since enrollments reference family_member_id (which we moved)

      // Deactivate the user's old family link
      await supabase
        .from("family_links")
        .update({
          status: "unlinked",
          unlinked_at: new Date().toISOString(),
        })
        .eq("family_id", merge_old_family_id)
        .eq("user_id", user_id);
    }

    // 4. Mark the invite as accepted
    const { error: updateErr } = await supabase
      .from("family_invites")
      .update({
        status: "accepted",
        accepted_by: user_id,
        accepted_at: new Date().toISOString(),
      })
      .eq("id", invite_id);

    if (updateErr) throw updateErr;

    // 5. Get names for notifications
    const { data: accepter } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", user_id)
      .single();

    const { data: inviter } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", invite.invited_by)
      .single();

    const accepterName = accepter?.full_name ?? "Someone";
    const inviterName = inviter?.full_name ?? "Someone";
    const apartmentName = (invite.families as any)?.apartment_complexes?.name ?? "your apartment";

    // 6. Send notifications to all parties

    // Notify the inviter that their invite was accepted
    await supabase.from("notifications").insert({
      user_id: invite.invited_by,
      title: "Invite Accepted",
      body: `${accepterName} has joined your family${mergedMemberCount > 0 ? ` and merged ${mergedMemberCount} family member${mergedMemberCount > 1 ? "s" : ""}` : ""}.`,
      notification_type: "family_invite_accepted",
      reference_type: "family",
      reference_id: invite.family_id,
    });

    // Notify all other linked members of this family (excluding inviter and accepter)
    const { data: otherLinks } = await supabase
      .from("family_links")
      .select("user_id")
      .eq("family_id", invite.family_id)
      .eq("status", "active")
      .neq("user_id", invite.invited_by)
      .neq("user_id", user_id);

    for (const link of otherLinks ?? []) {
      await supabase.from("notifications").insert({
        user_id: link.user_id,
        title: "New Family Member",
        body: `${accepterName} has joined your family at ${apartmentName}.`,
        notification_type: "family_invite_accepted",
        reference_type: "family",
        reference_id: invite.family_id,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        family_id: invite.family_id,
        merged_members: mergedMemberCount,
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
