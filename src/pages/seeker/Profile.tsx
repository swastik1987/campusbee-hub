import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { useIncomingInvites } from "@/hooks/useFamilyLinking";
import {
  User,
  Building2,
  Users,
  GraduationCap,
  LogOut,
  ChevronRight,
  MapPin,
  Home as HomeIcon,
  Link2,
  Shield,
} from "lucide-react";
import { toast } from "sonner";

const Profile = () => {
  const { profile, family, familyMembers, currentApartment, activePersona, familyRole } = useUser();
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

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-6 space-y-6">
        {/* Profile card */}
        <div className="flex flex-col items-center gap-3">
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

        {/* Apartment info */}
        {currentApartment && (
          <Card className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Building2 size={20} className="text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{currentApartment.name}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin size={10} />
                  {currentApartment.locality}, {currentApartment.city}
                </p>
              </div>
            </div>
            {family && (
              <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
                {family.flat_number && (
                  <span className="flex items-center gap-1">
                    <HomeIcon size={12} /> {family.flat_number}
                  </span>
                )}
                {family.block_tower && (
                  <span>{family.block_tower}</span>
                )}
              </div>
            )}
          </Card>
        )}

        {/* Family members */}
        {familyMembers.length > 0 && (
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
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-lg bg-muted/50 p-2.5"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xs bg-primary/10 text-primary">
                      {member.name[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{member.name}</p>
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

        {/* Family management link */}
        {family && (
          <button
            onClick={() => navigate("/family")}
            className="flex w-full items-center gap-3 rounded-xl p-4 text-left transition-colors hover:bg-accent"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
              <Link2 size={18} className="text-primary" />
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

        {/* Platform admin link */}
        {profile?.is_platform_admin && (
          <button
            onClick={() => navigate("/platform")}
            className="flex w-full items-center gap-3 rounded-xl p-4 text-left transition-colors hover:bg-accent"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/10">
              <Shield size={18} className="text-emerald-600" />
            </div>
            <span className="flex-1 text-sm font-medium">Platform Admin</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>
        )}

        {/* Actions */}
        <div className="space-y-1">
          {!profile?.is_provider && (
            <button
              onClick={() => navigate("/become-provider")}
              className="flex w-full items-center gap-3 rounded-xl p-4 text-left transition-colors hover:bg-accent"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-provider/10">
                <GraduationCap size={18} className="text-provider" />
              </div>
              <span className="flex-1 text-sm font-medium">
                Start Teaching on CampusBee
              </span>
              <ChevronRight size={16} className="text-muted-foreground" />
            </button>
          )}

          <Separator />

          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-3 text-destructive hover:text-destructive hover:bg-destructive/10"
          >
            <LogOut size={18} />
            Log Out
          </Button>
        </div>
      </div>

      <BottomNav persona={activePersona === "provider" ? "provider" : "seeker"} />
    </div>
  );
};

export default Profile;
