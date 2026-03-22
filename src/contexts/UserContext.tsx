import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type UserProfile = {
  id: string;
  auth_id: string;
  full_name: string;
  email: string | null;
  avatar_url: string | null;
  is_provider: boolean;
  is_apartment_admin: boolean;
  is_platform_admin: boolean;
  last_active_persona: string;
  is_active: boolean;
  is_verified: boolean;
};

type UserContextType = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  isNewUser: boolean;
  refreshProfile: () => Promise<void>;
};

const UserContext = createContext<UserContextType>({
  session: null,
  user: null,
  profile: null,
  loading: true,
  isNewUser: false,
  refreshProfile: async () => {},
});

export const useUser = () => useContext(UserContext);

export const UserProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isNewUser, setIsNewUser] = useState(false);

  const fetchOrCreateProfile = async (authUser: User) => {
    // Check if user exists
    const { data: existing } = await supabase
      .from("users")
      .select("*")
      .eq("auth_id", authUser.id)
      .maybeSingle();

    if (existing) {
      setProfile(existing as unknown as UserProfile);
      setIsNewUser(false);
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
      .select()
      .single();

    if (!error && created) {
      setProfile(created as unknown as UserProfile);
      setIsNewUser(true);
    }
  };

  const refreshProfile = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("users")
      .select("*")
      .eq("auth_id", user.id)
      .maybeSingle();
    if (data) setProfile(data as unknown as UserProfile);
  };

  useEffect(() => {
    // Set up auth listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, sess) => {
        setSession(sess);
        setUser(sess?.user ?? null);
        if (sess?.user) {
          // Defer profile fetch to avoid deadlock
          setTimeout(() => fetchOrCreateProfile(sess.user), 0);
        } else {
          setProfile(null);
          setIsNewUser(false);
        }
        setLoading(false);
      }
    );

    // Then get initial session
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        fetchOrCreateProfile(sess.user);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <UserContext.Provider value={{ session, user, profile, loading, isNewUser, refreshProfile }}>
      {children}
    </UserContext.Provider>
  );
};
