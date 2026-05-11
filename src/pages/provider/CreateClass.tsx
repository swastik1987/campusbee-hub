import { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useCategories, useCreateClass, useUploadClassImage } from "@/hooks/useClasses";
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
  Facebook,
  ImagePlus,
  Instagram,
  Link2,
  Loader2,
  MapPin,
  Plus,
  Twitter,
  Youtube,
} from "lucide-react";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const STEPS = ["Category", "Details", "Location", "Media", "Review"];

/** Red asterisk for required fields */
const Req = () => <span className="text-red-500 ml-0.5">*</span>;
/** Grey "(optional)" tag for optional fields */
const Opt = () => <span className="text-muted-foreground text-xs font-normal ml-1">(optional)</span>;

// ─── Component ────────────────────────────────────────────────────────────────

const CreateClass = () => {
  const navigate = useNavigate();
  const { profile, providerProfile } = useUser();
  const [step, setStep] = useState(0);

  // ── Step 0: Category ───────────────────────────────────────────────────────
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [selectedParent, setSelectedParent] = useState("");
  const [showCatRequestSheet, setShowCatRequestSheet] = useState(false);
  const [pendingRequestId, setPendingRequestId] = useState<string | null>(null);
  const [pendingCategoryName, setPendingCategoryName] = useState("");

  // ── Step 1: Details ────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [shortDesc, setShortDesc] = useState("");
  const [description, setDescription] = useState("");
  const [classType, setClassType] = useState("recurring");
  const [whatToBring, setWhatToBring] = useState("");
  const [trialAvailable, setTrialAvailable] = useState(false);
  const [trialFee, setTrialFee] = useState("0");

  // ── Step 2: Location ───────────────────────────────────────────────────────
  const [venue, setVenue] = useState("");
  const [isHomeBased, setIsHomeBased] = useState(false);
  const [classLocation, setClassLocation] = useState<LocationValue | null>(null);
  const [homeRadiusKm, setHomeRadiusKm] = useState(5);

  // ── Step 3: Media ──────────────────────────────────────────────────────────
  const [coverUrl, setCoverUrl] = useState("");
  const [galleryUrls, setGalleryUrls] = useState<string[]>([]);
  const [promoUrl, setPromoUrl] = useState("");      // YouTube
  const [facebookUrl, setFacebookUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");

  const [isPublishing, setIsPublishing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: allCategories } = useCategories();
  const createClass = useCreateClass();
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

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await uploadImage.mutateAsync({
        classId: "new-" + Date.now(),
        file,
        folder: "cover",
      });
      setCoverUrl(url);
    } catch {
      toast.error("Upload failed");
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    for (const file of files.slice(0, 5 - galleryUrls.length)) {
      try {
        const url = await uploadImage.mutateAsync({
          classId: "new-" + Date.now(),
          file,
          folder: "gallery",
        });
        setGalleryUrls((p) => [...p, url]);
      } catch {
        toast.error("Upload failed");
      }
    }
  };

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
        skillLevel: [],
        ageGroupMin: null,
        ageGroupMax: null,
        venueDetails: venue,
        whatToBring,
        coverImageUrl: coverUrl,
        galleryUrls,
        promoVideoUrl: promoUrl,
        facebookUrl,
        instagramUrl,
        twitterUrl,
        trialAvailable,
        trialFee: parseFloat(trialFee) || 0,
        status: "draft",
        address: classLocation?.address ?? undefined,
        isHomeBased,
        locationLat: classLocation?.lat ?? null,
        locationLng: classLocation?.lng ?? null,
        homeRadiusKm: isHomeBased ? homeRadiusKm : 5,
      });

      if (!effectivePublish) {
        if (pendingRequestId) {
          toast.success("Class saved! It will auto-publish once your category request is approved.");
        } else {
          toast.success("Draft saved!");
        }
        navigate(`/provider/classes/${result.id}`, { replace: true, state: { isNew: true } });
        return;
      }

      // 2. Content moderation (gracefully handled)
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
          await supabase
            .from("classes")
            .update({ status: "published", moderation_status: "approved" })
            .eq("id", result.id);
          toast.success("Class published! Students can now find it nearby.");
        } else {
          toast.success("Class submitted for review. It will go live once approved by our team.");
        }
      } catch (modErr) {
        // Moderation service unavailable — publish directly (MVP)
        console.error("[CreateClass] Moderation check failed:", modErr);
        await supabase
          .from("classes")
          .update({ status: "published", moderation_status: "approved" })
          .eq("id", result.id);
        toast.success("Class published!");
      }

      navigate(`/provider/classes/${result.id}`, { replace: true, state: { isNew: true } });
    } catch (err) {
      console.error("[CreateClass] Save failed:", err);
      toast.error("Failed to save class. Please try again.");
    } finally {
      setIsPublishing(false);
    }
  };

  const isSaving = createClass.isPending || isPublishing;
  const getCategoryName = (id: string) =>
    allCategories?.find((c) => c.id === id)?.name ?? "";

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button
          onClick={() => (step > 0 ? setStep(step - 1) : navigate(-1))}
          className="p-1"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-lg font-bold">Add New Class</h1>
      </header>

      {/* Progress bar with step names */}
      <div className="px-6 pt-4 pb-2">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-muted-foreground">
            Step {step + 1} of {STEPS.length}
          </span>
          <span className="text-[11px] font-bold text-provider">{STEPS[step]}</span>
        </div>
        <div className="flex gap-1.5">
          {STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i <= step ? "bg-provider" : "bg-muted"
              }`}
            />
          ))}
        </div>
        <div className="flex gap-1.5 mt-1">
          {STEPS.map((name, i) => (
            <div key={i} className="flex-1 text-center">
              <span
                className={`text-[9px] ${
                  i === step ? "text-provider font-semibold" : "text-muted-foreground"
                }`}
              >
                {name}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 px-6 py-4">

        {/* ── Step 0: Category ───────────────────────────────────────────── */}
        {step === 0 && (
          <div className="space-y-5 animate-fade-up">
            <div>
              <h2 className="text-xl font-bold">Category</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Choose the category that best describes your class.
              </p>
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
                  onClick={() => {
                    setPendingRequestId(null);
                    setPendingCategoryName("");
                  }}
                >
                  ✕
                </button>
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
                          selectedParent === cat.id
                            ? "border-provider bg-provider/5"
                            : "hover:border-provider/50"
                        }`}
                        onClick={() => {
                          setSelectedParent(cat.id);
                          setSelectedCategoryId("");
                        }}
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
                            className={`cursor-pointer ${
                              selectedCategoryId === cat.id ? "bg-provider" : ""
                            }`}
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

        {/* ── Step 1: Details ────────────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4 animate-fade-up">
            <div>
              <h2 className="text-xl font-bold">Class Details</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Fields marked <span className="text-red-500">*</span> are required.
              </p>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label>Class Title<Req /></Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Badminton Classes, Morning Yoga"
                className="h-11 rounded-xl"
              />
            </div>

            {/* Class Type */}
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

            {/* What to Bring */}
            <div className="space-y-2">
              <Label>What to Bring<Opt /></Label>
              <Input
                value={whatToBring}
                onChange={(e) => setWhatToBring(e.target.value)}
                placeholder="e.g. Racquet, sportswear, water bottle"
                className="h-11 rounded-xl"
              />
            </div>

            {/* Short Description */}
            <div className="space-y-2">
              <Label>
                Short Description<Opt />
                <span className="text-xs text-muted-foreground ml-1">
                  ({shortDesc.length}/300)
                </span>
              </Label>
              <Input
                value={shortDesc}
                onChange={(e) => setShortDesc(e.target.value.slice(0, 300))}
                placeholder="Brief one-liner students see in search results"
                className="h-11 rounded-xl"
              />
            </div>

            {/* Full Description */}
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

            {/* Trial */}
            <div className="flex items-center justify-between p-4 rounded-xl border">
              <div>
                <p className="font-medium text-sm">Offer trial / demo classes?<Opt /></p>
                <p className="text-xs text-muted-foreground">
                  Students can book a one-off trial session
                </p>
              </div>
              <Switch checked={trialAvailable} onCheckedChange={setTrialAvailable} />
            </div>
            {trialAvailable && (
              <div className="space-y-2">
                <Label>
                  Trial Fee<Opt />
                  <span className="text-xs text-muted-foreground font-normal ml-1">(₹0 for free)</span>
                </Label>
                <Input
                  type="number"
                  value={trialFee}
                  onChange={(e) => setTrialFee(e.target.value)}
                  placeholder="0"
                  className="h-11 rounded-xl"
                />
              </div>
            )}

            <Button
              onClick={() => setStep(2)}
              disabled={!title.trim()}
              className="w-full h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl"
            >
              Continue
            </Button>
          </div>
        )}

        {/* ── Step 2: Location ───────────────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4 animate-fade-up">
            <div>
              <h2 className="text-xl font-bold">Location</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Where does this class take place? Seekers discover classes by proximity.
              </p>
            </div>

            {/* Home-based toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl border">
              <div>
                <p className="text-sm font-medium">Home-based / I travel to students</p>
                <p className="text-xs text-muted-foreground">
                  Enter your base location + service radius
                </p>
              </div>
              <Switch checked={isHomeBased} onCheckedChange={setIsHomeBased} />
            </div>

            {/* Map picker — mandatory */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <MapPin size={13} className="text-provider" />
                Class Location<Req />
              </Label>
              <ClassLocationPicker
                isHomeBased={isHomeBased}
                location={classLocation}
                homeRadiusKm={homeRadiusKm}
                onLocationChange={setClassLocation}
                onRadiusChange={setHomeRadiusKm}
              />
            </div>

            {/* Venue Details */}
            <div className="space-y-2">
              <Label>Venue / Landmark<Opt /></Label>
              <Input
                value={venue}
                onChange={(e) => setVenue(e.target.value)}
                placeholder="e.g. Community Hall, Block A, Ground Floor"
                className="h-11 rounded-xl"
              />
              <p className="text-xs text-muted-foreground">
                A short human-readable location hint shown alongside the map pin.
              </p>
            </div>

            <Button
              onClick={() => setStep(3)}
              disabled={!classLocation}
              className="w-full h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl"
            >
              Continue
            </Button>
          </div>
        )}

        {/* ── Step 3: Media ──────────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-5 animate-fade-up">
            <div>
              <h2 className="text-xl font-bold">Media</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Photos and social links help students trust and discover your class.
              </p>
            </div>

            {/* Cover Image */}
            <div className="space-y-2">
              <Label>Cover Image<Opt /></Label>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors hover:border-provider">
                {coverUrl ? (
                  <img
                    src={coverUrl}
                    alt="Cover"
                    className="h-32 w-full rounded-lg object-cover"
                  />
                ) : (
                  <>
                    <Camera size={28} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">
                      Upload cover image (recommended)
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Classes with photos get 3× more views
                    </span>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleCoverUpload}
                />
              </label>
            </div>

            {/* Gallery */}
            <div className="space-y-2">
              <Label>
                Gallery<Opt />
                <span className="text-xs text-muted-foreground font-normal ml-1">
                  (up to 5 photos)
                </span>
              </Label>
              <div className="flex flex-wrap gap-2">
                {galleryUrls.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                ))}
                {galleryUrls.length < 5 && (
                  <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed hover:border-provider">
                    <ImagePlus size={20} className="text-muted-foreground" />
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleGalleryUpload}
                    />
                  </label>
                )}
              </div>
            </div>

            {/* Social Media */}
            <div className="space-y-3">
              <div>
                <Label className="text-sm font-semibold">Social Media<Opt /></Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Paste your full profile or page URL for each platform you're on.
                </p>
              </div>

              {/* YouTube */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Youtube size={13} className="text-red-600" /> YouTube / Promo Video
                </Label>
                <Input
                  value={promoUrl}
                  onChange={(e) => setPromoUrl(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  className="h-10 rounded-xl"
                />
              </div>

              {/* Facebook */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Facebook size={13} className="text-blue-600" /> Facebook
                </Label>
                <Input
                  value={facebookUrl}
                  onChange={(e) => setFacebookUrl(e.target.value)}
                  placeholder="https://facebook.com/yourpage"
                  className="h-10 rounded-xl"
                />
              </div>

              {/* Instagram */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Instagram size={13} className="text-pink-600" /> Instagram
                </Label>
                <Input
                  value={instagramUrl}
                  onChange={(e) => setInstagramUrl(e.target.value)}
                  placeholder="https://instagram.com/yourhandle"
                  className="h-10 rounded-xl"
                />
              </div>

              {/* Twitter / X */}
              <div className="space-y-1.5">
                <Label className="text-xs flex items-center gap-1.5">
                  <Twitter size={13} className="text-sky-500" /> Twitter / X
                </Label>
                <Input
                  value={twitterUrl}
                  onChange={(e) => setTwitterUrl(e.target.value)}
                  placeholder="https://twitter.com/yourhandle"
                  className="h-10 rounded-xl"
                />
              </div>
            </div>

            <Button
              onClick={() => setStep(4)}
              className="w-full h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl"
            >
              Continue
            </Button>
          </div>
        )}

        {/* ── Step 4: Review ─────────────────────────────────────────────── */}
        {step === 4 && (
          <div className="space-y-5 animate-fade-up">
            <h2 className="text-xl font-bold">Review & Save</h2>

            {/* Class summary card */}
            <Card className="p-4 space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Class Details
              </h3>
              {coverUrl && (
                <img
                  src={coverUrl}
                  alt="Cover"
                  className="w-full h-32 rounded-lg object-cover"
                />
              )}
              <h4 className="font-bold">{title}</h4>
              {shortDesc && (
                <p className="text-sm text-muted-foreground">{shortDesc}</p>
              )}
              <div className="flex flex-wrap gap-1">
                {selectedCategoryId && (
                  <Badge variant="outline" className="text-xs">
                    {getCategoryName(selectedCategoryId)}
                  </Badge>
                )}
                {pendingRequestId && (
                  <Badge
                    variant="outline"
                    className="text-xs border-amber-300 text-amber-700"
                  >
                    <Clock size={10} className="mr-1" />
                    {pendingCategoryName} (pending)
                  </Badge>
                )}
                <Badge variant="outline" className="capitalize">
                  {classType.replace("_", " ")}
                </Badge>
              </div>

              {/* Location */}
              <div className="text-xs text-muted-foreground space-y-0.5">
                {venue && <p>Venue: {venue}</p>}
                <p>
                  Location:{" "}
                  {classLocation?.address || "Not set"}
                  {isHomeBased && ` (Home-based · ${homeRadiusKm} km radius)`}
                </p>
              </div>

              {/* Trial */}
              {trialAvailable && (
                <p className="text-xs text-muted-foreground">
                  Trial available{trialFee && parseFloat(trialFee) > 0 ? ` · ₹${trialFee}` : " · Free"}
                </p>
              )}

              {/* Social links summary */}
              {(promoUrl || facebookUrl || instagramUrl || twitterUrl) && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {promoUrl && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Youtube size={11} className="text-red-500" /> YouTube
                    </span>
                  )}
                  {facebookUrl && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Facebook size={11} className="text-blue-500" /> Facebook
                    </span>
                  )}
                  {instagramUrl && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Instagram size={11} className="text-pink-500" /> Instagram
                    </span>
                  )}
                  {twitterUrl && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Twitter size={11} className="text-sky-500" /> Twitter
                    </span>
                  )}
                </div>
              )}
            </Card>

            {/* Info box */}
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
              After saving, you'll be taken to the class page where you can add batches (schedule, pricing & capacity).
            </div>

            {/* Moderation note */}
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
              Content is reviewed by our moderation system before going live. Most classes are approved instantly.
            </div>

            {pendingRequestId && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                <span className="font-semibold">Pending category:</span> This class will be saved as a draft and published automatically once "{pendingCategoryName}" is approved.
              </div>
            )}

            <div className="flex gap-3 pb-4">
              <Button
                variant="outline"
                onClick={() => handleSave(false)}
                disabled={isSaving}
                className="flex-1 h-12 rounded-xl"
              >
                Save as Draft
              </Button>
              {!pendingRequestId ? (
                <Button
                  onClick={() => handleSave(true)}
                  disabled={isSaving}
                  className="flex-1 h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl"
                >
                  {isSaving ? <Loader2 size={20} className="animate-spin" /> : "Publish"}
                </Button>
              ) : (
                <Button
                  onClick={() => handleSave(false)}
                  disabled={isSaving}
                  className="flex-1 h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl"
                >
                  {isSaving ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    "Save & Wait for Approval"
                  )}
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Category Request Sheet */}
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
