import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

export function useApartments(search: string) {
  return useQuery({
    queryKey: ["apartments", search],
    queryFn: async () => {
      let query = supabase
        .from("apartment_complexes")
        .select("id, name, city, locality")
        .eq("status", "approved")
        .order("name");

      if (search.trim()) {
        const safe = search.trim().replace(/%/g, "\\%").replace(/_/g, "\\_");
        query = query.or(`name.ilike.%${safe}%,city.ilike.%${safe}%,locality.ilike.%${safe}%`);
      }

      const { data, error } = await query.limit(20);
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateProfile() {
  const { refreshProfile } = useUser();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      fullName,
      avatarUrl,
    }: {
      userId: string;
      fullName: string;
      avatarUrl?: string | null;
    }) => {
      const { error } = await supabase
        .from("users")
        .update({ full_name: fullName, avatar_url: avatarUrl ?? null })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
}

export function useCreateFamily() {
  return useMutation({
    mutationFn: async ({
      userId,
      apartmentId,
      flatNumber,
      blockTower,
    }: {
      userId: string;
      apartmentId: string;
      flatNumber: string;
      blockTower: string;
    }) => {
      const { data, error } = await supabase
        .from("families")
        .insert({
          primary_user_id: userId,
          apartment_id: apartmentId,
          flat_number: flatNumber || null,
          block_tower: blockTower || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      // Also create the family_links row so RLS policies work immediately
      await supabase
        .from("family_links")
        .insert({
          family_id: data.id,
          user_id: userId,
          role: "primary",
          status: "active",
          linked_via: "creation",
        });

      return data;
    },
  });
}

export function useRequestApartment() {
  const { profile } = useUser();

  return useMutation({
    mutationFn: async ({
      name,
      city,
      locality,
    }: {
      name: string;
      city: string;
      locality: string;
    }) => {
      const { data, error } = await supabase
        .from("apartment_complexes")
        .insert({
          name,
          city,
          locality,
          status: "pending",
          registered_by: profile?.id ?? null,
        })
        .select("id, name, city, locality")
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useAddFamilyMembers() {
  return useMutation({
    mutationFn: async (
      members: {
        family_id: string;
        name: string;
        date_of_birth: string | null;
        age_group: string | null;
        relationship: string;
        gender?: string | null;
      }[]
    ) => {
      const { error } = await supabase.from("family_members").insert(members);
      if (error) throw error;
    },
  });
}

export function useUploadAvatar() {
  return useMutation({
    mutationFn: async ({ userId, file }: { userId: string; file: File }) => {
      const ext = file.name.split(".").pop();
      const path = `${userId}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      return data.publicUrl;
    },
  });
}

export function calculateAgeGroup(dob: string): string | null {
  if (!dob) return null;
  const today = new Date();
  const birth = new Date(dob);
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;

  if (age < 3) return "toddler";
  if (age < 10) return "child";
  if (age < 18) return "teen";
  if (age < 60) return "adult";
  return "senior";
}
