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

export function useSeekerTrainerCertifications(trainerId: string | undefined) {
  return useQuery({
    queryKey: ["certifications", "seeker-trainer", trainerId],
    enabled: !!trainerId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("certifications")
        .select("id, name, issuing_authority, year_obtained, image_url")
        .eq("owner_type", "trainer")
        .eq("trainer_id", trainerId!)
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
      // Size guard
      if (input.file.size > MAX_SIZE_MB * 1024 * 1024) {
        throw new Error(`Image must be under ${MAX_SIZE_MB} MB`);
      }

      // Count guard
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

      // Upload image to storage
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

      // Insert DB row
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
        // Roll back the storage upload on DB failure
        await supabase.storage.from("certifications").remove([storagePath]);
        throw insertErr;
      }

      // Resolve the owner's auth user_id for the moderation call
      let ownerUserId: string | undefined;
      if (input.ownerType === "provider" && input.providerId) {
        const { data: sp } = await supabase
          .from("service_providers")
          .select("user_id")
          .eq("id", input.providerId)
          .single();
        ownerUserId = (sp as any)?.user_id ?? undefined;
      }

      // Fire-and-forget moderation (non-blocking)
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
      // Delete DB row first
      const { error } = await (supabase as any)
        .from("certifications")
        .delete()
        .eq("id", input.certId);
      if (error) throw error;

      // Extract storage path from public URL and remove
      try {
        const url = new URL(input.imageUrl);
        const marker = "/certifications/";
        const idx = url.pathname.indexOf(marker);
        if (idx !== -1) {
          const storagePath = url.pathname.slice(idx + marker.length);
          await supabase.storage.from("certifications").remove([storagePath]);
        }
      } catch {
        // Non-fatal — row already deleted
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
