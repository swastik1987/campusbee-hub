import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SupportType = "support" | "recommendation";
export type SupportStatus = "open" | "resolved";

export type SupportRequestAttachment = {
  id: string;
  file_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
};

export type SupportRequestRow = {
  id: string;
  user_id: string;
  type: SupportType;
  subject: string;
  body: string;
  status: SupportStatus;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_comment: string | null;
  created_at: string;
  updated_at: string;
  attachments?: SupportRequestAttachment[];
  user?: { full_name: string | null; email: string | null } | null;
};

const BASE_COLUMNS =
  "id, user_id, type, subject, body, status, resolved_by, resolved_at, resolution_comment, created_at, updated_at";

// ── Owner: my requests ───────────────────────────────────────────────────────

export function useMySupportRequests(userId: string | undefined) {
  return useQuery<SupportRequestRow[]>({
    queryKey: ["support-requests", "mine", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("support_requests")
        .select(
          `${BASE_COLUMNS}, attachments:support_request_attachments(id, file_path, file_name, mime_type, size_bytes)`,
        )
        .eq("user_id", userId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as SupportRequestRow[];
    },
  });
}

// ── Admin: all requests ──────────────────────────────────────────────────────

export function useAllSupportRequests(filters: {
  status?: SupportStatus | "all";
  type?: SupportType | "all";
}) {
  return useQuery<SupportRequestRow[]>({
    queryKey: ["support-requests", "all", filters.status ?? "all", filters.type ?? "all"],
    queryFn: async () => {
      let q = supabase
        .from("support_requests")
        .select(
          `${BASE_COLUMNS}, attachments:support_request_attachments(id, file_path, file_name, mime_type, size_bytes), user:users!support_requests_user_id_fkey(full_name, email)`,
        )
        .order("created_at", { ascending: false });
      if (filters.status && filters.status !== "all") q = q.eq("status", filters.status);
      if (filters.type   && filters.type   !== "all") q = q.eq("type",   filters.type);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as SupportRequestRow[];
    },
  });
}

// ── Create request ───────────────────────────────────────────────────────────

export type NewSupportRequestInput = {
  userId: string;
  type: SupportType;
  subject: string;
  body: string;
  files: File[];
};

const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "application/pdf"]);
const MAX_SIZE = 5 * 1024 * 1024;
const MAX_FILES = 5;

export function useCreateSupportRequest() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: NewSupportRequestInput) => {
      if (input.files.length > MAX_FILES) {
        throw new Error(`Maximum of ${MAX_FILES} attachments allowed`);
      }
      for (const f of input.files) {
        if (!ALLOWED_MIME.has(f.type)) {
          throw new Error(`Unsupported file type: ${f.name}`);
        }
        if (f.size > MAX_SIZE) {
          throw new Error(`${f.name} is larger than 5 MB`);
        }
      }

      // 1. Insert the parent row first so attachments can FK to it.
      const { data: req, error: insertErr } = await supabase
        .from("support_requests")
        .insert({
          user_id: input.userId,
          type: input.type,
          subject: input.subject.trim(),
          body: input.body.trim(),
        })
        .select("id")
        .single();
      if (insertErr || !req) throw insertErr ?? new Error("Insert failed");

      const requestId = req.id;

      // 2. Upload files in parallel; track per-file failures.
      const failures: string[] = [];
      await Promise.all(
        input.files.map(async (file) => {
          try {
            const cleanName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
            const uid =
              typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
            const path = `${input.userId}/${requestId}/${uid}-${cleanName}`;
            const { error: upErr } = await supabase.storage
              .from("support-attachments")
              .upload(path, file, {
                contentType: file.type,
                upsert: false,
              });
            if (upErr) throw upErr;
            const { error: rowErr } = await supabase
              .from("support_request_attachments")
              .insert({
                support_request_id: requestId,
                file_path: path,
                file_name: file.name,
                mime_type: file.type,
                size_bytes: file.size,
              });
            if (rowErr) throw rowErr;
          } catch (err) {
            console.error("[support] upload failed for", file.name, err);
            failures.push(file.name);
          }
        }),
      );

      return { requestId, failures };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-requests"] });
    },
  });
}

// ── Resolve request (admin) ──────────────────────────────────────────────────

export function useResolveSupportRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { requestId: string; comment?: string }) => {
      const { error } = await supabase.rpc("resolve_support_request", {
        p_request_id: args.requestId,
        p_comment: args.comment ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-requests"] });
    },
  });
}

// ── Signed URL helper for attachment previews ────────────────────────────────

export async function getSupportAttachmentUrl(filePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("support-attachments")
    .createSignedUrl(filePath, 60 * 60); // 1 hour
  if (error) {
    console.error("[support] signed URL failed:", error);
    return null;
  }
  return data?.signedUrl ?? null;
}
