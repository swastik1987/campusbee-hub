import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Persona = "seeker" | "provider" | "apartment_admin" | "platform_admin";

export type UserProfile = {
  id: string;
  auth_id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  mobile_number: string | null;
  is_provider: boolean;
  is_apartment_admin: boolean;
  is_platform_admin: boolean;
  last_active_persona: Persona;
  is_active: boolean;
  is_verified: boolean;
};

type FamilyRow = {
  id: string;
  primary_user_id: string;
  apartment_id: string;
  flat_number: string | null;
  block_tower: string | null;
};

type FamilyMemberRow = {
  id: string;
  family_id: string;
  name: string;
  date_of_birth: string | null;
  age_group: string | null;
  relationship: string | null;
  avatar_url: string | null;
  is_active: boolean;
};

type ApartmentRow = {
  id: string;
  name: string;
  city: string;
  locality: string;
  logo_url: string | null;
};

type ProviderProfileRow = {
  id: string;
  user_id: string;
  provider_type: string | null;
  business_name: string | null;
  bio: string | null;
  is_verified: boolean | null;
};

type UserContextType = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  family: FamilyRow | null;
  familyMembers: FamilyMemberRow[];
  currentApartment: ApartmentRow | null;
  providerProfile: ProviderProfileRow | null;
  loading: boolean;
  isNewUser: boolean;
  activePersona: Persona;
  activatePersona: (persona: Persona) => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshFamily: () => Promise<void>;
};

const UserContext = createContext<UserContextType>({
  session: null,
  user: null,
  profile: null,
  family: null,
  familyMembers: [],
  currentApartment: null,
  providerProfile: null,
  loading: true,
  isNewUser: false,
  activePersona: "seeker",
  activatePersona: async () => {},
  refreshProfile: async () => {},
  refreshFamily: async () => {},
});

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [family, setFamily] = useState<FamilyRow | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberRow[]>([]);
  const [currentApartment, setCurrentApartment] = useState<ApartmentRow | null>(null);
  const [providerProfile, setProviderProfile] = useState<ProviderProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [activePersona, setActivePersona] = useState<Persona>("seeker");

  const fetchFamily = useCallback(async (userId: string) => {
    const { data: fam } = await supabase
      .from("families")
      .select("id, primary_user_id, apartment_id, flat_number, block_tower")
      .eq("primary_user_id", userId)
      .maybeSingle();

    setFamily(fam);

    if (fam) {
      const [membersResult, aptResult] = await Promise.all([
        supabase
          .from("family_members")
          .select("id, family_id, name, date_of_birth, age_group, relationship, avatar_url, is_active")
          .eq("family_id", fam.id)
          .eq("is_active", true)
          .order("created_at"),
        supabase
          .from("apartment_complexes")
          .select("id, name, city, locality, logo_url")
          .eq("id", fam.apartment_id)
          .single(),
      ]);

      setFamilyMembers(membersResult.data ?? []);
      setCurrentApartment(aptResult.data);
    } else {
      setFamilyMembers([]);
      setCurrentApartment(null);
    }
  }, []);

  const fetchProviderProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("service_providers")
      .select("id, user_id, provider_type, business_name, bio, is_verified")
      .eq("user_id", userId)
      .maybeSingle();
    setProviderProfile(data);
  }, []);

  const fetchOrCreateProfile = useCallback(async (authUser: User) => {
    const { data: existing } = await supabase
      .from("users")
      .select("id, auth_id, full_name, email, avatar_url, mobile_number, is_provider, is_apartment_admin, is_platform_admin, last_active_persona, is_active, is_verified")
      .eq("auth_id", authUser.id)
      .maybeSingle();

    if (existing) {
      const prof = existing as unknown as UserProfile;
      setProfile(prof);
      setActivePersona((prof.last_active_persona as Persona) || "seeker");
      setIsNewUser(false);

      // Load related data in parallel
      await Promise.all([
        fetchFamily(prof.id),
        prof.is_provider ? fetchProviderProfile(prof.id) : Promise.resolve(),
      ]);
      return;
    }

    // Create new user row
    const { data: created, error } = await supabase
      .from("users")
      .insert({
        auth_id: authUser.id,
        email: authUser.email ?? null,
        full_name: authUser.user_metadata?.full_name ?? "",
      })
      .select("id, auth_id, full_name, email, avatar_url, mobile_number, is_provider, is_apartment_admin, is_platform_admin, last_active_persona, is_active, is_verified")
      .single();

    if (!error && created) {
      setProfile(created as unknown as UserProfile);
      setIsNewUser(true);
      setActivePersona("seeker");
    }
  }, [fetchFamily, fetchProviderProfile]);

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("users")
      .select("id, auth_id, full_name, email, avatar_url, mobile_number, is_provider, is_apartment_admin, is_platform_admin, last_active_persona, is_active, is_verified")
      .eq("auth_id", user.id)
      .maybeSingle();
    if (data) {
      const prof = data as unknown as UserProfile;
      setProfile(prof);
      setActivePersona((prof.last_active_persona as Persona) || "seeker");

      if (prof.is_provider) {
        fetchProviderProfile(prof.id);
      }
    }
  }, [user, fetchProviderProfile]);

  const refreshFamily = useCallback(async () => {
    if (!profile) return;
    await fetchFamily(profile.id);
  }, [profile, fetchFamily]);

  const activatePersona = useCallback(async (persona: Persona) => {
    setActivePersona(persona);
    if (profile) {
      await supabase
        .from("users")
        .update({ last_active_persona: persona })
        .eq("id", profile.id);
    }
  }, [profile]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, sess) => {
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          setTimeout(() => fetchOrCreateProfile(sess.user), 0);
        } else {
          setProfile(null);
          setFamily(null);
          setFamilyMembers([]);
          setCurrentApartment(null);
          setProviderProfile(null);
          setIsNewUser(false);
          setActivePersona("seeker");
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        fetchOrCreateProfile(sess.user);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <UserContext.Provider
      value={{
        session,
        user,
        profile,
        family,
        familyMembers,
        currentApartment,
        providerProfile,
        loading,
        isNewUser,
        activePersona,
        activatePersona,
        refreshProfile,
        refreshFamily,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
