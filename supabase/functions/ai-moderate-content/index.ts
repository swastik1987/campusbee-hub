// Supabase Edge Function: ai-moderate-content
// Phase 3 — Content Moderation Pipeline
//
// Input:  { ref_type, ref_id, owner_user_id, text?, image_url? }
// Output: { status: "approved" | "in_review" | "rejected", flagId? }
//
// Images → Sightengine (nudity-2.1, offensive, weapon, recreational_drug)
//   score ≥ 0.85 → rejected · 0.45–0.85 → in_review · <0.45 → approved
//
// Text → Google Gemini gemini-2.0-flash safety ratings
//   any HIGH → rejected · any MEDIUM → in_review · all LOW/NEGLIGIBLE → approved

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type ModerationStatus = "approved" | "in_review" | "rejected";

interface ModerateRequest {
  ref_type: string;
  ref_id: string;
  owner_user_id: string;
  text?: string;
  image_url?: string;
}

interface ModerationResult {
  status: ModerationStatus;
  score: number | null;
  categories: Record<string, unknown>;
  aiProvider: string;
}

// ─── Sightengine — image moderation ──────────────────────────────────────────

async function moderateImage(imageUrl: string): Promise<ModerationResult> {
  const apiUser = Deno.env.get("SIGHTENGINE_API_USER");
  const apiSecret = Deno.env.get("SIGHTENGINE_API_SECRET");

  if (!apiUser || !apiSecret) {
    console.warn("Sightengine credentials not set — auto-approving image");
    return { status: "approved", score: 0, categories: {}, aiProvider: "sightengine" };
  }

  const params = new URLSearchParams({
    url: imageUrl,
    models: "nudity-2.1,offensive,weapon,recreational_drug",
    api_user: apiUser,
    api_secret: apiSecret,
  });

  const resp = await fetch(
    `https://api.sightengine.com/1.0/check.json?${params}`,
  );
  if (!resp.ok) {
    throw new Error(`Sightengine HTTP ${resp.status}: ${await resp.text()}`);
  }

  const data = await resp.json() as Record<string, unknown>;

  if ((data as any).status === "failure") {
    throw new Error(`Sightengine error: ${JSON.stringify((data as any).error)}`);
  }

  // Collect the most relevant harm scores
  const scores: number[] = [];

  const nudity = (data as any).nudity as Record<string, number> | undefined;
  if (nudity) {
    scores.push(
      nudity.raw ?? 0,
      nudity.partial ?? 0,
      nudity.sexual_activity ?? 0,
      nudity.sexual_display ?? 0,
    );
  }

  const offensive = (data as any).offensive as Record<string, number> | undefined;
  if (offensive) scores.push(offensive.prob ?? 0);

  const weapon = (data as any).weapon as number | undefined;
  if (typeof weapon === "number") scores.push(weapon);

  const drug = (data as any).recreational_drug as Record<string, number> | undefined;
  if (drug) scores.push(drug.prob ?? 0);

  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;

  let status: ModerationStatus;
  if (maxScore >= 0.85) status = "rejected";
  else if (maxScore >= 0.45) status = "in_review";
  else status = "approved";

  return { status, score: maxScore, categories: data, aiProvider: "sightengine" };
}

// ─── Gemini — text moderation ─────────────────────────────────────────────────

const HARM_CATEGORIES = [
  "HARM_CATEGORY_HARASSMENT",
  "HARM_CATEGORY_HATE_SPEECH",
  "HARM_CATEGORY_SEXUALLY_EXPLICIT",
  "HARM_CATEGORY_DANGEROUS_CONTENT",
] as const;

async function moderateText(text: string): Promise<ModerationResult> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");

  if (!geminiKey) {
    console.warn("GEMINI_API_KEY not set — auto-approving text");
    return { status: "approved", score: null, categories: {}, aiProvider: "gemini" };
  }

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text }] }],
        // Set all thresholds to BLOCK_NONE so Gemini always returns ratings
        safetySettings: HARM_CATEGORIES.map((category) => ({
          category,
          threshold: "BLOCK_NONE",
        })),
      }),
    },
  );

  if (!resp.ok) {
    throw new Error(`Gemini HTTP ${resp.status}: ${await resp.text()}`);
  }

  const data = await resp.json() as Record<string, unknown>;
  const safetyRatings: Array<{ category: string; probability: string }> =
    (data as any).candidates?.[0]?.safetyRatings ?? [];

  let hasHigh = false;
  let hasMedium = false;

  for (const rating of safetyRatings) {
    if (!(HARM_CATEGORIES as readonly string[]).includes(rating.category)) continue;
    if (rating.probability === "HIGH") hasHigh = true;
    else if (rating.probability === "MEDIUM") hasMedium = true;
  }

  let status: ModerationStatus;
  if (hasHigh) status = "rejected";
  else if (hasMedium) status = "in_review";
  else status = "approved";

  return { status, score: null, categories: { safetyRatings }, aiProvider: "gemini" };
}

// ─── Main handler ─────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // ── Verify caller is authenticated ──────────────────────────────────────
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Parse request body ───────────────────────────────────────────────────
    const body: ModerateRequest = await req.json();
    const { ref_type, ref_id, owner_user_id, text, image_url } = body;

    if (!ref_type || !ref_id || !owner_user_id) {
      return new Response(
        JSON.stringify({ error: "ref_type, ref_id, owner_user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Ensure the authenticated user owns this content.
    // owner_user_id refers to public.users.id (not auth.users.id), so look it up.
    const { data: ownerRow, error: ownerErr } = await userClient
      .from("users")
      .select("id")
      .eq("auth_id", user.id)
      .maybeSingle();

    if (ownerErr || !ownerRow || ownerRow.id !== owner_user_id) {
      return new Response(
        JSON.stringify({ error: "Forbidden: owner_user_id must match authenticated user" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!text && !image_url) {
      return new Response(
        JSON.stringify({ error: "Either text or image_url is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Run AI moderation ────────────────────────────────────────────────────
    let result: ModerationResult;
    if (image_url) {
      result = await moderateImage(image_url);
    } else {
      result = await moderateText(text!);
    }

    // ── Record result via SECURITY DEFINER RPC (requires service_role) ───────
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: flagId, error: rpcErr } = await serviceClient.rpc(
      "submit_for_moderation",
      {
        p_ref_type: ref_type,
        p_ref_id: ref_id,
        p_owner_user_id: owner_user_id,
        p_ai_provider: result.aiProvider,
        p_ai_score: result.score,
        p_ai_categories: result.categories,
        p_initial_status: result.status,
        p_content_snapshot: text ?? null,
        p_image_url: image_url ?? null,
      },
    );

    if (rpcErr) {
      throw new Error(`DB RPC error: ${rpcErr.message}`);
    }

    console.log(`[ai-moderate-content] ref=${ref_type}/${ref_id} status=${result.status} provider=${result.aiProvider}`);

    return new Response(
      JSON.stringify({ status: result.status, flagId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[ai-moderate-content] error:", message);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
