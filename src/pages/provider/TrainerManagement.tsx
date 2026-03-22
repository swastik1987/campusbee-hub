import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useTrainers, useCreateTrainer, useDeleteTrainer, useUploadProviderMedia } from "@/hooks/useProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ArrowLeft, Camera, Loader2, Plus, Trash2, UserCircle, Users } from "lucide-react";
import { toast } from "sonner";

const TrainerManagement = () => {
  const navigate = useNavigate();
  const { providerProfile, profile } = useUser();
  const { data: trainers, isLoading } = useTrainers(providerProfile?.id);
  const createTrainer = useCreateTrainer();
  const deleteTrainer = useDeleteTrainer();
  const uploadMedia = useUploadProviderMedia();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [experience, setExperience] = useState("");
  const [specInput, setSpecInput] = useState("");
  const [specs, setSpecs] = useState<string[]>([]);
  const [photoUrl, setPhotoUrl] = useState("");

  const handleAddSpec = () => {
    if (specInput.trim() && !specs.includes(specInput.trim())) {
      setSpecs((p) => [...p, specInput.trim()]);
      setSpecInput("");
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    try {
      const url = await uploadMedia.mutateAsync({ userId: profile.id, file, folder: "trainers" });
      setPhotoUrl(url);
    } catch {
      toast.error("Upload failed");
    }
  };

  const handleCreate = async () => {
    if (!name.trim() || !providerProfile) return;
    try {
      await createTrainer.mutateAsync({
        providerId: providerProfile.id,
        name: name.trim(),
        bio,
        qualifications,
        experienceYears: experience ? parseInt(experience) : null,
        specializations: specs,
        photoUrl,
      });
      toast.success("Trainer added");
      setName(""); setBio(""); setQualifications(""); setExperience(""); setSpecs([]); setPhotoUrl("");
      setSheetOpen(false);
    } catch {
      toast.error("Failed to add trainer");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTrainer.mutateAsync(id);
      toast.success("Trainer removed");
    } catch {
      toast.error("Failed to remove trainer");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-bold">Manage Team</h1>
      </header>

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="animate-spin text-muted-foreground" /></div>
        ) : trainers && trainers.length > 0 ? (
          trainers.map((t) => (
            <Card key={t.id} className="flex items-center gap-3 p-4">
              <Avatar className="h-12 w-12">
                <AvatarImage src={t.photo_url ?? undefined} />
                <AvatarFallback className="bg-provider/10 text-provider">{t.name[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <p className="font-semibold text-sm">{t.name}</p>
                {t.experience_years && <p className="text-xs text-muted-foreground">{t.experience_years} years exp.</p>}
                {t.specializations && t.specializations.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {t.specializations.slice(0, 3).map((s) => (
                      <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => handleDelete(t.id)} className="p-1 text-muted-foreground hover:text-destructive">
                <Trash2 size={16} />
              </button>
            </Card>
          ))
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Users size={28} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No trainers added yet</p>
          </div>
        )}

        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button className="w-full bg-provider hover:bg-provider/90 text-white rounded-xl">
              <Plus size={16} className="mr-1" /> Add Trainer
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
            <SheetHeader><SheetTitle>Add Trainer</SheetTitle></SheetHeader>
            <div className="space-y-3 py-4">
              <div className="flex justify-center">
                <label className="relative cursor-pointer">
                  <Avatar className="h-16 w-16 border-2 border-dashed">
                    <AvatarImage src={photoUrl} />
                    <AvatarFallback><Camera size={20} className="text-muted-foreground" /></AvatarFallback>
                  </Avatar>
                  <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                </label>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} className="h-10 rounded-lg" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Bio</Label>
                <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} className="rounded-lg" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Qualifications</Label>
                <Input value={qualifications} onChange={(e) => setQualifications(e.target.value)} className="h-10 rounded-lg" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Experience (years)</Label>
                <Input type="number" value={experience} onChange={(e) => setExperience(e.target.value)} className="h-10 rounded-lg" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Specializations</Label>
                <div className="flex gap-2">
                  <Input
                    value={specInput}
                    onChange={(e) => setSpecInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddSpec())}
                    placeholder="Type and press Enter"
                    className="h-10 rounded-lg"
                  />
                  <Button type="button" size="sm" variant="outline" onClick={handleAddSpec}>Add</Button>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {specs.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs cursor-pointer" onClick={() => setSpecs((p) => p.filter((x) => x !== s))}>
                      {s} ×
                    </Badge>
                  ))}
                </div>
              </div>
              <Button onClick={handleCreate} disabled={!name.trim() || createTrainer.isPending} className="w-full bg-provider text-white rounded-lg">
                {createTrainer.isPending ? <Loader2 size={16} className="animate-spin" /> : "Add Trainer"}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};

export default TrainerManagement;
