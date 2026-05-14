// Supabase Edge Function: ai-moderate-content
// Content Moderation Pipeline (text, image, certification)
//
// Input:  { ref_type, ref_id, owner_user_id, text?, image_url? }
// Output: { status: "approved" | "in_review" | "rejected", flagId? }
//
// Pipelines by ref_type:
//   text-only refs (class_text, class_title, class_description, provider_bio)
//     → Gemini gemini-2.5-flash safety ratings
//   image-only refs (class_image, provider_avatar, banner)
//     → Sightengine (nudity-2.1, offensive, weapon, recreational_drug)
//   certification (image + genuineness check)
//     → Sightengine policy pass + Gemini Vision genuineness pass
//
// Thresholds (image safety):
//   score ≥ 0.85 → rejected · 0.45–0.85 → in_review · <0.45 → approved
// Thresholds (text safety):
//   any HIGH → rejected · any MEDIUM → in_review · all LOW/NEGLIGIBLE → approved
// Certification decision matrix (balanced):
//   Sightengine ≥ 0.85 OR Gemini verdict='not_a_certificate' high-conf → rejected
//   Sightengine < 0.45 AND Gemini verdict='genuine' high-conf            → approved
//   anything else                                                        → in_review

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const GEMINI_MODEL = "gemini-2.5-flash";

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
  /** Optional human-readable rejection reason (cert flow). */
  rejectionReason?: string;
}

// ─── Sightengine — image moderation ──────────────────────────────────────────

interface SightengineSummary {
  maxScore: number;
  raw: Record<string, unknown>;
  flaggedCategory: string | null;
}

