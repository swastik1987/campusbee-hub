import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import Header from "@/components/layout/Header";
import MapplsPicker from "@/components/location/MapplsPicker";
import type { LocationValue } from "@/hooks/useLocation";
import {
  useUpdateSeekerLocation,
  useUpdateProviderHomeLocation,
} from "@/hooks/useLocation";
import {
  useUpdateProfile,
  useUploadAvatar,
  useUpdateProviderProfile,
} from "@/hooks/useOnboarding";
import { useIncomingInvites } from "@/hooks/useFamilyLinking";
import {
  Camera,
  ChevronRight,
  GraduationCap,
  HelpCircle,
  Link2,
  Loader2,
  LogOut,
  MapPin,
  Pencil,
  Shield,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import SupportRequestSheet from "@/components/support/SupportRequestSheet";
import SupportRequestList from "@/components/support/SupportRequestList";

const Profile = () => {
  const {
    profile,
    family,
    familyMembers,
    activePersona,
    familyRole,
    providerProfile,
  } = useUser();
  const navigate = useNavigate();
  const { data: incomingInvites } = useIncomingInvites(
    profile?.id,
    profile?.email ?? null,
    profile?.mobile_number ?? null,
  );
  const pendingInviteCount = incomingInvites?.length ?? 0;

  // ── Edit Profile sheet ──────────────────────────────────────────────────
  const [editOpen, setEditOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [loadingExtra, setLoadingExtra] = React.useState(false);

  // ── Support / Recommendation sheet ──────────────────────────────────────
  const [supportOpen, setSupportOpen] = React.useState(false);

  // Personal fields
  const [editName, setEditName] = React.useState("");
  const [editMobile, setEditMobile] = React.useState("");
  const [avatarFile, setAvatarFile] = React.useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Seeker home location
  const [editLocation, setEditLocation] = React.useState<LocationValue | null>(null);
  const [locationChanged, setLocationChanged] = React.useState(false);

  // Provider fields
  const [editBusinessName, setEditBusinessName] = React.useState("");
  const [editProviderType, setEditProviderType] = React.useState<
    "individual" | "academy" | null
  >(null);
  const [editBio, setEditBio] = React.useState("");
  const [editExperience, setEditExperience] = React.useState("");
  const [editQualifications, setEditQualifications] = React.useState("");
  const [editWhatsapp, setEditWhatsapp] = React.useState("");
  const [providerHomeLocation, setProviderHomeLocation] =
    React.useState<LocationValue | null>(null);
  const [providerLocationChanged, setProviderLocationChanged] =
    React.useState(false);

  // ── Mutations ────────────────────────────────────────────────────────────
  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();
  const updateSeekerLocation = useUpdateSeekerLocation();
  const updateProviderProf = useUpdateProviderProfile();
  const updateProviderLocation = useUpdateProviderHomeLocation();

  // ── Open edit sheet ──────────────────────────────────────────────────────
  const openEdit = async () => {
    // Personal
    setEditName(profile?.full_name ?? "");
    setEditMobile(profile?.mobile_number ?? "");
    setAvatarFile(null);
    setAvatarPreview(null);

    // Seeker location
    if (profile?.seeker_home_lat && profile?.seeker_home_lng) {
      setEditLocation({
        address: profile.seeker_home_address ?? "",
        lat: profile.seeker_home_lat,
        lng: profile.seeker_home_lng,
      });
    } else {
      setEditLocation(null);
    }
    setLocationChanged(false);

    // Provider (context fields)
    if (providerProfile) {
      setEditBusinessName(providerProfile.business_name ?? "");
      setEditProviderType(
        (providerProfile.provider_type as "individual" | "academy") ?? null,
      );
      setEditBio(providerProfile.bio ?? "");
      setEditWhatsapp("");
      setEditExperience("");
      setEditQualifications("");
      setProviderHomeLocation(null);
      setProviderLocationChanged(false);
    }

    setEditOpen(true);

    // Fetch extra provider fields not in UserContext
    if (providerProfile) {
      setLoadingExtra(true);
      const { data } = await supabase
        .from("service_providers")
        .select("experience_years, qualifications, whatsapp_number")
        .eq("id", providerProfile.id)
        .maybeSingle();
      if (data) {
        setEditExperience(
          data.experience_years != null ? String(data.experience_years) : "",
        );
        setEditQualifications(String((data as Record<string, unknown>).qualifications ?? ""));
        setEditWhatsapp(String((data as Record<string, unknown>).whatsapp_number ?? ""));
      }
      setLoadingExtra(false);
    }
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      // 1. Upload avatar if changed
      let newAvatarUrl: string | null | undefined = undefined;
      if (avatarFile) {
        newAvatarUrl = await uploadAvatar.mutateAsync({
          userId: profile.id,
          file: avatarFile,
        });
      }

      // 2. Update user profile
      await updateProfile.mutateAsync({
        userId: profile.id,
        fullName: editName.trim() || (profile.full_name ?? ""),
        avatarUrl: newAvatarUrl !== undefined ? newAvatarUrl : profile.avatar_url,
        mobileNumber: editMobile.trim() || null,
      });

      // 3. Update seeker home location if changed
      if (locationChanged && editLocation) {
        await updateSeekerLocation.mutateAsync({
          userId: profile.id,
          ...editLocation,
        });
      }

      // 4. Update provider profile
      if (providerProfile) {
        await updateProviderProf.mutateAsync({
          providerId: providerProfile.id,
          businessName: editBusinessName.trim() || undefined,
          providerType: editProviderType ?? undefined,
          bio: editBio,
          experienceYears: editExperience
            ? parseInt(editExperience, 10)
            : null,
          qualifications: editQualifications.trim() || null,
          whatsappNumber: editWhatsapp.trim() || null,
        });

        // 5. Update provider home base location if changed and valid
        if (
          providerLocationChanged &&
          providerHomeLocation &&
          providerHomeLocation.lat !== 0
        ) {
          await updateProviderLocation.mutateAsync({
            providerId: providerProfile.id,
            ...providerHomeLocation,
          });
        }
      }

      toast.success("Profile updated!");
      setEditOpen(false);
    } catch (err) {
      console.error("[EditProfile] save:", err);
      toast.error("Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Logout ───────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
    toast.success("Logged out");
  };

  // ── Derived ──────────────────────────────────────────────────────────────
  const initials =
    profile?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) ?? "";

  const isSeekerView = activePersona === "seeker";

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      className={`${isSeekerView ? "seeker-theme" : ""} flex min-h-screen flex-col bg-background pb-20`}
    >
      {/* ── Identity header ─────────────────────────────────────────────── */}
      {isSeekerView ? (
        <div
          className="px-4 pt-14 pb-6"
          style={{
            background:
              "linear-gradient(160deg, oklch(0.78 0.18 250) 0%, oklch(0.62 0.20 250) 100%)",
          }}
        >
          <div className="flex items-center gap-4">
            <Avatar
              className="border-4 border-white/30 shadow-xl flex-shrink-0"
              style={{ height: 72, width: 72 }}
            >
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback
                className="text-xl"
                style={{
                  background: "rgba(255,255,255,0.25)",
                  color: "white",
                }}
              >
                {initials || <User size={28} />}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h2 className="text-xl font-bold text-white truncate">
                {profile?.full_name}
              </h2>
              <p className="text-white/70 text-sm truncate">
                {profile?.email ?? profile?.mobile_number}
              </p>
              {familyMembers.length > 0 && (
                <p className="text-white/60 text-xs mt-0.5">
                  {familyMembers.length} family member
                  {familyMembers.length > 1 ? "s" : ""}
                </p>
              )}
            </div>
            {/* Edit button */}
            <button
              onClick={openEdit}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/30 transition-colors flex-shrink-0"
              aria-label="Edit profile"
            >
              <Pencil size={14} className="text-white" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <Header />
          <div className="mx-auto w-full max-w-lg px-4 pt-4 flex flex-col items-center gap-3">
            <div className="relative">
              <Avatar className="h-20 w-20 border-2 border-border">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="text-lg bg-muted">
                  {initials || <User size={28} />}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="text-center">
              <h2 className="text-lg font-bold">{profile?.full_name}</h2>
              <p className="text-sm text-muted-foreground">{profile?.email}</p>
            </div>
          </div>
        </>
      )}

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        {/* ── Family chips (seeker view) ─────────────────────────────── */}
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
                <div
                  key={member.id}
                  className="flex flex-col items-center gap-1 flex-shrink-0 w-14"
                >
                  <Avatar className="h-10 w-10 border-2 border-primary/20">
                    <AvatarFallback
                      className="text-xs"
                      style={{
                        backgroundColor: "oklch(0.88 0.10 250)",
                        color: "oklch(0.38 0.16 250)",
                      }}
                    >
                      {(member.full_name ?? "")[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <p className="text-[10px] font-medium text-center leading-tight truncate w-full">
                    {member.full_name?.split(" ")[0]}
                  </p>
                  {member.relationship && (
                    <p className="text-[9px] text-muted-foreground text-center capitalize">
                      {member.relationship}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* ── Family list (provider/admin view) ─────────────────────── */}
        {!isSeekerView && familyMembers.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Users size={16} className="text-primary" />
                Family Members
              </h3>
              <span className="text-xs text-muted-foreground">
                {familyMembers.length} member
                {familyMembers.length > 1 ? "s" : ""}
              </span>
            </div>
            <div className="space-y-2">
              {familyMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-3 rounded-lg bg-muted/50 p-2.5"
                >
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

        {/* ── Help & Feedback ──────────────────────────────────────── */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <HelpCircle size={15} className="text-primary" />
              Help &amp; Feedback
            </h3>
            <button
              onClick={() => setSupportOpen(true)}
              className="text-xs font-semibold text-primary"
            >
              Raise a request
            </button>
          </div>
          <p className="text-xs text-muted-foreground -mt-1">
            Send us a support request or share a recommendation. Our team will
            get back to you.
          </p>
          <SupportRequestList userId={profile?.id} />
        </Card>

        {/* ── Account section ───────────────────────────────────────── */}
        <Card className="p-0 overflow-hidden">
          <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
            Account
          </p>

          {/* Edit Profile */}
          <button
            onClick={openEdit}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent border-t border-border/50"
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={
                isSeekerView
                  ? { backgroundColor: "oklch(0.94 0.04 250)" }
                  : { backgroundColor: "hsl(var(--primary)/0.1)" }
              }
            >
              <Pencil size={17} className="text-primary" />
            </div>
            <span className="flex-1 text-sm font-medium">Edit Profile</span>
            <ChevronRight size={16} className="text-muted-foreground" />
          </button>

          {family && (
            <button
              onClick={() => navigate("/family")}
              className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent border-t border-border/50"
            >
              <div
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={
                  isSeekerView
                    ? { backgroundColor: "oklch(0.94 0.04 250)" }
                    : { backgroundColor: "hsl(var(--primary)/0.1)" }
                }
              >
                <Link2 size={17} className="text-primary" />
              </div>
              <div className="flex-1">
                <span className="text-sm font-medium">Manage Family</span>
                {familyRole && (
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {familyRole} account
                  </p>
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
              <span className="flex-1 text-sm font-medium">
                Become an Instructor
              </span>
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
                <p className="text-[10px] text-muted-foreground">
                  Manage categories, providers &amp; analytics
                </p>
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
            <span className="flex-1 text-sm font-medium text-destructive">
              Log Out
            </span>
          </button>
        </Card>
      </div>

      {/* ── Edit Profile Sheet ───────────────────────────────────────────── */}
      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent
          side="bottom"
          className="h-[94vh] rounded-t-2xl p-0 flex flex-col"
        >
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-border/50 flex-shrink-0">
            <SheetTitle className="text-left">Edit Profile</SheetTitle>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-5 space-y-6">

              {/* ── Profile Photo ──────────────────────────────────────── */}
              <div className="flex flex-col items-center gap-2">
                <div className="relative">
                  <Avatar className="h-20 w-20 border-2 border-border shadow-sm">
                    <AvatarImage
                      src={
                        avatarPreview ?? profile?.avatar_url ?? undefined
                      }
                    />
                    <AvatarFallback className="text-lg bg-muted">
                      {initials || <User size={28} />}
                    </AvatarFallback>
                  </Avatar>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-colors"
                    aria-label="Change profile photo"
                  >
                    <Camera size={13} />
                  </button>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <p className="text-xs text-muted-foreground">
                  Tap camera icon to change photo
                </p>
              </div>

              {/* ── Personal Info ──────────────────────────────────────── */}
              <div className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Personal Info
                </p>
                <div className="space-y-1.5">
                  <Label htmlFor="ep-name" className="text-sm">
                    Full Name
                  </Label>
                  <Input
                    id="ep-name"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Your full name"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ep-mobile" className="text-sm">
                    Mobile Number
                  </Label>
                  <Input
                    id="ep-mobile"
                    value={editMobile}
                    onChange={(e) => setEditMobile(e.target.value)}
                    type="tel"
                    placeholder="+91 XXXXX XXXXX"
                    className="h-11 rounded-xl"
                  />
                </div>
                {profile?.email && (
                  <div className="space-y-1.5">
                    <Label className="text-sm text-muted-foreground">
                      Email
                    </Label>
                    <div className="flex h-11 items-center rounded-xl border border-border/50 bg-muted/40 px-3 text-sm text-muted-foreground select-none">
                      {profile.email}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Email address cannot be changed here.
                    </p>
                  </div>
                )}
              </div>

              <Separator />

              {/* ── Home Location ──────────────────────────────────────── */}
              <div className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Home Location
                </p>
                <p className="text-xs text-muted-foreground -mt-1">
                  We use this to show you nearby classes.
                </p>
                <MapplsPicker
                  value={editLocation}
                  onChange={(val) => {
                    setEditLocation(val);
                    setLocationChanged(true);
                  }}
                  placeholder="Search for your home address"
                />
              </div>

              {/* ── Instructor Details ───────────────────────────────────── */}
              {profile?.is_provider && providerProfile && (
                <>
                  <Separator />
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Instructor Details
                      </p>
                      {loadingExtra && (
                        <Loader2
                          size={13}
                          className="animate-spin text-muted-foreground"
                        />
                      )}
                    </div>

                    {/* Provider Type */}
                    <div className="space-y-1.5">
                      <Label className="text-sm">Instructor Type</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["individual", "academy"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setEditProviderType(t)}
                            className={`flex items-center justify-center gap-2 h-11 rounded-xl border text-sm font-medium transition-all ${
                              editProviderType === t
                                ? "border-provider bg-provider/5 text-provider"
                                : "border-border text-muted-foreground hover:border-muted-foreground/40"
                            }`}
                          >
                            {t === "individual" ? (
                              <User size={15} />
                            ) : (
                              <Users size={15} />
                            )}
                            {t === "individual" ? "Individual" : "Academy"}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Business Name */}
                    <div className="space-y-1.5">
                      <Label htmlFor="ep-bname" className="text-sm">
                        Business / Display Name
                      </Label>
                      <Input
                        id="ep-bname"
                        value={editBusinessName}
                        onChange={(e) => setEditBusinessName(e.target.value)}
                        placeholder="e.g. Coach Rahul or Star Academy"
                        className="h-11 rounded-xl"
                      />
                    </div>

                    {/* Bio */}
                    <div className="space-y-1.5">
                      <Label htmlFor="ep-bio" className="text-sm">
                        Bio
                      </Label>
                      <Textarea
                        id="ep-bio"
                        value={editBio}
                        onChange={(e) => setEditBio(e.target.value)}
                        rows={3}
                        placeholder="Tell learners about yourself and your teaching style…"
                        maxLength={500}
                        className="rounded-xl resize-none"
                      />
                      <p className="text-[10px] text-muted-foreground text-right">
                        {editBio.length}/500
                      </p>
                    </div>

                    {/* Experience + WhatsApp */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label htmlFor="ep-exp" className="text-sm">
                          Experience (yrs)
                        </Label>
                        <Input
                          id="ep-exp"
                          value={editExperience}
                          onChange={(e) =>
                            setEditExperience(
                              e.target.value.replace(/\D/g, ""),
                            )
                          }
                          type="number"
                          min={0}
                          max={60}
                          placeholder="e.g. 5"
                          className="h-11 rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="ep-wa" className="text-sm">
                          WhatsApp No.
                        </Label>
                        <Input
                          id="ep-wa"
                          value={editWhatsapp}
                          onChange={(e) => setEditWhatsapp(e.target.value)}
                          type="tel"
                          placeholder="+91 XXXXX XXXXX"
                          className="h-11 rounded-xl"
                        />
                      </div>
                    </div>

                    {/* Qualifications */}
                    <div className="space-y-1.5">
                      <Label htmlFor="ep-qual" className="text-sm">
                        Qualifications / Certifications
                      </Label>
                      <Input
                        id="ep-qual"
                        value={editQualifications}
                        onChange={(e) =>
                          setEditQualifications(e.target.value)
                        }
                        placeholder="e.g. B.Ed, AIFF Level-1 Coach"
                        className="h-11 rounded-xl"
                      />
                    </div>

                    {/* Provider Home Base */}
                    <div className="space-y-2">
                      <Label className="text-sm">Home Base Location</Label>
                      <p className="text-xs text-muted-foreground">
                        Used as the address for your home-based classes.
                      </p>
                      {providerProfile.home_address &&
                        !providerLocationChanged && (
                          <div className="flex items-start gap-2.5 rounded-xl bg-muted/50 px-3 py-2.5">
                            <MapPin
                              size={13}
                              className="mt-0.5 text-muted-foreground flex-shrink-0"
                            />
                            <div>
                              <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                                Current
                              </p>
                              <p className="text-sm">
                                {providerProfile.home_address}
                              </p>
                            </div>
                          </div>
                        )}
                      <MapplsPicker
                        value={providerHomeLocation}
                        onChange={(val) => {
                          setProviderHomeLocation(val);
                          setProviderLocationChanged(true);
                        }}
                        showMap={false}
                        placeholder="Search for your home base address"
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <SheetFooter className="px-4 py-4 border-t border-border/50 flex-shrink-0">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full h-12 rounded-xl gradient-primary text-primary-foreground font-semibold"
            >
              {saving ? (
                <>
                  <Loader2 size={16} className="mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save Changes"
              )}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* ── Support Request Sheet ────────────────────────────────────────── */}
      <SupportRequestSheet open={supportOpen} onOpenChange={setSupportOpen} />

    </div>
  );
};

export default Profile;
