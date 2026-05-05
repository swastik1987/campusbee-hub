import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Persona = "seeker" | "provider" | "platform_admin";

export type UserProfile = {
  id: string;
  auth_id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  mobile_number: string | null;
  is_provider: boolean;
  is_platform_admin: boolean;
  last_active_persona: Persona;
  is_active: boolean;
  is_verified: boolean;
  seeker_home_address: string | null;
  /** Denormalized from seeker_home_location — set by migration 021 */
  seeker_home_lat: number | null;
  seeker_home_lng: number | null;
};

type FamilyRow = {
  id: string;
  primary_user_id: string;
};

type FamilyMemberRow = {
  id: string;
  family_id: string;
  full_name: string;
  date_of_birth: string | null;
  age_group: string | null;
  relationship: string | null;
  is_active: boolean;
};

type ProviderProfileRow = {
  id: string;
  user_id: string;
  provider_type: string | null;
  business_name: string | null;
  bio: string | null;
  is_verified: boolean | null;
  specialization_category_ids: string[] | null;
  subscription_tier: "basic" | "premium";
  subscription_valid_until: string | null;
  home_address: string | null;
};

type UserContextType = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  family: FamilyRow | null;
  familyMembers: FamilyMemberRow[];
  providerProfile: ProviderProfileRow | null;
  isPremium: boolean;
  loading: boolean;
  isNewUser: boolean;
  activePersona: Persona;
  familyRole: "primary" | "co_primary" | "viewer" | null;
  familyLinkId: string | null;
  /** Last error that prevented profile load — surfaced for debugging in Auth screen. */
  profileError: string | null;
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
  providerProfile: null,
  isPremium: false,
  loading: true,
  isNewUser: false,
  activePersona: "seeker",
  familyRole: null,
  familyLinkId: null,
  profileError: null,
  activatePersona: async () => {},
  refreshProfile: async () => {},
  refreshFamily: async () => {},
});

export const useUser = () => useContext(UserContext);

const PROFILE_COLUMNS =
  "id, auth_id, full_name, email, avatar_url, mobile_number, is_provider, is_platform_admin, last_active_persona, is_active, is_verified, seeker_home_address, seeker_home_lat, seeker_home_lng";

