import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const nowIso = new Date().toISOString();

    // 1. Expire past listings
    const { data: expired, error: expireErr } = await supabase
      .from("sponsored_listings")
      .update({ status: "expired" })
      .eq("status", "active")
      .lt("valid_until", nowIso)
      .select("id");
    if (expireErr) throw expireErr;

    // 2. Activate approved listings whose window has started
    const { data: activated, error: activateErr } = await supabase
      .from("sponsored_listings")
      .update({ status: "active" })
      .eq("status", "approved")
      .lte("valid_from", nowIso)
      .gte("valid_until", nowIso)
      .select("id");
    if (activateErr) throw activateErr;

    return new Response(
      JSON.stringify({
        ok: true,
        expired: expired?.length ?? 0,
        activated: activated?.length ?? 0,
        ranAt: nowIso,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("refresh-sponsored-slots error", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});