import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────────────────────────────

export type Certification = {
  id: string;
  owner_type: "provider" | "trainer";
  provider_id: string | null;
  trainer_id: string | null;
  name: string;
  issuing_authority: string | null;
  year_obtained: number | null;
  image_url: string;
  moderation_status: "pending" | "approved" | "rejected" | "in_review";
  moderation_notes: string | null;
  created_at: string;
};

const MAX_CERTS = 5;
const MAX_SIZE_MB = 5;

// ── Owner user_id resolution ──────────────────────────────────────────────────
// Both provider- and trainer-owned certs live in the same table. The
// ai-moderate-content edge function expects owner_user_id = public.users.id of
// the *authenticated caller*. For trainer-owned certs that's the trainer's
// owning provider's user_id (a trainer is not a user).
async function resolveOwnerUserId(
  ownerType: "provider" | "trainer",
  providerId?: string,
  trainerId?: string,
): Promise<string | undefined> {
  if (ownerType === "provider" && providerId) {
    const { data } = await supabase
      .from("service_providers")
      .select("user_id")
      .eq("id", providerId)
      .single();
    return (data as any)?.user_id ?? undefined;
  }
  if (ownerType === "trainer" && trainerId) {
    const { data: trainer } = await (supabase as any)
      .from("trainers")
      .select("provider_id")
      .eq("id", trainerId)
      .single();
    const provId = (trainer as any)?.provider_id;
    if (!provId) return undefined;
    const { data: sp } = await supabase
      .from("service_providers")
      .select("user_id")
      .eq("id", provId)
      .single();
    return (sp as any)?.user_id ?? undefined;
  }
  return undefined;
}

function storagePathFromPublicUrl(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl);
    const marker = "/certifications/";
    const idx = url.pathname.indexOf(marker);
    if (idx === -1) return null;
    return url.pathname.slice(idx + marker.length);
  } catch {
    return null;
  }
}

// ── Provider / Trainer own certs (all statuses) ────────────────────────────────

export function useProviderCertifications(providerId: string | undefined) {
  return useQuery({
    queryKey: ["certifications", "provider", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("certifications")
        .select("*")
        .eq("owner_type", "provider")
        .eq("provider_id", providerId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Certification[];
    },
  });
}

export function useTrainerCertifications(trainerId: string | undefined) {
  return useQuery({
    queryKey: ["certifications", "trainer", trainerId],
    enabled: !!trainerId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("certifications")
        .select("*")
        .eq("owner_type", "trainer")
        .eq("trainer_id", trainerId!)
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Certification[];
    },
  });
}

// ── Seeker-visible (approved only) ────────────────────────────────────────────

export function useSeekerProviderCertifications(providerId: string | undefined) {
  return useQuery({
    queryKey: ["certifications", "seeker-provider", providerId],
    enabled: !!providerId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("certifications")
        .select("id, name, issuing_authority, year_obtained, image_url")
        .eq("owner_type", "provider")
        .eq("provider_id", providerId!)
        .eq("moderation_status", "approved")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Certification[];
    },
  });
}

/**
 * Fetches certifications for what the seeker UI calls a "trainer".
 * Post-coaches-migration, the identifier passed in is actually a coach.id
 * (legacy trainers were copied into the coaches table). Certifications were
 * mirrored onto `coach_id` during that migration. We query by both columns to
 * keep working during the transition window.
 */
export function useSeekerTrainerCertifications(trainerId: string | undefined) {
  return useQuery({
    queryKey: ["certifications", "seeker-trainer", trainerId],
    enabled: !!trainerId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("certifications")
        .select("id, name, issuing_authority, year_obtained, image_url")
        .or(`coach_id.eq.${trainerId},trainer_id.eq.${trainerId}`)
        .eq("moderation_status", "approved")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as Certification[];
    },
  });
}

// ── Add certification (upload + insert + trigger moderation) ───────────────────

