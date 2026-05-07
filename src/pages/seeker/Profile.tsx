import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { useIncomingInvites } from "@/hooks/useFamilyLinking";
import {
  User,
  Users,
  GraduationCap,
  LogOut,
  ChevronRight,
  Link2,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

const Profile = () => {
  const { profile, family, familyMembers, activePersona, familyRole } = useUser();
  const navigate = useNavigate();
  const { data: incomingInvites } = useIncomingInvites(profile?.id, profile?.email ?? null, profile?.mobile_number ?? null);
  const pendingInviteCount = incomingInvites?.length ?? 0;

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
    toast.success("Logged out");
  };

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "";

  const isSeekerView = activePersona === "seeker";

  return (
    <div className={`${isSeekerView ? "seeker-theme" : ""} flex min-h-screen flex-col bg-background pb-20`}>
      {/* Gradient identity card header */}
      {isSeekerView ? (
        <div
          className="px-4 pt-14 pb-6"
          style={{ background: "linear-gradient(160deg, oklch(0.78 0.18 250) 0%, oklch(0.62 0.20 250) 100%)" }}
        >
          <div className="flex items-center gap-4">
            <Avatar className="h-18 w-18 border-4 border-white/30 shadow-xl" style={{ height: 72, width: 72 }}>
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="text-xl" style={{ background: "rgba(255,255,255,0.25)", color: "white" }}>
                {initials || <User size={28} />}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-white truncate">{profile?.full_name}</h2>
              <p className="text-white/70 text-sm truncate">{profile?.email ?? profile?.mobile_number}</p>
              {familyMembers.length > 0 && (
                <p className="text-white/60 text-xs mt-0.5">{familyMembers.length} family member{familyMembers.length > 1 ? "s" : ""}</p>
              )}
            </div>
          </div>
        </div>
      ) : (
        <>
          <Header />
          <div className="mx-auto w-full max-w-lg px-4 pt-4 flex flex-col items-center gap-3">
            <Avatar className="h-20 w-20 border-2 border-border">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="text-lg bg-muted">
                {initials || <User size={28} />}
              </AvatarFallback>
            </Avatar>
            <div className="text-center">
              <h2 className="text-lg font-bold">{profile?.full_name}</h2>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>
          </div>
        </>
      )}

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">

        {/* Children quick-view chips */}
        {isSeekerView && familyMembers.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Users size={15} className="text-primary" />
                Family
              </h3>
              <button
                onClick={() => navigate("/family")}
                className="text-xs text-primary font-medium"
              >
                Manage
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {familyMembers.map((member) => (
                <div key={member.id} className="flex flex-col items-center gap-1 flex-shrink-0 w-14">
                  <Avatar className="h-10 w-10 border-2 border-primary/20">
                    <AvatarFallback className="text-xs" style={{ backgroundColor: "oklch(0.88 0.10 250)", color: "oklch(0.38 0.16 250)" }}>
                      {(member.full_name ?? "")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-[10px] font-medium text-center leading-tight truncate w-full">
                    {member.full_name?.split(" ")[0]}
                  </p>
                  {member.relationship && (
                    <p className="text-[9px] text-muted-foreground text-center capitalize">{member.relationship}</p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Family management row (for non-seeker view) */}
        {!isSeekerView && familyMembers.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Users size={16} className="text-primary" />
                Family Members
              </h3>
              <span className="text-xs text-muted-foreground">
                {familyMembers.length} member{familyMembers.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-2">
              {familyMembers.map((member) => (
                <div key={member.id} className="flex items-center gap-3 rounded-lg bg-muted/50 p-2.5">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {(member.full_name ?? "")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{member.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {member.relationship}
                      {member.age_group && ` · ${member.age_group}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Account section */}
        <Card className="p-0 overflow-hidden">
          <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            Account
          </p>
          {family && (
            <button
              onClick={() => navigate("/family")}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent border-t border-border/50"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={isSeekerView ? { backgroundColor: "oklch(0.94 0.04 250)" } : { backgroundColor: "hsl(var(--primary)/0.1)" }}
              >
                <Link2 size={17} className="text-primary" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium">Manage Family</span>
                {familyRole && (
                  <p className="text-[10px] text-muted-foreground capitalize">{familyRole} account</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                {pendingInviteCount > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-white">
                    {pendingInviteCount}
                  </span>
                )}
                <ChevronRight size={16} className="text-muted-foreground" />
              </div>
            </button>
          )}
          {!profile?.is_provider && (
            <button
              onClick={() => navigate("/become-provider")}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent border-t border-border/50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-provider/10">
                <GraduationCap size={17} className="text-provider" />
              </div>
              <span className="flex-1 text-sm font-medium">Become a Provider</span>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          )}
          {profile?.is_platform_admin && (
            <button
              onClick={() => navigate("/platform")}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent border-t border-border/50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10">
                <Shield size={17} className="text-emerald-600" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium">Platform Admin</span>
                <p className="text-[10px] text-muted-foreground">Manage categories, providers & analytics</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          )}
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-destructive/10 border-t border-border/50"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-destructive/10">
              <LogOut size={17} className="text-destructive" />
            </div>
            <span className="flex-1 text-sm font-medium text-destructive">Log Out</span>
          </button>
        </Card>
      </div>

      <BottomNav persona={
        activePersona === "platform_admin" ? "platform_admin" :
        activePersona === "provider" ? "provider" : "seeker"
      } />
    </div>
  );
};

export default Profile;
