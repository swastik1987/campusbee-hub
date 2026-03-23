// Supabase Edge Function: send-notifications
// Trigger: Called by other functions or database webhooks
// Purpose: Central function to create notifications for various events

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type NotificationEvent =
  | "enrollment_approved"
  | "enrollment_rejected"
  | "payment_confirmed"
  | "payment_disputed"
  | "new_announcement"
  | "new_chat_message"
  | "class_tomorrow"
  | "waitlist_offered"
  | "new_review"
  | "provider_approved"
  | "provider_suspended"
  | "family_invite_received"
  | "family_invite_accepted"
  | "family_invite_rejected"
  | "family_member_unlinked"
  | "family_member_left"
  | "family_primary_transferred";

interface NotificationPayload {
  event: NotificationEvent;
  user_id: string;
  data: Record<string, any>;
}

const TEMPLATES: Record<NotificationEvent, (data: any) => { title: string; body: string; ref_type: string }> = {
  enrollment_approved: (d) => ({
    title: "Enrollment Approved!",
    body: `${d.member_name} has been enrolled in ${d.class_name} (${d.batch_name}).`,
    ref_type: "enrollment",
  }),
  enrollment_rejected: (d) => ({
    title: "Enrollment Rejected",
    body: `Enrollment for ${d.member_name} in ${d.class_name} was not approved. ${d.reason || ""}`.trim(),
    ref_type: "enrollment",
  }),
  payment_confirmed: (d) => ({
    title: "Payment Confirmed",
    body: `Your payment of ₹${d.amount} for ${d.class_name} has been confirmed by the provider.`,
    ref_type: "payment",
  }),
  payment_disputed: (d) => ({
    title: "Payment Disputed",
    body: `Your payment of ₹${d.amount} for ${d.class_name} has been disputed. Please contact the provider.`,
    ref_type: "payment",
  }),
  new_announcement: (d) => ({
    title: d.announcement_title || "New Announcement",
    body: d.announcement_body?.substring(0, 200) || "You have a new announcement.",
    ref_type: "announcement",
  }),
  new_chat_message: (d) => ({
    title: `Message from ${d.sender_name}`,
    body: d.message_preview?.substring(0, 150) || "You have a new message.",
    ref_type: "chat",
  }),
  class_tomorrow: (d) => ({
    title: "Class Tomorrow",
    body: `${d.class_name} (${d.batch_name}) is scheduled for tomorrow at ${d.time}.`,
    ref_type: "enrollment",
  }),
  waitlist_offered: (d) => ({
    title: "Spot Available!",
    body: `A spot opened in ${d.class_name} (${d.batch_name})! Enroll within 24 hours.`,
    ref_type: "waitlist",
  }),
  new_review: (d) => ({
    title: "New Review",
    body: `${d.reviewer_name} left a ${d.rating}-star review on ${d.class_name}.`,
    ref_type: "review",
  }),
  provider_approved: (d) => ({
    title: "Provider Application Approved!",
    body: `Your application to teach at ${d.apartment_name} has been approved. You can now create classes.`,
    ref_type: "provider",
  }),
  provider_suspended: (d) => ({
    title: "Provider Account Suspended",
    body: `Your provider access at ${d.apartment_name} has been suspended. ${d.reason || "Contact the admin for details."}`.trim(),
    ref_type: "provider",
  }),
  family_invite_received: (d) => ({
    title: "Family Invite",
    body: `${d.inviter_name} has invited you to join their family at ${d.apartment_name}.`,
    ref_type: "family",
  }),
  family_invite_accepted: (d) => ({
    title: "Invite Accepted",
    body: `${d.accepter_name} has joined your family.`,
    ref_type: "family",
  }),
  family_invite_rejected: (d) => ({
    title: "Invite Declined",
    body: `${d.rejecter_name} declined your family invite.`,
    ref_type: "family",
  }),
  family_member_unlinked: (d) => ({
    title: "Removed from Family",
    body: `You have been removed from ${d.family_owner_name}'s family.`,
    ref_type: "family",
  }),
  family_member_left: (d) => ({
    title: "Family Member Left",
    body: `${d.member_name} has left your family.`,
    ref_type: "family",
  }),
  family_primary_transferred: (d) => ({
    title: "You're Now the Primary Manager",
    body: `${d.previous_primary_name} has transferred the primary family manager role to you.`,
    ref_type: "family",
  }),
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload: NotificationPayload | NotificationPayload[] = await req.json();
    const notifications = Array.isArray(payload) ? payload : [payload];

    const results = [];

    for (const notif of notifications) {
      const template = TEMPLATES[notif.event];
      if (!template) {
        results.push({ event: notif.event, error: "Unknown event type" });
        continue;
      }

      const { title, body, ref_type } = template(notif.data);

      const { error: insertErr } = await supabase.from("notifications").insert({
        user_id: notif.user_id,
        title,
        body,
        notification_type: notif.event,
        reference_type: ref_type,
        reference_id: notif.data.reference_id || null,
      });

      results.push({
        event: notif.event,
        user_id: notif.user_id,
        success: !insertErr,
        error: insertErr?.message,
      });
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
