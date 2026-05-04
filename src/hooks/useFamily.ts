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
        .select("id, primary_user_id, created_at, updated_at")
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
        .select("id, family_id, full_name, date_of_birth, age_group, gender, relationship, avatar_url, is_active, created_at")
        .eq("family_id", familyId!)
        .eq("is_active", true)
        .order("created_at");
      if (error) throw error;
      return data;
    },
  });
}

/**
 * @deprecated v2 has no apartment_complexes table.
 * Returns null always; kept so existing callers don't break at compile time.
 */
export function useCurrentApartment(_apartmentId: string | undefined) {
  return useQuery({
    queryKey: ["apartment-stub"],
    queryFn: async () => null,
    staleTime: Infinity,
  });
}
