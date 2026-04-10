import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useProviderRegistrations, useTrainers } from "@/hooks/useProvider";
import { useCategories, useCreateClass, useCreateBatch, useUploadClassImage } from "@/hooks/useClasses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
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
  Check,
  ImagePlus,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const STEPS = ["Category", "Details", "Media", "Trial", "Batch", "Review"];
const SKILL_LEVELS = ["beginner", "intermediate", "advanced", "all_levels"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FEE_FREQUENCIES = [
  { value: "monthly", label: "Monthly" },
  { value: "per_session", label: "Per Session" },
  { value: "quarterly", label: "Quarterly" },
  { value: "for_duration", label: "For Duration" },
  { value: "one_time", label: "One Time" },
];

interface DaySchedule {
  enabled: boolean;
  startTime: string;
  endTime: string;
}

const CreateClass = () => {
  const navigate = useNavigate();
  const { providerProfile } = useUser();
  const [step, setStep] = useState(0);

  // Step 1: Category
  const [selectedRegId, setSelectedRegId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedParent, setSelectedParent] = useState("");

  // Step 2: Details
  const [title, setTitle] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [description, setDescription] = useState("");
  const [classType, setClassType] = useState("recurring");
  const [skillLevels, setSkillLevels] = useState<string[]>([]);
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [venue, setVenue] = useState("");
  const [whatToBring, setWhatToBring] = useState("");
  const [requiresCommonArea, setRequiresCommonArea] = useState(true);

  // Step 3: Media
  const [coverUrl, setCoverUrl] = useState("");
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [promoUrl, setPromoUrl] = useState("");

  // Step 4: Trial
  const [trialAvailable, setTrialAvailable] = useState(false);
  const [trialFee, setTrialFee] = useState("0");

  // Step 5: Batch
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
  const [daySchedules, setDaySchedules] = useState<DaySchedule[]>(
    DAY_NAMES.map(() => ({ enabled: false, startTime: "09:00", endTime: "10:00" }))
  );

  const fileRef = useRef<HTMLInputElement>(null);

  const isAcademy = providerProfile?.provider_type === "academy";
  const { data: registrations } = useProviderRegistrations(providerProfile?.id);
  const { data: allCategories } = useCategories();
  const { data: trainers } = useTrainers(providerProfile?.id);
  const createClass = useCreateClass();
  const createBatch = useCreateBatch();
  const uploadImage = useUploadClassImage();

  const approvedRegs = registrations?.filter((r) => r.status === "approved" && r.terms_status === "accepted") ?? [];
  const pendingTermsRegs = registrations?.filter((r) => r.status === "approved" && r.terms_status !== "accepted") ?? [];
  // All registrations eligible to appear in the dropdown (not rejected or suspended)
  const eligibleRegs = registrations?.filter((r) => r.status !== "rejected" && r.status !== "suspended") ?? [];
  const selectedReg = eligibleRegs.find((r) => r.id === selectedRegId);
  const selectedRegIsFullyApproved = selectedReg?.status === "approved" && selectedReg?.terms_status === "accepted";

  // Filter categories based on provider's specialization_category_ids
  const specializationIds = providerProfile?.specialization_category_ids ?? [];

  const filteredSubCategories = useMemo(() => {
    if (!allCategories) return [];
    const subs = allCategories.filter((c) => c.parent_category_id);
    if (specializationIds.length === 0) return subs;
    return subs.filter((c) => specializationIds.includes(c.id));
  }, [allCategories, specializationIds]);

  const filteredParentCategories = useMemo(() => {
    if (!allCategories) return [];
    const parents = allCategories.filter((c) => !c.parent_category_id);
    if (specializationIds.length === 0) return parents;
    const parentIdsWithChildren = new Set(
      filteredSubCategories.map((c) => c.parent_category_id)
    );
    return parents.filter((p) => parentIdsWithChildren.has(p.id));
  }, [allCategories, filteredSubCategories, specializationIds]);

  const toggleSkill = (s: string) => {
    setSkillLevels((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  };

  const updateDaySchedule = (index: number, updates: Partial<DaySchedule>) => {
    setDaySchedules((prev) =>
      prev.map((d, i) => (i === index ? { ...d, ...updates } : d))
    );
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage.mutateAsync({ classId: "new-" + Date.now(), file, folder: "cover" });
      setCoverUrl(url);
    } catch {
      toast.error("Upload failed");
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files.slice(0, 5 - galleryUrls.length)) {
      try {
        const url = await uploadImage.mutateAsync({ classId: "new-" + Date.now(), file, folder: "gallery" });
        setGalleryUrls((p) => [...p, url]);
      } catch {
        toast.error("Upload failed");
      }
    }
  };

  const selectedSchedules = daySchedules
    .map((d, i) => ({ ...d, dayOfWeek: i }))
    .filter((d) => d.enabled);

  const batchValid = batchName.trim() && maxBatchSize && feeAmount && selectedSchedules.length > 0;

  const handleSave = async (status: string) => {
    if (!selectedRegId || !selectedCategoryId || !title.trim()) return;

    // Common-area classes can only be published once admin has approved and terms are accepted
    if (status === "published" && requiresCommonArea && !selectedRegIsFullyApproved) {
      toast.error(
        "This class uses common areas and requires admin approval + accepted commercial terms before publishing. Save as draft instead."
      );
      return;
    }

    try {
      // 1. Create the class
      const result = await createClass.mutateAsync({
        providerRegistrationId: selectedRegId,
        categoryId: selectedCategoryId,
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
        status,
        requiresCommonArea,
      });

      // 2. Create the batch + schedules
      if (batchValid && result?.id) {
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
          status: status === "published" ? "active" : "draft",
          schedules: selectedSchedules.map((s) => ({
            dayOfWeek: s.dayOfWeek,
            startTime: s.startTime,
            endTime: s.endTime,
          })),
        });
      }

      toast.success(status === "published" ? "Class published!" : "Draft saved!");
      navigate(`/provider/classes`, { replace: true });
    } catch {
      toast.error("Failed to save class");
    }
  };

  const isSaving = createClass.isPending || createBatch.isPending;

  // Helper to get category name by id
  const getCategoryName = (id: string) => allCategories?.find((c) => c.id === id)?.name ?? "";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => (step > 0 ? setStep(step - 1) : navigate(-1))} className="p-1">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">Add New Class</h1>
      </header>

      <div className="px-6 pt-4 pb-2">
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-provider" : "bg-muted"}`} />
          ))}
        </div>
      </div>

      <div className="flex-1 px-6 py-4">
        {/* Step 1: Apartment & Category */}
        {step === 0 && (
          <div className="space-y-5 animate-fade-up">
            <h2 className="text-xl font-bold">Apartment & Category</h2>

            <div className="space-y-2">
              <Label>Select Apartment</Label>
              {eligibleRegs.length === 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  You don't have any active registrations. Please register for an apartment first.
                </div>
              )}
              {selectedRegId && !selectedRegIsFullyApproved && (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                  This registration is pending admin approval. You can only create <span className="font-semibold">home-based classes</span> (no common area) until approved.
                </div>
              )}
              <Select value={selectedRegId} onValueChange={setSelectedRegId}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Choose apartment" /></SelectTrigger>
                <SelectContent>
                  {eligibleRegs.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {(r.apartment_complexes as any)?.name}
                      {(r.status !== "approved" || r.terms_status !== "accepted") ? " (pending)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Category</Label>
              <div className="grid grid-cols-2 gap-2">
                {filteredParentCategories.map((cat) => (
                  <Card
                    key={cat.id}
                    className={`cursor-pointer p-3 text-center transition-all text-sm ${selectedParent === cat.id ? "border-provider bg-provider/5" : "hover:border-provider/50"}`}
                    onClick={() => { setSelectedParent(cat.id); setSelectedCategoryId(""); }}
                  >
                    {cat.name}
                  </Card>
                ))}
              </div>
            </div>

            {selectedParent && (
              <div className="space-y-2">
                <Label>Sub-category</Label>
                <div className="flex flex-wrap gap-2">
                  {filteredSubCategories
                    .filter((c) => c.parent_category_id === selectedParent)
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

            <Button
              disabled={!selectedRegId || !selectedCategoryId}
              onClick={() => setStep(1)}
              className="w-full h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl"
            >
              Continue
            </Button>
          </div>
        )}

        {/* Step 2: Class Details */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-up">
            <h2 className="text-xl font-bold">Class Details</h2>
            <div className="space-y-2">
              <Label>Title</Label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Badminton for Beginners" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Short Description <span className="text-xs text-muted-foreground">({shortDesc.length}/300)</span></Label>
              <Input value={shortDesc} onChange={(e) => setShortDesc(e.target.value.slice(0, 300))} placeholder="Brief one-liner" className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Full Description</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detailed description..." rows={4} className="rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Class Type</Label>
              <Select value={classType} onValueChange={setClassType}>
                <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recurring">Recurring</SelectItem>
                  <SelectItem value="fixed_duration">Fixed Duration</SelectItem>
                  <SelectItem value="one_time">One-Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Skill Levels</Label>
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
                <Label>Min Age</Label>
                <Input type="number" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} placeholder="3" className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Max Age</Label>
                <Input type="number" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} placeholder="60" className="h-11 rounded-xl" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Venue Details</Label>
              <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Community Hall, Block A" className="h-11 rounded-xl" />
            </div>

            <div className="space-y-2">
              <Label>Class Location</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRequiresCommonArea(false)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-4 text-sm transition-all ${
                    !requiresCommonArea
                      ? "border-provider bg-provider/5 text-provider font-medium"
                      : "border-border hover:border-provider/40"
                  }`}
                >
                  <span className="text-xl">🏠</span>
                  <span>My home / own premises</span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">No admin approval needed</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRequiresCommonArea(true)}
                  className={`flex flex-col items-center gap-1.5 rounded-xl border-2 p-4 text-sm transition-all ${
                    requiresCommonArea
                      ? "border-provider bg-provider/5 text-provider font-medium"
                      : "border-border hover:border-provider/40"
                  }`}
                >
                  <span className="text-xl">🏢</span>
                  <span>Society common area</span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">Requires admin approval</span>
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>What to Bring</Label>
              <Input value={whatToBring} onChange={(e) => setWhatToBring(e.target.value)} placeholder="Racquet, sportswear" className="h-11 rounded-xl" />
            </div>
            <Button onClick={() => setStep(2)} disabled={!title.trim()} className="w-full h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl">
              Continue
            </Button>
          </div>
        )}

        {/* Step 3: Media */}
        {step === 2 && (
          <div className="space-y-5 animate-fade-up">
            <h2 className="text-xl font-bold">Media</h2>
            <div className="space-y-2">
              <Label>Cover Image</Label>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors hover:border-provider">
                {coverUrl ? (
                  <img src={coverUrl} alt="Cover" className="h-32 w-full rounded-lg object-cover" />
                ) : (
                  <>
                    <Camera size={28} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Upload cover image</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleCoverUpload} />
              </label>
            </div>
            <div className="space-y-2">
              <Label>Gallery (up to 5)</Label>
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
              <Label>Promo Video URL (optional)</Label>
              <Input value={promoUrl} onChange={(e) => setPromoUrl(e.target.value)} placeholder="YouTube or Instagram link" className="h-11 rounded-xl" />
            </div>
            <Button onClick={() => setStep(3)} className="w-full h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl">
              Continue
            </Button>
          </div>
        )}

        {/* Step 4: Trial */}
        {step === 3 && (
          <div className="space-y-5 animate-fade-up">
            <h2 className="text-xl font-bold">Trial Classes</h2>
            <div className="flex items-center justify-between p-4 rounded-xl border">
              <div>
                <p className="font-medium text-sm">Offer trial / demo classes?</p>
                <p className="text-xs text-muted-foreground">Let students try before enrolling</p>
              </div>
              <Switch checked={trialAvailable} onCheckedChange={setTrialAvailable} />
            </div>
            {trialAvailable && (
              <div className="space-y-2">
                <Label>Trial Fee (₹0 for free)</Label>
                <Input type="number" value={trialFee} onChange={(e) => setTrialFee(e.target.value)} placeholder="0" className="h-11 rounded-xl" />
              </div>
            )}
            <Button onClick={() => setStep(4)} className="w-full h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl">
              Continue
            </Button>
          </div>
        )}

        {/* Step 5: Batch Setup */}
        {step === 4 && (
          <div className="space-y-5 animate-fade-up">
            <h2 className="text-xl font-bold">Batch Setup</h2>
            <p className="text-sm text-muted-foreground">Set up the first batch for your class.</p>

            <div className="space-y-2">
              <Label>Batch Name</Label>
              <Input
                value={batchName}
                onChange={(e) => setBatchName(e.target.value)}
                placeholder="e.g. Morning Beginners"
                className="h-11 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Batch Type</Label>
                <Select value={batchType} onValueChange={setBatchType}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="level">Level</SelectItem>
                    <SelectItem value="age_group">Age Group</SelectItem>
                    <SelectItem value="time_slot">Time Slot</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {batchType === "level" && (
                <div className="space-y-2">
                  <Label>Skill Level</Label>
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
                  <Label>Min Age</Label>
                  <Input type="number" value={batchAgeMin} onChange={(e) => setBatchAgeMin(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Max Age</Label>
                  <Input type="number" value={batchAgeMax} onChange={(e) => setBatchAgeMax(e.target.value)} className="h-11 rounded-xl" />
                </div>
              </div>
            )}

            {isAcademy && trainers && trainers.length > 0 && (
              <div className="space-y-2">
                <Label>Assign Trainer</Label>
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

            {/* Schedule Builder */}
            <div className="space-y-3">
              <Label>Schedule</Label>
              <div className="space-y-2">
                {DAY_NAMES.map((day, i) => (
                  <div key={day} className="space-y-2">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        id={`day-${i}`}
                        checked={daySchedules[i].enabled}
                        onCheckedChange={(checked) =>
                          updateDaySchedule(i, { enabled: !!checked })
                        }
                      />
                      <label htmlFor={`day-${i}`} className="text-sm font-medium w-10 cursor-pointer">
                        {day}
                      </label>
                      {daySchedules[i].enabled && (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            type="time"
                            value={daySchedules[i].startTime}
                            onChange={(e) => updateDaySchedule(i, { startTime: e.target.value })}
                            className="h-9 rounded-xl text-sm"
                          />
                          <span className="text-xs text-muted-foreground">to</span>
                          <Input
                            type="time"
                            value={daySchedules[i].endTime}
                            onChange={(e) => updateDaySchedule(i, { endTime: e.target.value })}
                            className="h-9 rounded-xl text-sm"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Max Batch Size</Label>
              <Input
                type="number"
                value={maxBatchSize}
                onChange={(e) => setMaxBatchSize(e.target.value)}
                placeholder="e.g. 15"
                className="h-11 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Fee Amount (₹)</Label>
                <Input
                  type="number"
                  value={feeAmount}
                  onChange={(e) => setFeeAmount(e.target.value)}
                  placeholder="e.g. 2000"
                  className="h-11 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Fee Frequency</Label>
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
              <Label>Registration Fee (₹, one-time)</Label>
              <Input
                type="number"
                value={registrationFee}
                onChange={(e) => setRegistrationFee(e.target.value)}
                placeholder="e.g. 500"
                className="h-11 rounded-xl"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={batchStartDate} onChange={(e) => setBatchStartDate(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={batchEndDate} onChange={(e) => setBatchEndDate(e.target.value)} className="h-11 rounded-xl" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Total Sessions</Label>
              <Input type="number" value={batchTotalSessions} onChange={(e) => setBatchTotalSessions(e.target.value)} placeholder="Optional" className="h-11 rounded-xl" />
            </div>

            <div className="space-y-2">
              <Label>Registration Mode</Label>
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
                <p className="text-sm font-medium">Auto-Waitlist</p>
                <p className="text-xs text-muted-foreground">Add to waitlist when batch is full</p>
              </div>
              <Switch checked={autoWaitlist} onCheckedChange={setAutoWaitlist} />
            </div>

            <Button
              onClick={() => setStep(5)}
              disabled={!batchValid}
              className="w-full h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl"
            >
              Review
            </Button>
          </div>
        )}

        {/* Step 6: Review */}
        {step === 5 && (
          <div className="space-y-5 animate-fade-up">
            <h2 className="text-xl font-bold">Review & Save</h2>

            {/* Class Summary */}
            <Card className="p-4 space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Class Details</h3>
              {coverUrl && <img src={coverUrl} alt="Cover" className="w-full h-32 rounded-lg object-cover" />}
              <h4 className="font-bold">{title}</h4>
              {shortDesc && <p className="text-sm text-muted-foreground">{shortDesc}</p>}
              <div className="flex flex-wrap gap-1">
                {selectedCategoryId && (
                  <Badge variant="outline" className="text-xs">{getCategoryName(selectedCategoryId)}</Badge>
                )}
                <Badge variant="outline" className="capitalize">{classType.replace("_", " ")}</Badge>
                {skillLevels.map((s) => (
                  <Badge key={s} variant="secondary" className="capitalize">{s.replace("_", " ")}</Badge>
                ))}
              </div>
              {(ageMin || ageMax) && (
                <p className="text-xs text-muted-foreground">
                  Age: {ageMin || "Any"} - {ageMax || "Any"}
                </p>
              )}
              {venue && <p className="text-xs text-muted-foreground">Venue: {venue}</p>}
              <p className="text-xs text-muted-foreground">
                Location: {requiresCommonArea ? "🏢 Society common area" : "🏠 Home-based / own premises"}
              </p>
              {trialAvailable && <p className="text-xs text-muted-foreground">Trial: ₹{trialFee}</p>}
            </Card>

            {/* Batch Summary */}
            <Card className="p-4 space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Batch Details</h3>
              <h4 className="font-bold">{batchName}</h4>
              <div className="space-y-1">
                {selectedSchedules.map((s) => (
                  <p key={s.dayOfWeek} className="text-sm text-muted-foreground">
                    {DAY_NAMES[s.dayOfWeek]}: {s.startTime} - {s.endTime}
                  </p>
                ))}
              </div>
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

            {requiresCommonArea && !selectedRegIsFullyApproved && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
                This class uses society common areas and requires admin approval. It will be auto-published once your registration is approved and you accept the commercial terms.
              </div>
            )}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => handleSave("draft")}
                disabled={isSaving}
                className="flex-1 h-12 rounded-xl"
              >
                Save as Draft
              </Button>
              <Button
                onClick={() => handleSave("published")}
                disabled={isSaving || (requiresCommonArea && !selectedRegIsFullyApproved)}
                className="flex-1 h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl disabled:opacity-40"
              >
                {isSaving ? <Loader2 size={20} className="animate-spin" /> : "Publish"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CreateClass;