async function runSightengine(imageUrl: string): Promise<SightengineSummary | null> {
  const apiUser = Deno.env.get("SIGHTENGINE_API_USER");
  const apiSecret = Deno.env.get("SIGHTENGINE_API_SECRET");

  if (!apiUser || !apiSecret) {
    console.warn("Sightengine credentials not set — skipping image safety scan");
    return null;
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

  // Track the highest harm signal and which category produced it
  const candidates: Array<{ score: number; category: string }> = [];

  const nudity = (data as any).nudity as Record<string, number> | undefined;
  if (nudity) {
    candidates.push(
      { score: nudity.raw ?? 0, category: "nudity.raw" },
      { score: nudity.partial ?? 0, category: "nudity.partial" },
      { score: nudity.sexual_activity ?? 0, category: "nudity.sexual_activity" },
      { score: nudity.sexual_display ?? 0, category: "nudity.sexual_display" },
    );
  }
  const offensive = (data as any).offensive as Record<string, number> | undefined;
  if (offensive) candidates.push({ score: offensive.prob ?? 0, category: "offensive" });

  const weapon = (data as any).weapon as number | undefined;
  if (typeof weapon === "number") candidates.push({ score: weapon, category: "weapon" });

  const drug = (data as any).recreational_drug as Record<string, number> | undefined;
  if (drug) candidates.push({ score: drug.prob ?? 0, category: "drug" });

  const top = candidates.reduce(
    (acc, c) => (c.score > acc.score ? c : acc),
    { score: 0, category: "" },
  );

  return {
    maxScore: top.score,
    raw: data,
    flaggedCategory: top.score > 0 ? top.category : null,
  };
}

async function moderateImage(imageUrl: string): Promise<ModerationResult> {
  const se = await runSightengine(imageUrl);
  if (!se) {
    return { status: "approved", score: 0, categories: {}, aiProvider: "sightengine" };
  }

  let status: ModerationStatus;
  if (se.maxScore >= 0.85) status = "rejected";
  else if (se.maxScore >= 0.45) status = "in_review";
  else status = "approved";

  return {
    status,
    score: se.maxScore,
    categories: se.raw,
    aiProvider: "sightengine",
  };
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
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
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

// ─── Gemini Vision — certification genuineness ────────────────────────────────

interface CertVerdict {
  is_certificate: boolean;
  verdict: "genuine" | "suspicious" | "not_a_certificate";
  confidence: "high" | "medium" | "low";
  issuer_text: string | null;
  recipient_text: string | null;
  issue_date_text: string | null;
  tampering_signals: string[];
  policy_violations: string[];
  reasoning: string;
}

async function downloadImageAsBase64(imageUrl: string): Promise<{ data: string; mime: string }> {
  const resp = await fetch(imageUrl);
  if (!resp.ok) {
    throw new Error(`Failed to download image: HTTP ${resp.status}`);
  }
  const contentType = resp.headers.get("content-type") ?? "image/jpeg";
  const buf = await resp.arrayBuffer();
  // base64-encode in chunks to avoid call-stack overflow on large blobs
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return { data: btoa(binary), mime: contentType };
}

const CERT_PROMPT = `You are a strict credential verifier reviewing an image uploaded by an instructor as proof of certification.

Examine the image and respond with ONLY a JSON object (no markdown, no prose, no code fences) matching this exact schema:
{
  "is_certificate": boolean,                  // does the image visually appear to be a certificate / diploma / credential document?
  "verdict": "genuine" | "suspicious" | "not_a_certificate",
  "confidence": "high" | "medium" | "low",    // your confidence in the verdict
  "issuer_text": string | null,               // the issuing authority text visible on the certificate, or null
  "recipient_text": string | null,            // recipient / awardee name visible, or null
  "issue_date_text": string | null,           // any date text visible, or null
  "tampering_signals": string[],              // visible signs of tampering (mismatched fonts, obvious edits, low resolution overlays, watermarks of another doc, etc.). Empty array if none.
  "policy_violations": string[],              // any text content visible that violates content policy (hate, sexual, harassment, illegal activity, etc.). Empty array if none.
  "reasoning": string                         // 1-2 short sentences explaining the verdict
}

Verdict rules:
- "not_a_certificate" if the image is clearly a meme, screenshot, photo of an unrelated subject, blank document, or otherwise NOT a credential.
- "suspicious" if it looks like a certificate but has tampering signals, missing required fields (issuer / recipient / date), or appears edited.
- "genuine" only if it visually resembles a real certificate AND has a plausible issuer, recipient, and date, AND shows no tampering signals.

Confidence rules:
- "high" only when you are very sure.
- "medium" for likely-but-not-certain.
- "low" when the image is blurry, partial, in an unfamiliar language, or otherwise hard to judge.

Respond with the JSON object only.`;

async function runCertGenuineness(imageUrl: string): Promise<CertVerdict | null> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    console.warn("GEMINI_API_KEY not set — skipping certification genuineness check");
    return null;
  }

  const { data: imageB64, mime } = await downloadImageAsBase64(imageUrl);

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: CERT_PROMPT },
              { inline_data: { mime_type: mime, data: imageB64 } },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          responseMimeType: "application/json",
        },
        safetySettings: HARM_CATEGORIES.map((category) => ({
          category,
          threshold: "BLOCK_NONE",
        })),
      }),
    },
  );

  if (!resp.ok) {
    throw new Error(`Gemini Vision HTTP ${resp.status}: ${await resp.text()}`);
  }

  const data = await resp.json() as Record<string, unknown>;
  const textOut: string | undefined =
    (data as any).candidates?.[0]?.content?.parts?.[0]?.text;

  if (!textOut) {
    console.warn("Gemini Vision returned no text content");
    return null;
  }

  try {
    const parsed = JSON.parse(textOut) as Partial<CertVerdict>;
    // Normalize / validate
    return {
      is_certificate: !!parsed.is_certificate,
      verdict: (["genuine", "suspicious", "not_a_certificate"].includes(
        String(parsed.verdict ?? ""),
      )
        ? parsed.verdict
        : "suspicious") as CertVerdict["verdict"],
      confidence: (["high", "medium", "low"].includes(String(parsed.confidence ?? ""))
        ? parsed.confidence
        : "low") as CertVerdict["confidence"],
      issuer_text: parsed.issuer_text ?? null,
      recipient_text: parsed.recipient_text ?? null,
      issue_date_text: parsed.issue_date_text ?? null,
      tampering_signals: Array.isArray(parsed.tampering_signals)
        ? parsed.tampering_signals.map(String)
        : [],
      policy_violations: Array.isArray(parsed.policy_violations)
        ? parsed.policy_violations.map(String)
        : [],
      reasoning: typeof parsed.reasoning === "string" ? parsed.reasoning : "",
    };
  } catch (err) {
    console.warn("Failed to parse Gemini Vision JSON:", err, "raw:", textOut);
    return null;
  }
}