const PROVIDER_COLUMNS =
  "id, user_id, provider_type, business_name, bio, is_verified, specialization_category_ids, subscription_tier, subscription_valid_until, home_address";

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [family, setFamily] = useState<FamilyRow | null>(null);
  const [familyMembers, setFamilyMembers] = useState<FamilyMemberRow[]>([]);
  const [providerProfile, setProviderProfile] = useState<ProviderProfileRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);
  const [activePersona, setActivePersona] = useState<Persona>("seeker");
  const [familyRole, setFamilyRole] = useState<"primary" | "co_primary" | "viewer" | null>(null);
  const [familyLinkId, setFamilyLinkId] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const lastSyncedPersona = useRef<Persona>("seeker");

  const fetchFamily = useCallback(async (userId: string) => {
    // v2: family is found via family_links only (no apartment binding)
    const { data: link } = await supabase
      .from("family_links")
      .select("id, family_id, role")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    if (link) {
      setFamilyRole(link.role as "primary" | "co_primary" | "viewer");
      setFamilyLinkId(link.id);

      const { data: fam } = await supabase
        .from("families")
        .select("id, primary_user_id")
        .eq("id", link.family_id)
        .single();
      setFamily(fam);

      if (fam) {
        const { data: members } = await supabase
          .from("family_members")
          .select("id, family_id, full_name, date_of_birth, age_group, relationship, is_active")
          .eq("family_id", fam.id)
          .eq("is_active", true)
          .order("created_at");
        setFamilyMembers(members ?? []);
      } else {
        setFamilyMembers([]);
      }
      return;
    }

    // No active link — possibly a freshly created family without the link row yet
    const { data: fam } = await supabase
      .from("families")
      .select("id, primary_user_id")
      .eq("primary_user_id", userId)
      .maybeSingle();

    setFamily(fam);
    setFamilyRole(fam ? "primary" : null);
    setFamilyLinkId(null);

    if (fam) {
      const { data: members } = await supabase
        .from("family_members")
        .select("id, family_id, full_name, date_of_birth, age_group, relationship, is_active")
        .eq("family_id", fam.id)
        .eq("is_active", true)
        .order("created_at");
      setFamilyMembers(members ?? []);
    } else {
      setFamilyMembers([]);
    }
  }, []);

  const fetchProviderProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("service_providers")
      .select(PROVIDER_COLUMNS)
      .eq("user_id", userId)
      .maybeSingle();
    setProviderProfile(data as ProviderProfileRow | null);
  }, []);

  const fetchOrCreateProfile = useCallback(
    async (authUser: User) => {
      setProfileError(null);
      try {
        const { data: existing, error: selectError } = await supabase
          .from("users")
          .select(PROFILE_COLUMNS)
          .eq("auth_id", authUser.id)
          .maybeSingle();

        if (selectError) {
          console.error("[CampusBee] fetch profile:", selectError);
          setProfileError(`Profile load failed: ${selectError.message}`);
          return;
        }

        if (existing) {
          const prof = existing as unknown as UserProfile;
          setProfile(prof);
          setActivePersona((prof.last_active_persona as Persona) || "seeker");
          setIsNewUser(false);

          await Promise.all([
            fetchFamily(prof.id).catch((e) => console.error("[CampusBee] fetchFamily:", e)),
            prof.is_provider
              ? fetchProviderProfile(prof.id).catch((e) =>
                  console.error("[CampusBee] fetchProviderProfile:", e)
                )
              : Promise.resolve(),
          ]);
          return;
        }

        // Create new user row
        const fallbackName =
          authUser.user_metadata?.full_name ??
          authUser.user_metadata?.name ??
          (authUser.email ? authUser.email.split("@")[0] : "New User");

        const { data: created, error: insertError } = await supabase
          .from("users")
          .insert({
            auth_id: authUser.id,
            email: authUser.email ?? null,
            full_name: fallbackName,
          })
          .select(PROFILE_COLUMNS)
          .single();

        if (insertError) {
          console.error("[CampusBee] insert profile:", insertError);
          if (insertError.code === "23505") {
            // Duplicate — race; retry SELECT
            const { data: retry } = await supabase
              .from("users")
              .select(PROFILE_COLUMNS)
              .eq("auth_id", authUser.id)
              .maybeSingle();
            if (retry) {
              const prof = retry as unknown as UserProfile;
              setProfile(prof);
              setActivePersona((prof.last_active_persona as Persona) || "seeker");
              setIsNewUser(false);
              return;
            }
          }
          // Surface the error so Auth.tsx can show it instead of hanging forever
          const detail = insertError.details ? ` (${insertError.details})` : "";
          setProfileError(`Profile create failed: ${insertError.message}${detail}`);
          return;
        }

        if (created) {
          setProfile(created as unknown as UserProfile);
          setIsNewUser(true);
          setActivePersona("seeker");
        } else {
          setProfileError("Profile create returned no row (no error). Check RLS / triggers.");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[CampusBee] fetchOrCreateProfile:", err);
        setProfileError(`Unexpected error: ${msg}`);
      }
    },
    [fetchFamily, fetchProviderProfile]
  );

  const refreshProfile = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("users")
      .select(PROFILE_COLUMNS)
      .eq("auth_id", user.id)
      .maybeSingle();
    if (data) {
      const prof = data as unknown as UserProfile;
      setProfile(prof);
      setActivePersona((prof.last_active_persona as Persona) || "seeker");
      if (prof.is_provider) {
        fetchProviderProfile(prof.id);
      } else {
        setProviderProfile(null);
      }
    }
  }, [user, fetchProviderProfile]);

  const refreshFamily = useCallback(async () => {
    if (!profile) return;
    await fetchFamily(profile.id);
  }, [profile, fetchFamily]);

  const activatePersona = useCallback(
    async (persona: Persona) => {
      setActivePersona(persona);
      lastSyncedPersona.current = persona;
      if (profile) {
        await supabase
          .from("users")
          .update({ last_active_persona: persona })
          .eq("id", profile.id);
      }
    },
    [profile]
  );

  // ── Route-based persona sync (v2: no /admin/* — apartment admin removed) ──
  const location = useLocation();

  useEffect(() => {
    if (!profile) return;

    const path = location.pathname;
    let routePersona: Persona | null = null;

    if (path.startsWith("/provider/") || path === "/provider") {
      if (profile.is_provider) routePersona = "provider";
    } else if (path.startsWith("/platform")) {
      if (profile.is_platform_admin) routePersona = "platform_admin";
    } else if (
      path.startsWith("/explore") ||
      path.startsWith("/my-classes") ||
      path.startsWith("/class/") ||
      path.startsWith("/enroll/") ||
      path.startsWith("/enrollment/")
    ) {
      routePersona = "seeker";
    }

    if (
      routePersona &&
      routePersona !== activePersona &&
      routePersona !== lastSyncedPersona.current
    ) {
      lastSyncedPersona.current = routePersona;
      activatePersona(routePersona);
    }
  }, [location.pathname, profile, activePersona, activatePersona]);

  useEffect(() => {
    let isMounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, sess) => {
      if (!isMounted) return;
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // setTimeout avoids the Supabase deadlock when querying inside the callback
        setTimeout(() => {
          if (isMounted) fetchOrCreateProfile(sess.user);
        }, 0);
      } else {
        setProfile(null);
        setFamily(null);
        setFamilyMembers([]);
        setProviderProfile(null);
        setIsNewUser(false);
        setActivePersona("seeker");
        setFamilyRole(null);
        setFamilyLinkId(null);
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: sess }, error }) => {
      if (!isMounted) return;
      if (error) console.error("[CampusBee] getSession:", error);
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) fetchOrCreateProfile(sess.user);
      setLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived: is the provider currently on Premium?
  const isPremium = !!(
    providerProfile &&
    providerProfile.subscription_tier === "premium" &&
    (!providerProfile.subscription_valid_until ||
      new Date(providerProfile.subscription_valid_until) > new Date())
  );

  return (
    <UserContext.Provider
      value={{
        session,
        user,
        profile,
        family,
        familyMembers,
        providerProfile,
        isPremium,
        loading,
        isNewUser,
        activePersona,
        familyRole,
        familyLinkId,
        profileError,
        activatePersona,
        refreshProfile,
        refreshFamily,
      }}
    >
      {children}
    </UserContext.Provider>
  );
};
