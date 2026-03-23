// Supabase Edge Function: generate-payment-reminders
// Schedule: Daily via cron
// Purpose: Create payment_due and payment_overdue notifications for active enrollments

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

    const today = new Date();
    const currentDay = today.getDate();
    const currentMonth = today.getMonth() + 1;
    const currentYear = today.getFullYear();

    // Get all active enrollments with batch and class info
    const { data: enrollments, error: enrollErr } = await supabase
      .from("enrollments")
      .select(`
        id, enrolled_by, batch_id,
        batches(id, batch_name, fee_amount, fee_frequency, class_id,
          classes(title, provider_registration_id)
        )
      `)
      .eq("status", "active");

    if (enrollErr) throw enrollErr;

    let reminderCount = 0;
    let overdueCount = 0;

    for (const enrollment of enrollments ?? []) {
      const batch = enrollment.batches as any;
      if (!batch || batch.fee_frequency !== "monthly") continue;

      // Check if a confirmed/recorded payment exists for the current month
      const periodStart = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
      const periodEnd = `${currentYear}-${String(currentMonth).padStart(2, "0")}-28`;

      const { data: payments } = await supabase
        .from("payments")
        .select("id, status")
        .eq("enrollment_id", enrollment.id)
        .gte("payment_period_start", periodStart)
        .lte("payment_period_start", periodEnd)
        .in("status", ["recorded", "confirmed"]);

      const hasPaid = payments && payments.length > 0;
      if (hasPaid) continue;

      const className = batch.classes?.title ?? "your class";
      const batchName = batch.batch_name;

      // Check if we already sent a notification today for this enrollment
      const todayStr = today.toISOString().split("T")[0];
      const { data: existingNotifs } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", enrollment.enrolled_by)
        .eq("reference_type", "enrollment")
        .eq("reference_id", enrollment.id)
        .in("notification_type", ["payment_due", "payment_overdue"])
        .gte("created_at", `${todayStr}T00:00:00Z`);

      if (existingNotifs && existingNotifs.length > 0) continue;

      if (currentDay >= 10) {
        // Overdue — past the 10th without payment
        await supabase.from("notifications").insert({
          user_id: enrollment.enrolled_by,
          title: "Payment Overdue",
          body: `Payment for ${className} (${batchName}) is overdue. Please pay ₹${batch.fee_amount} at the earliest.`,
          notification_type: "payment_overdue",
          reference_type: "enrollment",
          reference_id: enrollment.id,
        });
        overdueCount++;
      } else if (currentDay >= 5) {
        // Due reminder — past the 5th
        await supabase.from("notifications").insert({
          user_id: enrollment.enrolled_by,
          title: "Payment Due",
          body: `Monthly fee of ₹${batch.fee_amount} for ${className} (${batchName}) is due. Please pay before the 10th.`,
          notification_type: "payment_due",
          reference_type: "enrollment",
          reference_id: enrollment.id,
        });
        reminderCount++;
      } else if (currentDay >= 2) {
        // Early reminder — 3 days before the 5th
        await supabase.from("notifications").insert({
          user_id: enrollment.enrolled_by,
          title: "Upcoming Payment",
          body: `Monthly fee of ₹${batch.fee_amount} for ${className} (${batchName}) is due soon.`,
          notification_type: "payment_due",
          reference_type: "enrollment",
          reference_id: enrollment.id,
        });
        reminderCount++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        reminders_sent: reminderCount,
        overdue_sent: overdueCount,
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
