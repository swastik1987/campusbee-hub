import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useCreateProvider, useUploadProviderMedia } from "@/hooks/useProvider";
import { supabase } from "@/integrations/supabase/client";
import { useCategories } from "@/hooks/useClasses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Building2,
  Camera,
  Check,
  ChevronLeft,
  GraduationCap,
  Loader2,
  User,
  Users,
} from "lucide-react";
import { toast } from "sonner";

const STEPS = ["Type", "Profile", "Payment", "Apartments"];

const BecomeProvider = () => {
  const navigate = useNavigate();
  const { profile, family, providerProfile, refreshProfile } = useUser();
  const [step, setStep] = useState(0);
  const [prefilled, setPrefilled] = useState(false);

  // Step 1 state
  const [providerType, setProviderType] = useState<"individual" | "academy" | "">("");

  // Step 2 state
  const [businessName, setBusinessName] = useState("");
  const [bio, setBio] = useState("");
  const [experience, setExperience] = useState("");
  const [qualifications, setQualifications] = useState("");
  const [specializations, setSpecializations] = useState<string[]>([]);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [introVideoUrl, setIntroVideoUrl] = useState("");

  // Step 3 state
  const [upiId, setUpiId] = useState("");
  const [upiQrUrl, setUpiQrUrl] = useState("");
  const [whatsappNumber, setWhatsappNumber] = useState(profile?.mobile_number ?? "");

  // Step 4 state
  const [selectedApartments, setSelectedApartments] = useState<string[]>(
    family?.apartment_id ? [family.apartment_id] : []
  );
  const [availableApartments, setAvailableApartments] = useState<
    { id: string; name: string; locality: string; city: string }[]
  >([]);

  // Pre-fill from existing provider profile (re-application after rejection)
  useEffect(() => {
    if (prefilled || !profile) return;
    const loadExisting = async () => {
      const { data: sp } = await supabase
        .from("service_providers")
        .select("id, provider_type, business_name, bio, experience_years, qualifications, specializations, specialization_category_ids, intro_video_url, whatsapp_number, upi_id, upi_qr_image_url")
        .eq("user_id", profile.id)
        .maybeSingle();
      if (sp) {
        setProviderType((sp.provider_type as "individual" | "academy") || "");
        setBusinessName(sp.business_name || "");
        setBio(sp.bio || "");
        setExperience(sp.experience_years ? String(sp.experience_years) : "");
        setQualifications(sp.qualifications || "");
        setSpecializations((sp.specializations as string[]) || []);
        setSelectedCategoryIds((sp.specialization_category_ids as string[]) || []);
        setIntroVideoUrl(sp.intro_video_url || "");
        setWhatsappNumber(sp.whatsapp_number || profile.mobile_number || "");
        setUpiId(sp.upi_id || "");
        setUpiQrUrl(sp.upi_qr_image_url || "");

        // Load previously registered apartments for re-apply
        const { data: regs } = await supabase
          .from("provider_apartment_registrations")
          .select("apartment_id, status, apartment_complexes:apartment_complexes(id, name, locality, city)")
          .eq("provider_id", sp.id);
        if (regs && regs.length > 0) {
          const apartments = regs
            .map((r) => {
              const apt = r.apartment_complexes as any;
              return apt ? { id: apt.id, name: apt.name, locality: apt.locality, city: apt.city } : null;
            })
            .filter(Boolean) as { id: string; name: string; locality: string; city: string }[];
          setAvailableApartments(apartments);
          // Pre-select all previously registered apartments
          setSelectedApartments(apartments.map((a) => a.id));
        }
      }
      setPrefilled(true);
    };
    loadExisting();
  }, [profile, prefilled]);

  const createProvider = useCreateProvider();
  const uploadMedia = useUploadProviderMedia();
  const { data: allCategories } = useCategories();

  const parentCategories = allCategories?.filter((c) => !c.parent_category_id) ?? [];
  const subCategories = allCategories?.filter((c) => c.parent_category_id) ?? [];

  const toggleCategoryId = (catId: string, catName: string) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((id) => id !== catId) : [...prev, catId]
    );
    setSpecializations((prev) =>
      prev.includes(catName) ? prev.filter((s) => s !== catName) : [...prev, catName]
    );
  };

  const handleQrUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    try {
      const url = await uploadMedia.mutateAsync({ userId: profile.id, file, folder: "upi-qr" });
      setUpiQrUrl(url);
      toast.success("QR uploaded");
    } catch {
      toast.error("Upload failed");
    }
  };

  const handleSubmit = async () => {
    if (!profile || !providerType) return;
    try {
      await createProvider.mutateAsync({
        userId: profile.id,
        providerType,
        businessName,
        bio,
        experienceYears: experience ? parseInt(experience) : null,
        qualifications,
        specializations,
        specializationCategoryIds: selectedCategoryIds,
        introVideoUrl,
        whatsappNumber,
        upiId,
        upiQrImageUrl: upiQrUrl,
        apartmentIds: selectedApartments,
      });
      toast.success("Application submitted! The apartment admin will review your request.");
      await refreshProfile();
      navigate("/provider/dashboard", { replace: true });
    } catch {
      toast.error("Failed to submit application");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => (step > 0 ? setStep(step - 1) : navigate(-1))} className="p-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">Become a Provider</h1>
      </header>

      {/* Progress */}
      <div className="px-6 pt-4 pb-2">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Step {step + 1} of {STEPS.length}</span>
          <span className="font-semibold text-provider">{STEPS[step]}</span>
        </div>
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-provider" : "bg-muted"}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 px-6 py-4">
        {/* Step 1: Provider Type */}
        {step === 0 && (
          <div className="space-y-6 animate-fade-up">
            <div>
              <h2 className="text-xl font-bold">How will you teach?</h2>
              <p className="mt-1 text-sm text-muted-foreground">Select your provider type</p>
            </div>
            <div className="space-y-3">
              <Card
                className={`cursor-pointer p-5 transition-all ${providerType === "individual" ? "border-provider bg-provider/5" : "hover:border-provider/50"}`}
                onClick={() => setProviderType("individual")}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-provider/10">
                    <User size={24} className="text-provider" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Individual Instructor</p>
                    <p className="mt-1 text-sm text-muted-foreground">I teach classes myself</p>
                  </div>
                  {providerType === "individual" && <Check size={20} className="text-provider mt-1" />}
                </div>
              </Card>
              <Card
                className={`cursor-pointer p-5 transition-all ${providerType === "academy" ? "border-provider bg-provider/5" : "hover:border-provider/50"}`}
                onClick={() => setProviderType("academy")}
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-provider/10">
                    <Users size={24} className="text-provider" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold">Academy / Institute</p>
                    <p className="mt-1 text-sm text-muted-foreground">I run an organization with multiple trainers</p>
                  </div>
                  {providerType === "academy" && <Check size={20} className="text-provider mt-1" />}
                </div>
              </Card>
            </div>
            <Button
              disabled={!providerType}
              onClick={() => setStep(1)}
              className="w-full h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl"
            >
              Continue
            </Button>
          </div>
        )}

        {/* Step 2: Profile Details */}
        {step === 1 && (
          <div className="space-y-5 animate-fade-up">
            <h2 className="text-xl font-bold">Profile Details</h2>
            <div className="space-y-2">
              <Label>Business / Display Name</Label>
              <Input value={businessName} onChange={(e) => setBusinessName(e.target.value)} placeholder="e.g. Ace Badminton Academy" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Bio <span className="text-xs text-muted-foreground">({bio.length}/500)</span></Label>
              <Textarea value={bio} onChange={(e) => setBio(e.target.value.slice(0, 500))} placeholder="Tell parents about yourself..." rows={3} className="rounded-xl" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Experience (years)</Label>
                <Select value={experience} onValueChange={setExperience}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 30 }, (_, i) => i + 1).map((y) => (
                      <SelectItem key={y} value={String(y)}>{y} year{y > 1 ? "s" : ""}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Intro Video URL</Label>
                <Input value={introVideoUrl} onChange={(e) => setIntroVideoUrl(e.target.value)} placeholder="YouTube link" className="h-11 rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Qualifications</Label>
              <Textarea value={qualifications} onChange={(e) => setQualifications(e.target.value)} placeholder="Certifications, degrees..." rows={2} className="rounded-xl" />
            </div>
            <div className="space-y-3">
              <Label>What will you teach? (select sub-categories)</Label>
              {parentCategories.map((parent) => {
                const children = subCategories.filter((c) => c.parent_category_id === parent.id);
                if (children.length === 0) return null;
                return (
                  <div key={parent.id} className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{parent.name}</p>
                    <div className="flex flex-wrap gap-2">
                      {children.map((cat) => (
                        <Badge
                          key={cat.id}
                          variant={selectedCategoryIds.includes(cat.id) ? "default" : "outline"}
                          className={`cursor-pointer transition-all ${selectedCategoryIds.includes(cat.id) ? "bg-provider hover:bg-provider/90" : "hover:border-provider"}`}
                          onClick={() => toggleCategoryId(cat.id, cat.name)}
                        >
                          {cat.name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
            {selectedCategoryIds.length === 0 && (
              <p className="text-xs text-destructive">Please select at least one sub-category to continue.</p>
            )}
            <Button disabled={selectedCategoryIds.length === 0} onClick={() => setStep(2)} className="w-full h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl">
              Continue
            </Button>
          </div>
        )}

        {/* Step 3: Payment Details */}
        {step === 2 && (
          <div className="space-y-5 animate-fade-up">
            <h2 className="text-xl font-bold">Payment Details</h2>
            <p className="text-sm text-muted-foreground">Parents will pay you directly via UPI. Add your details so they can find you.</p>
            <div className="space-y-2">
              <Label>UPI ID</Label>
              <Input value={upiId} onChange={(e) => setUpiId(e.target.value)} placeholder="yourname@upi" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>UPI QR Code</Label>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors hover:border-provider">
                {upiQrUrl ? (
                  <img src={upiQrUrl} alt="UPI QR" className="h-32 w-32 object-contain rounded" />
                ) : (
                  <>
                    <Camera size={24} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Upload QR code image</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleQrUpload} />
              </label>
            </div>
            <div className="space-y-2">
              <Label>WhatsApp Number</Label>
              <Input value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} placeholder="+91 98765 43210" className="h-11 rounded-xl" />
            </div>
            <Button onClick={() => setStep(3)} className="w-full h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl">
              Continue
            </Button>
          </div>
        )}

        {/* Step 4: Select Apartments */}
        {step === 3 && (
          <div className="space-y-5 animate-fade-up">
            <h2 className="text-xl font-bold">Select Apartments</h2>
            <p className="text-sm text-muted-foreground">Choose where you want to teach. Apartment admins will review your application.</p>
            {family && !availableApartments.find((a) => a.id === family.apartment_id) && (
              <Card className="p-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedApartments.includes(family.apartment_id)}
                    onCheckedChange={(checked) => {
                      setSelectedApartments((prev) =>
                        checked ? [...prev, family.apartment_id] : prev.filter((id) => id !== family.apartment_id)
                      );
                    }}
                  />
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-provider/10">
                    <Building2 size={18} className="text-provider" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">Your apartment</p>
                    <p className="text-xs text-muted-foreground">Where you live</p>
                  </div>
                </div>
              </Card>
            )}
            {availableApartments.map((apt) => (
              <Card key={apt.id} className="p-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedApartments.includes(apt.id)}
                    onCheckedChange={(checked) => {
                      setSelectedApartments((prev) =>
                        checked ? [...prev, apt.id] : prev.filter((id) => id !== apt.id)
                      );
                    }}
                  />
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-provider/10">
                    <Building2 size={18} className="text-provider" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{apt.name}</p>
                    <p className="text-xs text-muted-foreground">{apt.locality}, {apt.city}</p>
                  </div>
                </div>
              </Card>
            ))}
            <Button
              onClick={handleSubmit}
              disabled={selectedApartments.length === 0 || createProvider.isPending}
              className="w-full h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl"
            >
              {createProvider.isPending ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  <GraduationCap size={18} className="mr-2" />
                  Submit Application
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BecomeProvider;
