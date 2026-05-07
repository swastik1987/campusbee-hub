import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";

/**
 * v2 onboarding hooks. v1 apartment search/creation/registration logic is gone.
 * Seekers set a home location via MapMyIndia in StepLocation.
 * Providers self-onboard into the Basic tier with no apartment binding.
 */

// ---- Profile (name, avatar, mobile) -------------------------------------
export function useUpdateProfile() {
  const { refreshProfile } = useUser();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      fullName,
      avatarUrl,
      mobileNumber,
    }: {
      userId: string;
      fullName: string;
      avatarUrl?: string | null;
      mobileNumber?: string | null;
    }) => {
      const updateObj: Record<string, unknown> = { full_name: fullName };
      if (avatarUrl !== undefined) updateObj.avatar_url = avatarUrl;
      if (mobileNumber !== undefined) updateObj.mobile_number = mobileNumber;

      const { error } = await supabase
        .from("users")
        .update(updateObj as never)
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshProfile();
      qc.invalidateQueries({ queryKey: ["user-profile"] });
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

// ---- Family (no apartment binding in v2) ---------------------------------
export function useCreateFamily() {
  return useMutation({
    mutationFn: async (_: { userId: string }) => {
      // Use a SECURITY DEFINER RPC to avoid RLS chicken-and-egg on the
      // families INSERT policy (the policy sub-selects users, which itself
      // hits RLS, causing the WITH CHECK to evaluate to NULL → 42501).
      // The RPC verifies the caller via auth.uid() internally and is
      // idempotent — returns the existing family if one already exists.
      const { data, error } = await supabase.rpc("create_own_family");
      if (error) throw error;
      return { id: data as string };
    },
  });
}

export function useAddFamilyMembers() {
  return useMutation({
    mutationFn: async (
      members: {
        family_id: string;
        full_name: string;
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

// ---- Provider self-onboarding (auto-approved Basic) ----------------------
export function useCreateProviderOnboarding() {
  const { refreshProfile } = useUser();

  return useMutation({
    mutationFn: async (input: {
      userId: string;
      providerType: "individual" | "academy";
      businessName: string;
      bio: string;
      homeAddress?: string;
      homeLat?: number;
      homeLng?: number;
    }) => {
      // 1. Create service_providers row, default subscription_tier='basic'
      const providerInsert: Record<string, unknown> = {
        user_id: input.userId,
        provider_type: input.providerType,
        business_name: input.businessName,
        bio: input.bio || null,
      };
      if (input.homeAddress) providerInsert.home_address = input.homeAddress;
      if (input.homeLat != null && input.homeLng != null) {
        providerInsert.home_location = `SRID=4326;POINT(${input.homeLng} ${input.homeLat})`;
      }

      const { data: provider, error: pErr } = await supabase
        .from("service_providers")
        .insert(providerInsert as never)
        .select("id")
        .single();
      if (pErr) throw pErr;

      // 2. Mark user as provider, switch active persona
      const { error: uErr } = await supabase
        .from("users")
        .update({ is_provider: true, last_active_persona: "provider" })
        .eq("id", input.userId);
      if (uErr) throw uErr;

      return provider;
    },
    onSuccess: async () => {
      await refreshProfile();
    },
  });
}

// ---- Provider profile update ---------------------------------------------
export function useUpdateProviderProfile() {
  const { refreshProfile } = useUser();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: {
      providerId: string;
      businessName?: string;
      providerType?: "individual" | "academy";
      bio?: string;
      experienceYears?: number | null;
      qualifications?: string | null;
      whatsappNumber?: string | null;
      logoUrl?: string | null;
    }) => {
      const updateObj: Record<string, unknown> = {};
      if (input.businessName !== undefined) updateObj.business_name = input.businessName;
      if (input.providerType !== undefined) updateObj.provider_type = input.providerType;
      if (input.bio !== undefined) updateObj.bio = input.bio;
      if (input.experienceYears !== undefined) updateObj.experience_years = input.experienceYears;
      if (input.qualifications !== undefined) updateObj.qualifications = input.qualifications;
      if (input.whatsappNumber !== undefined) updateObj.whatsapp_number = input.whatsappNumber;
      if (input.logoUrl !== undefined) updateObj.logo_url = input.logoUrl;

      if (Object.keys(updateObj).length === 0) return;

      const { error } = await supabase
        .from("service_providers")
        .update(updateObj as never)
        .eq("id", input.providerId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshProfile();
      qc.invalidateQueries({ queryKey: ["provider-profile"] });
    },
  });
}

// ---- Helpers --------------------------------------------------------------
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
