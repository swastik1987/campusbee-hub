import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

export function useFamily() {
  const { profile } = useUser();

  return useQuery({
    queryKey: ["family", profile?.id],
    enabled: !!profile?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("families")
        .select("id, primary_user_id, apartment_id, flat_number, block_tower, created_at, updated_at")
        .eq("primary_user_id", profile!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useFamilyMembers(familyId: string | undefined) {
  return useQuery({
    queryKey: ["family-members", familyId],
    enabled: !!familyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("family_members")
        .select("id, family_id, name, date_of_birth, age_group, gender, relationship, avatar_url, is_active, created_at")
        .eq("family_id", familyId!)
        .eq("is_active", true)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

export function useCurrentApartment(apartmentId: string | undefined) {
  return useQuery({
    queryKey: ["apartment", apartmentId],
    enabled: !!apartmentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("apartment_complexes")
        .select("id, name, city, locality, logo_url, status")
        .eq("id", apartmentId!)
        .single();
      if (error) throw error;
      return data;
    },
  });
}
