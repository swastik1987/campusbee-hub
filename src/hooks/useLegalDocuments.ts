import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type LegalDocType = "terms" | "privacy";

export type ActiveLegalDocument = {
  id: string;
  doc_type: string;
  version: number;
  title: string;
  html_content: string;
  uploaded_at: string;
};

export type LegalDocumentVersion = {
  id: string;
  doc_type: string;
  version: number;
  title: string;
  uploaded_at: string;
  uploaded_by: string | null;
  is_active: boolean;
  uploader: { full_name: string | null; email: string | null } | null;
};

/** Public — fetches the active version of T&Cs or Privacy Policy. */
export function useActiveLegalDocument(docType: LegalDocType) {
  return useQuery<ActiveLegalDocument | null>({
    queryKey: ["legal-documents", "active", docType],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_active_legal_document", {
        p_doc_type: docType,
      });
      if (error) throw error;
      const rows = (data ?? []) as ActiveLegalDocument[];
      return rows.length > 0 ? rows[0] : null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Admin — full version history for a doc_type. */
export function useLegalVersionHistory(docType: LegalDocType) {
  return useQuery<LegalDocumentVersion[]>({
    queryKey: ["legal-documents", "history", docType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("legal_documents")
        .select(
          "id, doc_type, version, title, uploaded_at, uploaded_by, is_active, uploader:users!legal_documents_uploaded_by_fkey(full_name, email)",
        )
        .eq("doc_type", docType)
        .order("version", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LegalDocumentVersion[];
    },
  });
}

/** Admin — publish a new version (deactivates prior active). */
export function usePublishLegalDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      docType: LegalDocType;
      title: string;
      html: string;
      filePath?: string | null;
    }) => {
      const { data, error } = await supabase.rpc("publish_legal_document", {
        p_doc_type: args.docType,
        p_title: args.title,
        p_html: args.html,
        p_file_path: args.filePath ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: (_id, vars) => {
      qc.invalidateQueries({ queryKey: ["legal-documents", "active", vars.docType] });
      qc.invalidateQueries({ queryKey: ["legal-documents", "history", vars.docType] });
    },
  });
}

/** Authenticated user — record acceptance against the active version. */
export function useRecordAcceptance() {
  return useMutation({
    mutationFn: async (args: {
      docType: LegalDocType;
      ip?: string | null;
      userAgent?: string | null;
      fingerprint?: string | null;
    }) => {
      const { data, error } = await supabase.rpc("record_legal_acceptance", {
        p_doc_type: args.docType,
        p_ip: args.ip ?? null,
        p_user_agent: args.userAgent ?? null,
        p_fingerprint: args.fingerprint ?? null,
      });
      if (error) throw error;
      return data as string | null;
    },
  });
}

/**
 * Admin — upload the original .docx to the private legal-documents bucket.
 * Returns the storage path on success.
 */
export async function uploadLegalDocFile(
  docType: LegalDocType,
  version: number,
  file: File,
): Promise<string> {
  const safe = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
  const path = `${docType}/v${version}-${Date.now()}-${safe}`;
  const { error } = await supabase.storage
    .from("legal-documents")
    .upload(path, file, {
      contentType:
        file.type ||
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      upsert: false,
    });
  if (error) throw error;
  return path;
}