async function moderateCertification(imageUrl: string): Promise<ModerationResult> {
  // Run both checks in parallel
  const [seResult, cv] = await Promise.allSettled([
    runSightengine(imageUrl),
    runCertGenuineness(imageUrl),
  ]);

  const se = seResult.status === "fulfilled" ? seResult.value : null;
  const verdict = cv.status === "fulfilled" ? cv.value : null;

  if (seResult.status === "rejected") {
    console.warn("Sightengine call failed for certification:", seResult.reason);
  }
  if (cv.status === "rejected") {
    console.warn("Gemini Vision call failed for certification:", cv.reason);
  }

  const seScore = se?.maxScore ?? 0;

  // Decision matrix (balanced):
  // 1. Hard rejects
  if (se && se.maxScore >= 0.85) {
    return {
      status: "rejected",
      score: seScore,
      categories: { sightengine: se.raw, gemini_vision: verdict },
      aiProvider: "gemini",
      rejectionReason: `Image flagged for inappropriate content (${se.flaggedCategory ?? "policy"}).`,
    };
  }
  if (
    verdict &&
    verdict.verdict === "not_a_certificate" &&
    verdict.confidence === "high"
  ) {
    return {
      status: "rejected",
      score: seScore,
      categories: { sightengine: se?.raw ?? null, gemini_vision: verdict },
      aiProvider: "gemini",
      rejectionReason:
        "The uploaded image does not appear to be a certificate. Please upload an image of an actual credential document.",
    };
  }
  if (verdict && verdict.policy_violations.length > 0) {
    return {
      status: "rejected",
      score: seScore,
      categories: { sightengine: se?.raw ?? null, gemini_vision: verdict },
      aiProvider: "gemini",
      rejectionReason: `Certificate contains policy-violating content: ${verdict.policy_violations.join(", ")}.`,
    };
  }

  // 2. Auto-approve: clean image + confidently genuine
  if (
    se &&
    se.maxScore < 0.45 &&
    verdict &&
    verdict.verdict === "genuine" &&
    verdict.confidence === "high" &&
    verdict.tampering_signals.length === 0
  ) {
    return {
      status: "approved",
      score: seScore,
      categories: { sightengine: se.raw, gemini_vision: verdict },
      aiProvider: "gemini",
    };
  }

  // 3. Everything else → admin review
  return {
    status: "in_review",
    score: seScore,
    categories: {
      sightengine: se?.raw ?? null,
      gemini_vision: verdict,
      review_reason: !verdict
        ? "AI genuineness check unavailable; manual review required."
        : verdict.verdict === "suspicious"
          ? "AI flagged possible tampering or missing fields."
          : verdict.confidence !== "high"
            ? "AI confidence too low for auto-decision."
            : "Mixed signals between safety and genuineness checks.",
    },
    aiProvider: "gemini",
  };
}

// ─── Owner notification (cert-specific: notify on every transition) ───────────

async function notifyCertOwner(
  serviceClient: ReturnType<typeof createClient>,
  ownerUserId: string,
  refId: string,
  status: ModerationStatus,
  rejectionReason?: string,
) {
  // submit_for_moderation already sends a notification on 'rejected'. For cert
  // flow we additionally want notifications on 'approved' and 'in_review'.
  if (status === "rejected") return; // handled by RPC

  const title =
    status === "approved" ? "Certification Approved" : "Certification Under Review";
  const body =
    status === "approved"
      ? "Your certification has been verified and is now visible on your profile."
      : "Your certification is being reviewed by our team. We'll notify you once a decision is made.";
  const type =
    status === "approved" ? "certification_approved" : "certification_in_review";

  try {
    await serviceClient.rpc("send_notification", {
      p_user_id: ownerUserId,
      p_title: title,
      p_body: body,
      p_type: type,
      p_ref_type: "certification",
      p_ref_id: refId,
    });
  } catch (err) {
    // Non-fatal: log only
    console.warn("notify_cert_owner failed:", err);
  }
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
    if (ref_type === "certification") {
      if (!image_url) {
        return new Response(
          JSON.stringify({ error: "certification ref_type requires image_url" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      result = await moderateCertification(image_url);
    } else if (image_url) {
      result = await moderateImage(image_url);
    } else {
      result = await moderateText(text!);
    }

    // ── Service-role client (for RPC + notifications) ────────────────────────
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);

    // For certification flow, write the rejection reason into the JSON body so
    // it surfaces to the instructor as moderation_notes. submit_for_moderation
    // already records ai_categories verbatim; the certifications table mirror
    // (handled in the SQL helper) picks up the snapshot.
    const categoriesForDb =
      ref_type === "certification" && result.rejectionReason
        ? { ...result.categories, rejection_reason: result.rejectionReason }
        : result.categories;

    const { data: flagId, error: rpcErr } = await serviceClient.rpc(
      "submit_for_moderation",
      {
        p_ref_type: ref_type,
        p_ref_id: ref_id,
        p_owner_user_id: owner_user_id,
        p_ai_provider: result.aiProvider,
        p_ai_score: result.score,
        p_ai_categories: categoriesForDb,
        p_initial_status: result.status,
        p_content_snapshot: text ?? null,
        p_image_url: image_url ?? null,
      },
    );

    if (rpcErr) {
      throw new Error(`DB RPC error: ${rpcErr.message}`);
    }

    // Cert-specific: notify on every state transition (RPC only fires on reject)
    if (ref_type === "certification") {
      await notifyCertOwner(serviceClient, owner_user_id, ref_id, result.status, result.rejectionReason);
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
