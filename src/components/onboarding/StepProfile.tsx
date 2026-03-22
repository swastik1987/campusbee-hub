import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useUser } from "@/contexts/UserContext";
import { useUpdateProfile, useUploadAvatar } from "@/hooks/useOnboarding";
import { Camera, Loader2, User } from "lucide-react";
import { toast } from "sonner";

interface StepProfileProps {
  onNext: () => void;
}

const StepProfile = ({ onNext }: StepProfileProps) => {
  const { profile } = useUser();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const updateProfile = useUpdateProfile();
  const uploadAvatar = useUploadAvatar();

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;

    setUploading(true);
    try {
      const url = await uploadAvatar.mutateAsync({ userId: profile.id, file });
      setAvatarUrl(url);
    } catch {
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !profile) return;

    try {
      await updateProfile.mutateAsync({
        userId: profile.id,
        fullName: fullName.trim(),
        avatarUrl: avatarUrl || null,
      });
      onNext();
    } catch {
      toast.error("Failed to save profile");
    }
  };

  const initials = fullName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 animate-fade-up">
      <div>
        <h2 className="text-xl font-bold text-foreground">Tell us about yourself</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Let's set up your profile
        </p>
      </div>

      {/* Avatar */}
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <Avatar className="h-24 w-24 border-2 border-border">
            <AvatarImage src={avatarUrl} />
            <AvatarFallback className="text-xl bg-muted">
              {initials || <User size={32} className="text-muted-foreground" />}
            </AvatarFallback>
          </Avatar>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md"
          >
            {uploading ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Camera size={14} />
            )}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAvatarChange}
        />
        <p className="text-xs text-muted-foreground">Tap to add a photo</p>
      </div>

      {/* Name */}
      <div className="space-y-2">
        <Label htmlFor="fullName">Full Name</Label>
        <Input
          id="fullName"
          placeholder="Enter your full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="h-12 rounded-xl"
          required
          autoFocus
        />
      </div>

      <Button
        type="submit"
        disabled={!fullName.trim() || updateProfile.isPending}
        className="w-full gradient-primary text-primary-foreground h-12 font-semibold rounded-xl"
      >
        {updateProfile.isPending ? (
          <Loader2 size={20} className="animate-spin" />
        ) : (
          "Continue"
        )}
      </Button>
    </form>
  );
};

export default StepProfile;
