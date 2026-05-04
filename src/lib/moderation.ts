/**
 * src/lib/moderation.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Client-side helpers for the CampusBee content moderation pipeline.
 *
 * These functions sit between UI components and the ai-moderate-content edge
 * function, handling:
 *   • uploading images to Supabase Storage and immediately moderating them
 *   • moderating text fields before they are written to the DB
 *   • deleting rejected images from Storage (so they never go public)
 *   • providing simple status-check helpers for conditional UI rendering
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { supabase } from "@/integrations/supabase/client";
import type { RefType, ModerationStatus } from "@/hooks/useModeration";

export type { ModerationStatus, RefType };

interface ModerationCallResult {
  status: "approved" | "in_review" | "rejected";
  flagId?: string;
}

// ── uploadAndModerate ─────────────────────────────────────────────────────────
/**
 * Upload a File to Supabase Storage and immediately submit it for AI moderation.
 *
 * Workflow:
 *   1. Upload file to `bucket/storagePath` (upsert).
 *   2. Call ai-moderate-content edge function with the public URL.
 *   3. If rejected → delete the file from storage, return publicUrl = null.
 *   4. If approved / in_review → return the public URL.
 *
 * The calling component should reflect `moderationStatus` to the user:
 *   • "approved"  → show image normally
 *   • "in_review" → show image with "Under Review" badge
 *   • "rejected"  → show error, prompt re-upload
 */
export async function uploadAndModerate({
  file,
  bucket,
  storagePath,
  refType,
  refId,
  ownerUserId,
}: {
  file: File;
  bucket: string;
  storagePath: string;
  refType: RefType;
  refId: string;
  ownerUserId: string;
}): Promise<{
  publicUrl: string | null;
  moderationStatus: "approved" | "in_review" | "rejected";
  flagId?: string;
}> {
  // 1. Upload
  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  const publicUrl = urlData.publicUrl;

  // 2. Moderate
  const { data, error: fnError } = await supabase.functions.invoke("ai-moderate-content", {
    body: {
      ref_type: refType,
      ref_id: refId,
      owner_user_id: ownerUserId,
      image_url: publicUrl,
    },
  });

  if (fnError) throw fnError;
  const result = data as ModerationCallResult;

  // 3. Auto-delete rejected images so they never become public
  if (result.status === "rejected") {
    await supabase.storage.from(bucket).remove([storagePath]);
    return { publicUrl: null, moderationStatus: "rejected", flagId: result.flagId };
  }

  return { publicUrl, moderationStatus: result.status, flagId: result.flagId };
}

// ── moderateText ──────────────────────────────────────────────────────────────
/**
 * Submit a text field (title, description, bio) for AI moderation without
 * writing it to the DB first. The edge function handles the DB write via RPC.
 *
 * Usage pattern in a publish flow:
 *   const { status } = await moderateText({ text: title, refType: "class_title", ... });
 *   if (status === "rejected") { show error }
 *   if (status === "in_review") { show "pending review" state }
 */
export async function moderateText({
  text,
  refType,
  refId,
  ownerUserId,
}: {
  text: string;
  refType: RefType;
  refId: string;
  ownerUserId: string;
}): Promise<ModerationCallResult> {
  const { data, error } = await supabase.functions.invoke("ai-moderate-content", {
    body: {
      ref_type: refType,
      ref_id: refId,
      owner_user_id: ownerUserId,
      text,
    },
  });
  if (error) throw error;
  return data as ModerationCallResult;
}

// ── moderateClassPublish ──────────────────────────────────────────────────────
/**
 * Convenience helper for the "Publish class" flow.
 *
 * Moderates a class title + description in parallel. Returns an aggregate
 * status: the strictest verdict across all fields.
 *
 * Expected DB state before calling: class row exists with status = 'draft'.
 * The edge function / DB RPC will update `classes.moderation_status`.
 */
export async function moderateClassPublish({
  classId,
  title,
  description,
  ownerUserId,
}: {
  classId: string;
  title: string;
  description?: string | null;
  ownerUserId: string;
}): Promise<{ overallStatus: "approved" | "in_review" | "rejected"; results: ModerationCallResult[] }> {
  const tasks: Promise<ModerationCallResult>[] = [
    moderateText({ text: title, refType: "class_title", refId: classId, ownerUserId }),
  ];

  if (description?.trim()) {
    tasks.push(
      moderateText({ text: description, refType: "class_description", refId: classId, ownerUserId }),
    );
  }

  const results = await Promise.all(tasks);

  // Aggregate: rejected > in_review > approved
  let overallStatus: "approved" | "in_review" | "rejected" = "approved";
  for (const r of results) {
    if (r.status === "rejected") { overallStatus = "rejected"; break; }
    if (r.status === "in_review") overallStatus = "in_review";
  }

  return { overallStatus, results };
}

// ── Status helpers ────────────────────────────────────────────────────────────

/** Content is live and publicly visible. */
export function isPubliclyVisible(status: ModerationStatus | string | null | undefined): boolean {
  return status === "approved";
}

/** Content is waiting for AI or human review — hide from public listing. */
export function isAwaitingReview(status: ModerationStatus | string | null | undefined): boolean {
  return status === "in_review" || status === "pending";
}

/** Content was rejected — provider should fix and resubmit. */
export function isRejected(status: ModerationStatus | string | null | undefined): boolean {
  return status === "rejected";
}

/**
 * Map a moderation status to a human-readable description for the provider.
 */
export function getModerationMessage(status: ModerationStatus | string | null | undefined): string {
  switch (status) {
    case "approved":
      return "Your content has been approved and is publicly visible.";
    case "in_review":
      return "Your content is under review by our moderation team. It will be published once approved.";
    case "rejected":
      return "Your content was rejected by automated moderation. Please edit and resubmit.";
    case "pending":
    default:
      return "Your content is pending moderation review before going live.";
  }
}
