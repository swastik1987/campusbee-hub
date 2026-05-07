import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useTrainers } from "@/hooks/useProvider";
import { useCategories, useCreateClass, useCreateBatch, useUploadClassImage } from "@/hooks/useClasses";
import { moderateClassPublish } from "@/lib/moderation";
import { supabase } from "@/integrations/supabase/client";
import ClassLocationPicker from "@/components/location/ClassLocationPicker";
import CategoryRequestSheet from "@/components/provider/CategoryRequestSheet";
import type { LocationValue } from "@/hooks/useLocation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Camera,
  Clock,
  ImagePlus,
  Loader2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

const STEPS = ["Category", "Details", "Media", "Trial", "Batch", "Review"];
const SKILL_LEVELS = ["beginner", "intermediate", "advanced", "all_levels"];
const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];
const FEE_FREQUENCIES = [
  { value: "monthly",      label: "Monthly"      },
  { value: "per_session",  label: "Per Session"  },
  { value: "quarterly",    label: "Quarterly"    },
  { value: "for_duration", label: "For Duration" },
  { value: "one_time",     label: "One Time"     },
];

/** 30-min time slots from 5:00 AM to 10:30 PM */
const TIME_OPTIONS = Array.from({ length: 36 }, (_, i) => {
  const totalMinutes = 5 * 60 + i * 30;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  const period = hours < 12 ? "AM" : "PM";
  const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
  const value = `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  const label = `${displayHours}:${String(mins).padStart(2, "0")} ${period}`;
  return { value, label };
});

/** Red asterisk for required fields */
const Req = () => <span className="text-red-500 ml-0.5">*</span>;
/** Grey "(optional)" tag for non-required fields */
const Opt = () => <span className="text-muted-foreground text-xs font-normal ml-1">(optional)</span>;

const CreateClass = () => {
  const navigate = useNavigate();
  const { profile, providerProfile } = useUser();
  const [step, setStep] = useState(0);

  // ── Step 0: Category ─────────────────────────────────────────────────
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedParent, setSelectedParent] = useState("");
  const [showCatRequestSheet, setShowCatRequestSheet] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [pendingCategoryName, setPendingCategoryName] = useState("");

  // ── Step 1: Details ───────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [description, setDescription] = useState("");
  const [classType, setClassType] = useState("recurring");
  const [skillLevels, setSkillLevels] = useState<string[]>([]);
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [venue, setVenue] = useState("");
  const [whatToBring, setWhatToBring] = useState("");
  const [isHomeBased, setIsHomeBased] = useState(false);
  const [classLocation, setClassLocation] = useState<LocationValue | null>(null);
  const [homeRadiusKm, setHomeRadiusKm] = useState(5);

  // ── Step 2: Media ─────────────────────────────────────────────────────
  const [coverUrl, setCoverUrl] = useState("");
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [promoUrl, setPromoUrl] = useState("");

  // ── Step 3: Trial ─────────────────────────────────────────────────────
  const [trialAvailable, setTrialAvailable] = useState(false);
  const [trialFee, setTrialFee] = useState("0");

  // ── Step 4: Batch ─────────────────────────────────────────────────────
  const [batchName, setBatchName] = useState("");
  const [batchType, setBatchType] = useState("custom");
  const [batchSkillLevel, setBatchSkillLevel] = useState("");
  const [batchAgeMin, setBatchAgeMin] = useState("");
  const [batchAgeMax, setBatchAgeMax] = useState("");
  const [batchTrainerId, setBatchTrainerId] = useState("");
  const [maxBatchSize, setMaxBatchSize] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [feeFrequency, setFeeFrequency] = useState("monthly");
  const [registrationFee, setRegistrationFee] = useState("");
  const [batchStartDate, setBatchStartDate] = useState("");
  const [batchEndDate, setBatchEndDate] = useState("");
  const [batchTotalSessions, setBatchTotalSessions] = useState("");
  const [registrationMode, setRegistrationMode] = useState("auto");
  const [autoWaitlist, setAutoWaitlist] = useState(true);
  // Schedule — chip-style day toggles + single shared time
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [batchStartTime, setBatchStartTime] = useState("06:00");
  const [batchEndTime, setBatchEndTime] = useState("07:00");

  const [isPublishing, setIsPublishing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const isAcademy = providerProfile?.provider_type === "academy";
  const { data: allCategories } = useCategories();
  const { data: trainers } = useTrainers(providerProfile?.id);
  const createClass = useCreateClass();
  const createBatch = useCreateBatch();
  const uploadImage = useUploadClassImage();

  const specializationIds = providerProfile?.specialization_category_ids ?? [];

  const filteredSubCategories = useMemo(() => {
    if (!allCategories) return [];
    const subs = allCategories.filter((c) => c.parent_id);
    if (specializationIds.length === 0) return subs;
    return subs.filter((c) => specializationIds.includes(c.id));
  }, [allCategories, specializationIds]);

  const filteredParentCategories = useMemo(() => {
    if (!allCategories) return [];
    const parents = allCategories.filter((c) => !c.parent_id);
    if (specializationIds.length === 0) return parents;
    const parentIdsWithChildren = new Set(filteredSubCategories.map((c) => c.parent_id));
    return parents.filter((p) => parentIdsWithChildren.has(p.id));
  }, [allCategories, filteredSubCategories, specializationIds]);

  const toggleSkill = (s: string) =>
    setSkillLevels((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  const toggleDay = (day: number) =>
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage.mutateAsync({ classId: "new-" + Date.now(), file, folder: "cover" });
      setCoverUrl(url);
    } catch { toast.error("Upload failed"); }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files.slice(0, 5 - galleryUrls.length)) {
      try {
        const url = await uploadImage.mutateAsync({ classId: "new-" + Date.now(), file, folder: "gallery" });
        setGalleryUrls((p) => [...p, url]);
      } catch { toast.error("Upload failed"); }
    }
  };

  const selectedSchedules = selectedDays.map((d) => ({
    dayOfWeek: d,
    startTime: batchStartTime,
    endTime: batchEndTime,
  }));

  const batchValid = !!(batchName.trim() && maxBatchSize && feeAmount && selectedDays.length > 0);

  const handleSave = async (publish: boolean) => {
    const hasCategoryChoice = !!selectedCategoryId || !!pendingRequestId;
    if (!hasCategoryChoice || !title.trim() || !providerProfile || !profile) return;

    const effectivePublish = pendingRequestId ? false : publish;

    setIsPublishing(true);
    try {
      // 1. Create class as draft
      const result = await createClass.mutateAsync({
        providerId: providerProfile.id,
        categoryId: selectedCategoryId || null,
        pendingCategoryRequestId: pendingRequestId ?? null,
        title: title.trim(),
        description,
        shortDescription: shortDesc,
        classType,
        skillLevel: skillLevels,
        ageGroupMin: ageMin ? parseInt(ageMin) : null,
        ageGroupMax: ageMax ? parseInt(ageMax) : null,
        venueDetails: venue,
        whatToBring,
        coverImageUrl: coverUrl,
        galleryUrls,
        promoVideoUrl: promoUrl,
        trialAvailable,
        trialFee: parseFloat(trialFee) || 0,
        status: "draft",
        address: classLocation?.address ?? undefined,
        isHomeBased,
        locationLat: classLocation?.lat ?? null,
        locationLng: classLocation?.lng ?? null,
        homeRadiusKm: isHomeBased ? homeRadiusKm : 5,
      });

      // 2. Create batch + schedules (separate try so batch errors don't swallow the class)
      if (batchValid && result?.id) {
        try {
          await createBatch.mutateAsync({
            classId: result.id,
            trainerId: batchTrainerId || null,
            batchName: batchName.trim(),
            batchType,
            skillLevel: batchSkillLevel || (skillLevels.length === 1 ? skillLevels[0] : null),
            ageGroupMin: batchAgeMin ? parseInt(batchAgeMin) : (ageMin ? parseInt(ageMin) : null),
            ageGroupMax: batchAgeMax ? parseInt(batchAgeMax) : (ageMax ? parseInt(ageMax) : null),
            maxBatchSize: parseInt(maxBatchSize),
            feeAmount: parseFloat(feeAmount),
            feeFrequency,
            registrationFee: registrationFee ? parseFloat(registrationFee) : 0,
            startDate: batchStartDate || null,
            endDate: batchEndDate || null,
            totalSessions: batchTotalSessions ? parseInt(batchTotalSessions) : null,
            registrationMode,
            autoWaitlist,
            notes: "",
            status: "draft",
            schedules: selectedSchedules,
          });
        } catch (batchErr) {
          console.error("[CreateClass] Batch save failed:", batchErr);
          toast.error("Class saved, but batch creation failed. You can add it from the class page.");
          navigate(`/provider/classes/${result.id}`, { replace: true, state: { isNew: true } });
          return;
        }
      }

      if (!effectivePublish) {
        if (pendingRequestId) {
          toast.success("Class saved! It will auto-publish once your category request is approved.");
        } else {
          toast.success("Draft saved!");
        }
        navigate(`/provider/classes/${result.id}`, { replace: true, state: { isNew: true } });
        return;
      }

      // 3. Content moderation (gracefully handled — edge function may not be deployed)
      try {
        const { overallStatus } = await moderateClassPublish({
          classId: result.id,
          title: title.trim(),
          description: description || undefined,
          ownerUserId: profile.id,
        });

        if (overallStatus === "rejected") {
          toast.error("Content was flagged by our moderation system. Please edit and resubmit.");
          navigate(`/provider/classes/${result.id}`, { replace: true });
          return;
        }
        if (overallStatus === "approved") {
          await supabase.from("classes").update({ status: "published" }).eq("id", result.id);
          if (batchValid && result.id) {
            await supabase
              .from("batches")
              .update({ status: "active" })
              .eq("class_id", result.id)
              .eq("status", "draft");
          }
          toast.success("Class published! Students can now find it nearby.");
        } else {
          toast.success("Class submitted for review. It will go live once approved by our team.");
        }
      } catch (modErr) {
        // Moderation service unavailable — class is safely saved as draft
        console.error("[CreateClass] Moderation check failed:", modErr);
        toast.success("Class saved! It will be reviewed before going live.");
      }

      navigate(`/provider/classes/${result.id}`, { replace: true, state: { isNew: true } });
    } catch (err) {
      console.error("[CreateClass] Save failed:", err);
      toast.error("Failed to save class. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  const isSaving = createClass.isPending || createBatch.isPending || isPublishing;
  const getCategoryName = (id: string) => allCategories?.find((c) => c.id === id)?.name ?? "";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => (step > 0 ? setStep(step - 1) : navigate(-1))} className="p-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">Add New Class</h1>
      </header>

      {/* Progress bar with step names below segments */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-muted-foreground">Step {step + 1} of {STEPS.length}</span>
          <span className="text-[11px] font-bold text-provider">{STEPS[step]}</span>
        </div>
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i <= step ? "bg-provider" : "bg-muted"}`}
            />
          ))}
        </div>
        <div className="flex gap-1.5 mt-1">
          {STEPS.map((name, i) => (
            <div key={i} className="flex-1 text-center">
              <span className={`text-[9px] ${i === step ? "text-provider font-semibold" : "text-muted-foreground"}`}>
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 px-6 py-4">

        {/* ── Step 0: Category ──────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-5 animate-fade-up">
            <div>
              <h2 className="text-xl font-bold">Category</h2>
              <p className="text-sm text-muted-foreground mt-1">Choose the category that best describes your class.</p>
            </div>

            {pendingRequestId && (
              <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3">
                <Clock size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-800">
                    Category request submitted: "{pendingCategoryName}"
                  </p>
                  <p className="text-xs text-amber-700 mt-0.5">
                    Your class will be saved as a draft and auto-published once approved.
                  </p>
                </div>
                <button
                  className="text-amber-500 hover:text-amber-700"
                  onClick={() => { setPendingRequestId(null); setPendingCategoryName(""); }}
                >✕</button>
              </div>
            )}

            {!pendingRequestId && (
              <>
                <div className="space-y-2">
                  <Label>Category<Req /></Label>
                  <div className="grid grid-cols-2 gap-2">
                    {filteredParentCategories.map((cat) => (
                      <Card
                        key={cat.id}
                        className={`cursor-pointer p-3 text-center transition-all text-sm ${
                          selectedParent === cat.id ? "border-provider bg-provider/5" : "hover:border-provider/50"
                        }`}
                        onClick={() => { setSelectedParent(cat.id); setSelectedCategoryId(""); }}
                      >
                        {cat.name}
                      </Card>
                    ))}
                  </div>
                </div>

                {selectedParent && (
                  <div className="space-y-2">
                    <Label>Sub-category<Req /></Label>
                    <div className="flex flex-wrap gap-2">
                      {filteredSubCategories
                        .filter((c) => c.parent_id === selectedParent)
                        .map((cat) => (
                          <Badge
                            key={cat.id}
                            variant={selectedCategoryId === cat.id ? "default" : "outline"}
                            className={`cursor-pointer ${selectedCategoryId === cat.id ? "bg-provider" : ""}`}
                            onClick={() => setSelectedCategoryId(cat.id)}
                          >
                            {cat.name}
                          </Badge>
                        ))}
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs text-provider hover:underline"
                  onClick={() => setShowCatRequestSheet(true)}
                >
                  <Plus size={13} /> Don't see your category? Request a new one
                </button>
              </>
            )}

            <Button
              disabled={!selectedCategoryId && !pendingRequestId}
              onClick={() => setStep(1)}
              className="w-full h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl"
            >
              Continue
            </Button>
          </div>
        )}

        {/* ── Step 1: Class Details ─────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-up">
            <div>
              <h2 className="text-xl font-bold">Class Details</h2>
              <p className="text-sm text-muted-foreground mt-1">Fields marked <span className="text-red-500">*</span> are required.</p>
            </div>

            <div className="space-y-2">
              <Label>Class Title<Req /></Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Badminton for Beginners"
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label>
                Short Description<Opt />
                <span className="text-xs text-muted-foreground ml-1">({shortDesc.length}/300)</span>
              </Label>
              <Input
                value={shortDesc}
                onChange={(e) => setShortDesc(e.target.value.slice(0, 300))}
                placeholder="Brief one-liner students see in search results"
                className="h-11 rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label>Full Description<Opt /></Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What will students learn? Who is this for? What's special about your class?"
                rows={4}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label>Class Type<Req /></Label>
              <Select value={classType} onValueChange={setClassType}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recurring">Recurring (ongoing batches)</SelectItem>
                  <SelectItem value="fixed_duration">Fixed Duration (e.g. 3-month course)</SelectItem>
                  <SelectItem value="one_time">One-Time (single session)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Skill Levels<Opt /></Label>
              <div className="flex flex-wrap gap-2">
                {SKILL_LEVELS.map((s) => (
                  <Badge
                    key={s}
                    variant={skillLevels.includes(s) ? "default" : "outline"}
                    className={`cursor-pointer capitalize ${skillLevels.includes(s) ? "bg-provider" : ""}`}
                    onClick={() => toggleSkill(s)}
                  >
                    {s.replace("_", " ")}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Min Age<Opt /></Label>
                <Input type="number" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} placeholder="3" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Max Age<Opt /></Label>
                <Input type="number" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} placeholder="60" className="h-11 rounded-xl" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Venue / Landmark<Opt /></Label>
              <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="e.g. Community Hall, Block A" className="h-11 rounded-xl" />
            </div>

            <div className="space-y-3">
              <Label>Class Location<Opt /></Label>
              <div className="flex items-center justify-between p-3 rounded-xl border">
                <div>
                  <p className="text-sm font-medium">Home-based / I travel to students</p>
                  <p className="text-xs text-muted-foreground">Enter your base location + service radius</p>
                </div>
                <Switch checked={isHomeBased} onCheckedChange={setIsHomeBased} />
              </div>
              <ClassLocationPicker
                isHomeBased={isHomeBased}
                location={classLocation}
                homeRadiusKm={homeRadiusKm}
                onLocationChange={setClassLocation}
                onRadiusChange={setHomeRadiusKm}
              />
            </div>

            <div className="space-y-2">
              <Label>What to Bring<Opt /></Label>
              <Input value={whatToBring} onChange={(e) => setWhatToBring(e.target.value)} placeholder="e.g. Racquet, sportswear, water bottle" className="h-11 rounded-xl" />
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!title.trim()}
              className="w-full h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl"
            >
              Continue
            </Button>
          </div>
        )}

        {/* ── Step 2: Media ─────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-5 animate-fade-up">
            <div>
              <h2 className="text-xl font-bold">Media</h2>
              <p className="text-sm text-muted-foreground mt-1">Add photos to attract more students. All fields are optional.</p>
            </div>

            <div className="space-y-2">
              <Label>Cover Image<Opt /></Label>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors hover:border-provider">
                {coverUrl ? (
                  <img src={coverUrl} alt="Cover" className="h-32 w-full rounded-lg object-cover" />
                ) : (
                  <>
                    <Camera size={28} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Upload cover image (recommended)</span>
                    <span className="text-xs text-muted-foreground">Classes with photos get 3× more views</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
              </label>
            </div>

            <div className="space-y-2">
              <Label>Gallery<Opt /> <span className="text-xs text-muted-foreground font-normal">(up to 5 photos)</span></Label>
              <div className="flex flex-wrap gap-2">
                {galleryUrls.map((url, i) => (
                  <img key={i} src={url} alt="" className="h-16 w-16 rounded-lg object-cover" />
                ))}
                {galleryUrls.length < 5 && (
                  <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed hover:border-provider">
                    <ImagePlus size={20} className="text-muted-foreground" />
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
                  </label>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Promo Video URL<Opt /></Label>
              <Input value={promoUrl} onChange={(e) => setPromoUrl(e.target.value)} placeholder="YouTube or Instagram link" className="h-11 rounded-xl" />
            </div>

            <Button
              onClick={() => setStep(3)}
              className="w-full h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl"
            >
              Continue
            </Button>
          </div>
        )}

        {/* ── Step 3: Trial ─────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5 animate-fade-up">
            <div>
              <h2 className="text-xl font-bold">Trial Classes<Opt /></h2>
              <p className="text-sm text-muted-foreground mt-1">Let students try before committing to a full batch. Highly recommended.</p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl border">
              <div>
                <p className="font-medium text-sm">Offer trial / demo classes?</p>
                <p className="text-xs text-muted-foreground">Students can book a one-off trial session</p>
              </div>
              <Switch checked={trialAvailable} onCheckedChange={setTrialAvailable} />
            </div>

            {trialAvailable && (
              <div className="space-y-2">
                <Label>Trial Fee<Opt /> <span className="text-xs text-muted-foreground font-normal">(₹0 for free)</span></Label>
                <Input type="number" value={trialFee} onChange={(e) => setTrialFee(e.target.value)} placeholder="0" className="h-11 rounded-xl" />
              </div>
            )}

            <Button onClick={() => setStep(4)} className="w-full h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl">
              Continue
            </Button>
          </div>
        )}

        {/* ── Step 4: Batch Setup ───────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-5 animate-fade-up">
            <div>
              <h2 className="text-xl font-bold">First Batch</h2>
              <p className="text-sm text-muted-foreground mt-1">
                A <strong>batch</strong> is a specific time slot for your class — e.g. "Morning Beginners" or "Weekend Advanced". Fields marked <span className="text-red-500">*</span> are required.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Batch Name<Req /></Label>
              <Input
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="e.g. Morning Beginners, Weekend Batch"
                className="h-11 rounded-xl"
              />
              <p className="text-xs text-muted-foreground">Give this batch a name students will recognise</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Batch Type<Req /></Label>
                <Select value={batchType} onValueChange={setBatchType}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="level">By Level</SelectItem>
                    <SelectItem value="age_group">By Age Group</SelectItem>
                    <SelectItem value="time_slot">By Time Slot</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {batchType === "level" && (
                <div className="space-y-2">
                  <Label>Skill Level<Opt /></Label>
                  <Select value={batchSkillLevel} onValueChange={setBatchSkillLevel}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                      <SelectItem value="all_levels">All Levels</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {batchType === "age_group" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Min Age<Opt /></Label>
                  <Input type="number" value={batchAgeMin} onChange={(e) => setBatchAgeMin(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Max Age<Opt /></Label>
                  <Input type="number" value={batchAgeMax} onChange={(e) => setBatchAgeMax(e.target.value)} className="h-11 rounded-xl" />
                </div>
              </div>
            )}

            {isAcademy && trainers && trainers.length > 0 && (
              <div className="space-y-2">
                <Label>Assign Trainer<Opt /></Label>
                <Select value={batchTrainerId} onValueChange={setBatchTrainerId}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select trainer" /></SelectTrigger>
                  <SelectContent>
                    {trainers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* ── Schedule — chip days + shared time ─────────────── */}
            <div className="space-y-3">
              <Label>Schedule<Req /></Label>
              <p className="text-xs text-muted-foreground -mt-2">Select the days this batch runs</p>

              {/* Day chips */}
              <div className="flex flex-wrap gap-2">
                {DAYS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleDay(d.value)}
                    className={`h-10 w-12 rounded-xl text-sm font-semibold transition-all active:scale-95 ${
                      selectedDays.includes(d.value)
                        ? "bg-provider text-white shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {/* Time pickers — shown once at least one day is selected */}
              {selectedDays.length > 0 && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Start Time<Req /></Label>
                    <Select value={batchStartTime} onValueChange={setBatchStartTime}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-52">
                        {TIME_OPTIONS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">End Time<Req /></Label>
                    <Select value={batchEndTime} onValueChange={setBatchEndTime}>
                      <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                      <SelectContent className="max-h-52">
                        {TIME_OPTIONS.map((t) => (
                          <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              {selectedDays.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedDays.map(d => DAYS.find(x => x.value === d)?.label).join(", ")} · {TIME_OPTIONS.find(t => t.value === batchStartTime)?.label} – {TIME_OPTIONS.find(t => t.value === batchEndTime)?.label}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Max Batch Size<Req /></Label>
              <Input type="number" value={maxBatchSize} onChange={(e) => setMaxBatchSize(e.target.value)} placeholder="e.g. 15" className="h-11 rounded-xl" />
              <p className="text-xs text-muted-foreground">Maximum number of students in this batch</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fee Amount<Req /></Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                  <Input type="number" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="2000" className="h-11 rounded-xl pl-7" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Fee Frequency<Req /></Label>
                <Select value={feeFrequency} onValueChange={setFeeFrequency}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {FEE_FREQUENCIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Registration Fee<Opt /> <span className="text-xs text-muted-foreground font-normal">(one-time at enrollment)</span></Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                <Input type="number" value={registrationFee} onChange={(e) => setRegistrationFee(e.target.value)} placeholder="0" className="h-11 rounded-xl pl-7" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Date<Opt /></Label>
                <Input type="date" value={batchStartDate} onChange={(e) => setBatchStartDate(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>End Date<Opt /></Label>
                <Input type="date" value={batchEndDate} onChange={(e) => setBatchEndDate(e.target.value)} className="h-11 rounded-xl" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Total Sessions<Opt /></Label>
              <Input type="number" value={batchTotalSessions} onChange={(e) => setBatchTotalSessions(e.target.value)} placeholder="e.g. 24" className="h-11 rounded-xl" />
            </div>

            <div className="space-y-2">
              <Label>Registration Mode<Req /></Label>
              <RadioGroup value={registrationMode} onValueChange={setRegistrationMode} className="flex gap-4">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="auto" id="reg-auto" />
                  <label htmlFor="reg-auto" className="text-sm cursor-pointer">Auto-accept</label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="manual" id="reg-manual" />
                  <label htmlFor="reg-manual" className="text-sm cursor-pointer">Manual approval</label>
                </div>
              </RadioGroup>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border">
              <div>
                <p className="text-sm font-medium">Auto-Waitlist<Opt /></p>
                <p className="text-xs text-muted-foreground">Automatically add students to a waitlist when this batch is full</p>
              </div>
              <Switch checked={autoWaitlist} onCheckedChange={setAutoWaitlist} />
            </div>

            {/* Inline validation hint */}
            {!batchValid && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                To proceed, please fill in: {[
                  !batchName.trim() && "Batch Name",
                  !selectedDays.length && "Schedule (select at least one day)",
                  !maxBatchSize && "Max Batch Size",
                  !feeAmount && "Fee Amount",
                ].filter(Boolean).join(" · ")}
              </div>
            )}

            <Button
              onClick={() => setStep(5)}
              disabled={!batchValid}
              className="w-full h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl"
            >
              Review
            </Button>
          </div>
        )}

        {/* ── Step 5: Review ────────────────────────────────────────── */}
        {step === 5 && (
          <div className="space-y-5 animate-fade-up">
            <h2 className="text-xl font-bold">Review & Save</h2>

            <Card className="p-4 space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Class Details</h3>
              {coverUrl && <img src={coverUrl} alt="Cover" className="w-full h-32 rounded-lg object-cover" />}
              <h4 className="font-bold">{title}</h4>
              {shortDesc && <p className="text-sm text-muted-foreground">{shortDesc}</p>}
              <div className="flex flex-wrap gap-1">
                {selectedCategoryId && (
                  <Badge variant="outline" className="text-xs">{getCategoryName(selectedCategoryId)}</Badge>
                )}
                {pendingRequestId && (
                  <Badge variant="outline" className="text-xs border-amber-300 text-amber-700">
                    <Clock size={10} className="mr-1" />{pendingCategoryName} (pending)
                  </Badge>
                )}
                <Badge variant="outline" className="capitalize">{classType.replace("_", " ")}</Badge>
                {skillLevels.map((s) => (
                  <Badge key={s} variant="secondary" className="capitalize">{s.replace("_", " ")}</Badge>
                ))}
              </div>
              {(ageMin || ageMax) && (
                <p className="text-xs text-muted-foreground">Age: {ageMin || "Any"} – {ageMax || "Any"}</p>
              )}
              {venue && <p className="text-xs text-muted-foreground">Venue: {venue}</p>}
              <p className="text-xs text-muted-foreground">
                Location: {classLocation?.address || "Not set"}
                {isHomeBased && ` (Home-based · ${homeRadiusKm} km radius)`}
              </p>
              {trialAvailable && <p className="text-xs text-muted-foreground">Trial: ₹{trialFee}</p>}
            </Card>

            <Card className="p-4 space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">First Batch</h3>
              <h4 className="font-bold">{batchName}</h4>
              <p className="text-sm text-muted-foreground">
                {selectedDays.map(d => DAYS.find(x => x.value === d)?.label).join(", ")}
                {" · "}
                {TIME_OPTIONS.find(t => t.value === batchStartTime)?.label} – {TIME_OPTIONS.find(t => t.value === batchEndTime)?.label}
              </p>
              <div className="flex flex-wrap gap-1">
                <Badge variant="outline">Max {maxBatchSize} students</Badge>
                <Badge variant="outline">
                  ₹{feeAmount} / {FEE_FREQUENCIES.find((f) => f.value === feeFrequency)?.label ?? feeFrequency}
                </Badge>
              </div>
              {registrationFee && parseFloat(registrationFee) > 0 && (
                <p className="text-xs text-muted-foreground">Registration Fee: ₹{registrationFee} (one-time)</p>
              )}
              <p className="text-xs text-muted-foreground">
                Registration: {registrationMode === "auto" ? "Auto-accept" : "Manual approval"}
              </p>
            </Card>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              Content is reviewed by our moderation system before going live. Most classes are approved instantly.
            </div>

            {pendingRequestId && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <span className="font-semibold">Pending category:</span> This class will be saved as a draft and published automatically once "{pendingCategoryName}" is approved.
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => handleSave(false)}
                disabled={isSaving}
                className="flex-1 h-12 rounded-xl"
              >
                Save as Draft
              </Button>
              {!pendingRequestId && (
                <Button
                  onClick={() => handleSave(true)}
                  disabled={isSaving}
                  className="flex-1 h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl"
                >
                  {isSaving ? <Loader2 size={20} className="animate-spin" /> : "Publish"}
                </Button>
              )}
              {pendingRequestId && (
                <Button
                  onClick={() => handleSave(false)}
                  disabled={isSaving}
                  className="flex-1 h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl"
                >
                  {isSaving ? <Loader2 size={20} className="animate-spin" /> : "Save & Wait for Approval"}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {providerProfile && (
        <CategoryRequestSheet
          open={showCatRequestSheet}
          onOpenChange={setShowCatRequestSheet}
          providerId={providerProfile.id}
          onSubmitted={(requestId, catName) => {
            setPendingRequestId(requestId);
            setPendingCategoryName(catName);
            setSelectedCategoryId("");
            setSelectedParent("");
          }}
        />
      )}
    </div>
  );
};

export default CreateClass;