export function useAddCertification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      ownerType: "provider" | "trainer";
      providerId?: string;
      trainerId?: string;
      name: string;
      issuingAuthority?: string;
      yearObtained?: number | null;
      file: File;
    }) => {
      if (input.file.size > MAX_SIZE_MB * 1024 * 1024) {
        throw new Error(`Image must be under ${MAX_SIZE_MB} MB`);
      }

      const ownerCol = input.ownerType === "provider" ? "provider_id" : "trainer_id";
      const ownerId = input.ownerType === "provider" ? input.providerId : input.trainerId;

      const { count } = await (supabase as any)
        .from("certifications")
        .select("id", { count: "exact", head: true })
        .eq("owner_type", input.ownerType)
        .eq(ownerCol, ownerId!);

      if ((count ?? 0) >= MAX_CERTS) {
        throw new Error(`Maximum ${MAX_CERTS} certifications allowed`);
      }

      const ext = input.file.name.split(".").pop() ?? "jpg";
      const prefix =
        input.ownerType === "provider"
          ? `provider/${input.providerId}`
          : `trainer/${input.trainerId}`;
      const storagePath = `${prefix}/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("certifications")
        .upload(storagePath, input.file);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("certifications")
        .getPublicUrl(storagePath);
      const imageUrl = urlData.publicUrl;

      const { data: cert, error: insertErr } = await (supabase as any)
        .from("certifications")
        .insert({
          owner_type: input.ownerType,
          provider_id: input.providerId ?? null,
          trainer_id: input.trainerId ?? null,
          name: input.name.trim(),
          issuing_authority: input.issuingAuthority?.trim() || null,
          year_obtained: input.yearObtained ?? null,
          image_url: imageUrl,
          moderation_status: "pending",
        })
        .select("id")
        .single();

      if (insertErr) {
        await supabase.storage.from("certifications").remove([storagePath]);
        throw insertErr;
      }

      const ownerUserId = await resolveOwnerUserId(
        input.ownerType,
        input.providerId,
        input.trainerId,
      );

      supabase.functions
        .invoke("ai-moderate-content", {
          body: {
            ref_type: "certification",
            ref_id: (cert as any).id,
            owner_user_id: ownerUserId,
            image_url: imageUrl,
          },
        })
        .catch(() => {});

      return { id: (cert as any).id as string, imageUrl };
    },
    onSuccess: (_, input) => {
      if (input.ownerType === "provider") {
        qc.invalidateQueries({ queryKey: ["certifications", "provider", input.providerId] });
      } else {
        qc.invalidateQueries({ queryKey: ["certifications", "trainer", input.trainerId] });
      }
    },
  });
}

// ── Replace certification image (re-upload triggers re-moderation) ─────────────

export function useReplaceCertificationImage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      certId: string;
      oldImageUrl: string;
      ownerType: "provider" | "trainer";
      providerId?: string;
      trainerId?: string;
      file: File;
    }) => {
      if (input.file.size > MAX_SIZE_MB * 1024 * 1024) {
        throw new Error(`Image must be under ${MAX_SIZE_MB} MB`);
      }

      // Upload the new image first (don't delete the old one until DB row updated)
      const ext = input.file.name.split(".").pop() ?? "jpg";
      const prefix =
        input.ownerType === "provider"
          ? `provider/${input.providerId}`
          : `trainer/${input.trainerId}`;
      const newPath = `${prefix}/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("certifications")
        .upload(newPath, input.file);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from("certifications")
        .getPublicUrl(newPath);
      const newImageUrl = urlData.publicUrl;

      // Update DB row: new URL, reset to pending so moderation reruns end-to-end
      const { error: updErr } = await (supabase as any)
        .from("certifications")
        .update({
          image_url: newImageUrl,
          moderation_status: "pending",
          moderation_notes: null,
        })
        .eq("id", input.certId);

      if (updErr) {
        // Roll back new upload
        await supabase.storage.from("certifications").remove([newPath]);
        throw updErr;
      }

      // Remove old image (non-fatal on failure — orphan storage is acceptable)
      const oldPath = storagePathFromPublicUrl(input.oldImageUrl);
      if (oldPath) {
        await supabase.storage.from("certifications").remove([oldPath]).catch(() => {});
      }

      const ownerUserId = await resolveOwnerUserId(
        input.ownerType,
        input.providerId,
        input.trainerId,
      );

      // Kick off a fresh moderation pass
      supabase.functions
        .invoke("ai-moderate-content", {
          body: {
            ref_type: "certification",
            ref_id: input.certId,
            owner_user_id: ownerUserId,
            image_url: newImageUrl,
          },
        })
        .catch(() => {});

      return { id: input.certId, imageUrl: newImageUrl };
    },
    onSuccess: (_, input) => {
      const ownerId = input.ownerType === "provider" ? input.providerId : input.trainerId;
      qc.invalidateQueries({ queryKey: ["certifications", input.ownerType, ownerId] });
      qc.invalidateQueries({ queryKey: ["moderation-queue"] });
    },
  });
}

