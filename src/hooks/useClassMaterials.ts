import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---- Provider: manage class materials ----

export function useClassMaterials(classId: string | undefined, batchId?: string) {
  return useQuery({
    queryKey: ["class-materials", classId, batchId],
    enabled: !!classId,
    queryFn: async () => {
      let query = supabase
        .from("class_materials")
        .select("id, class_id, batch_id, title, description, material_type, file_url, external_url, is_active, created_at, users(full_name)")
        .eq("class_id", classId!)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (batchId) {
        query = query.or(`batch_id.eq.${batchId},batch_id.is.null`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateClassMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      classId: string;
      batchId?: string;
      uploadedBy: string;
      title: string;
      description: string;
      materialType: string;
      fileUrl?: string;
      externalUrl?: string;
    }) => {
      const { error } = await supabase.from("class_materials").insert({
        class_id: input.classId,
        batch_id: input.batchId || null,
        uploaded_by: input.uploadedBy,
        title: input.title,
        description: input.description || null,
        material_type: input.materialType,
        file_url: input.fileUrl || null,
        external_url: input.externalUrl || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["class-materials"] });
      qc.invalidateQueries({ queryKey: ["enrollment-materials"] });
    },
  });
}

export function useDeleteClassMaterial() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (materialId: string) => {
      const { error } = await supabase
        .from("class_materials")
        .update({ is_active: false })
        .eq("id", materialId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["class-materials"] });
      qc.invalidateQueries({ queryKey: ["enrollment-materials"] });
    },
  });
}

export function useUploadMaterialFile() {
  return useMutation({
    mutationFn: async ({ file, classId }: { file: File; classId: string }) => {
      const ext = file.name.split(".").pop();
      const path = `${classId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("class-materials")
        .upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("class-materials").getPublicUrl(path);
      return data.publicUrl;
    },
  });
}