// ── Delete certification ───────────────────────────────────────────────────────

export function useDeleteCertification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      certId: string;
      imageUrl: string;
      ownerType: "provider" | "trainer";
      ownerId: string;
    }) => {
      const { error } = await (supabase as any)
        .from("certifications")
        .delete()
        .eq("id", input.certId);
      if (error) throw error;

      const path = storagePathFromPublicUrl(input.imageUrl);
      if (path) {
        await supabase.storage.from("certifications").remove([path]).catch(() => {});
      }
    },
    onSuccess: (_, input) => {
      qc.invalidateQueries({
        queryKey: ["certifications", input.ownerType, input.ownerId],
      });
      qc.invalidateQueries({
        queryKey: ["certifications", `seeker-${input.ownerType}`, input.ownerId],
      });
    },
  });
}

// ── Platform admin: certifications grouped per provider in the queue ──────────

export type CertModerationItem = {
  flag_id: string;
  cert_id: string;
  provider_id: string;
  provider_business_name: string | null;
  provider_user_name: string | null;
  owner_type: "provider" | "trainer";
  trainer_name: string | null;
  name: string;
  issuing_authority: string | null;
  year_obtained: number | null;
  image_url: string;
  ai_score: number | null;
  ai_categories: Record<string, unknown> | null;
  created_at: string;
};

/** Admin view: every in_review certification flag enriched with cert + owner
 *  context. Used by PlatformModeration to render the certification detail
 *  panel and the per-provider bulk-approve grouping. */
export function useCertificationModerationQueue() {
  return useQuery({
    queryKey: ["moderation-queue", "certifications"],
    queryFn: async () => {
      const { data: flags, error } = await (supabase as any)
        .from("moderation_flags")
        .select("id, ref_id, ai_score, ai_categories, image_url, created_at")
        .eq("ref_type", "certification")
        .eq("status", "in_review")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const certIds = (flags ?? []).map((f: any) => f.ref_id);
      if (certIds.length === 0) return [] as CertModerationItem[];

      const { data: certs, error: certErr } = await (supabase as any)
        .from("certifications")
        .select(`
          id, owner_type, provider_id, trainer_id, name, issuing_authority,
          year_obtained, image_url,
          service_providers!certifications_provider_id_fkey(
            id, business_name, users(full_name)
          ),
          trainers(name)
        `)
        .in("id", certIds);
      if (certErr) throw certErr;

      const certById = new Map<string, any>((certs ?? []).map((c: any) => [c.id, c]));

      return (flags ?? [])
        .map((flag: any): CertModerationItem | null => {
          const cert = certById.get(flag.ref_id);
          if (!cert) return null;
          return {
            flag_id: flag.id,
            cert_id: cert.id,
            provider_id: cert.provider_id,
            provider_business_name:
              cert.service_providers?.business_name ?? null,
            provider_user_name:
              cert.service_providers?.users?.full_name ?? null,
            owner_type: cert.owner_type,
            trainer_name: cert.trainers?.name ?? null,
            name: cert.name,
            issuing_authority: cert.issuing_authority,
            year_obtained: cert.year_obtained,
            image_url: cert.image_url ?? flag.image_url,
            ai_score: flag.ai_score,
            ai_categories: flag.ai_categories ?? null,
            created_at: flag.created_at,
          };
        })
        .filter(Boolean) as CertModerationItem[];
    },
  });
}

// ── Bulk approve certifications for one provider ──────────────────────────────

export function useBulkApproveCertifications() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      providerId: string;
      certIds: string[];
      notes?: string;
    }) => {
      const { data, error } = await supabase.rpc(
        "bulk_approve_certifications" as any,
        {
          p_provider_id: input.providerId,
          p_cert_ids: input.certIds,
          p_notes: input.notes ?? null,
        },
      );
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      return {
        approved: (row as any)?.approved_count ?? 0,
        skipped: (row as any)?.skipped_count ?? 0,
      };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["moderation-queue"] });
      qc.invalidateQueries({ queryKey: ["certifications"] });
    },
  });
}
