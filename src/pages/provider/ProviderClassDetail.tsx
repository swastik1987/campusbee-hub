import * as React from "react";
import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  useClassDetail,
  useBatches,
  useClassAddons,
  useUpdateClassStatus,
  useUpdateClass,
  useUpdateBatchStatus,
  useUpdateBatch,
  DUPLICATE_BATCH_NAME_ERROR,
  useCreateAddon,
  useDeleteAddon,
} from "@/hooks/useClasses";
import {
  useUploadBannerImage,
} from "@/hooks/useFeatured";
import { useTrainers } from "@/hooks/useProvider";
import ClassLocationPicker from "@/components/location/ClassLocationPicker";
import type { LocationValue } from "@/hooks/useLocation";
import ClockTimePicker from "@/components/provider/ClockTimePicker";
import GradeMultiSelect from "@/components/provider/GradeMultiSelect";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Camera,
  Clock,
  Edit3,
  Facebook,
  Image,
  Instagram,
  Layers,
  Loader2,
  Package,
  Pause,
  Pencil,
  Play,
  Plus,
  Share2,
  Sparkles,
  Star,
  Trash2,
  Twitter,
  Users,
  Youtube,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FEE_LABELS: Record<string, string> = {
  per_session: "/session",
  monthly: "/month",
  quarterly: "/quarter",
  for_duration: " total",
  one_time: " one-time",
};

const FEATURED_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending_approval: { label: "Pending Admin Review", color: "bg-amber-100 text-amber-700" },
  fee_proposed: { label: "Fee Proposed — Review", color: "bg-blue-100 text-blue-700" },
  active: { label: "Featured", color: "bg-green-100 text-green-700" },
  expired: { label: "Expired", color: "bg-gray-100 text-gray-600" },
  cancelled: { label: "Cancelled", color: "bg-gray-100 text-gray-600" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-600" },
};

const ProviderClassDetail = React.forwardRef<HTMLDivElement, Record<string, never>>((_props, ref) => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, providerProfile } = useUser();

  const { data: cls, isLoading } = useClassDetail(classId);
  const { data: batches, isLoading: batchesLoading } = useBatches(classId);
  const { data: addons } = useClassAddons(classId);
  const updateStatus = useUpdateClassStatus();
  const updateClass = useUpdateClass();
  const updateBatchStatus = useUpdateBatchStatus();
  const updateBatch = useUpdateBatch();
  const createAddon = useCreateAddon();
  const deleteAddon = useDeleteAddon();
  const isAcademy = providerProfile?.provider_type === "academy";
  const { data: trainers } = useTrainers(providerProfile?.id);

  // Featured (v2: stubs — upload still works for banner image)
  const uploadBanner = useUploadBannerImage();

  // Addon form state
  const [addonName, setAddonName] = useState("");
  const [addonDesc, setAddonDesc] = useState("");
  const [addonFee, setAddonFee] = useState("");
  const [addonFeeType, setAddonFeeType] = useState("one_time");
  const [addonMandatory, setAddonMandatory] = useState(false);
  const [addonSheetOpen, setAddonSheetOpen] = useState(false);

  // Edit class state
  const [editClassOpen, setEditClassOpen] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editClassType, setEditClassType] = useState("recurring");
  const [editShortDesc, setEditShortDesc] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editVenue, setEditVenue] = useState("");
  const [editWhatToBring, setEditWhatToBring] = useState("");
  const [editTrialAvailable, setEditTrialAvailable] = useState(false);
  const [editTrialFee, setEditTrialFee] = useState("");
  // Social links
  const [editPromoUrl, setEditPromoUrl] = useState("");
  const [editFacebookUrl, setEditFacebookUrl] = useState("");
  const [editInstagramUrl, setEditInstagramUrl] = useState("");
  const [editTwitterUrl, setEditTwitterUrl] = useState("");
  // Location edit state
  const [editIsHomeBased, setEditIsHomeBased] = useState(false);
  const [editClassLocation, setEditClassLocation] = useState<LocationValue | null>(null);
  const [editHomeRadiusKm, setEditHomeRadiusKm] = useState(5);

  // New class dialog
  const [showBatchDialog, setShowBatchDialog] = useState(false);

  // Featured listing state
  const [featuredSheetOpen, setFeaturedSheetOpen] = useState(false);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState("");

  // Edit batch state
  const [editBatchOpen, setEditBatchOpen] = useState(false);
  const [editBatchId, setEditBatchId] = useState("");
  const [editBatchName, setEditBatchName] = useState("");
  const [editBatchType, setEditBatchType] = useState("level");
  const [editBatchSkillLevel, setEditBatchSkillLevel] = useState("");
  const [editBatchAgeMin, setEditBatchAgeMin] = useState("");
  const [editBatchAgeMax, setEditBatchAgeMax] = useState("");
  const [editBatchTrainerId, setEditBatchTrainerId] = useState("");
  const [editBatchCapacity, setEditBatchCapacity] = useState("");
  const [editBatchFee, setEditBatchFee] = useState("");
  const [editBatchFeeFreq, setEditBatchFeeFreq] = useState("");
  const [editBatchRegFee, setEditBatchRegFee] = useState("");
  const [editBatchStartDate, setEditBatchStartDate] = useState("");
  const [editBatchEndDate, setEditBatchEndDate] = useState("");
  const [editBatchTotalSessions, setEditBatchTotalSessions] = useState("");
  const [editBatchRegMode, setEditBatchRegMode] = useState("auto");
  const [editBatchAutoWaitlist, setEditBatchAutoWaitlist] = useState(true);
  const [editBatchNotes, setEditBatchNotes] = useState("");
  const [editBatchDays, setEditBatchDays] = useState<number[]>([]);
  const [editBatchStartTime, setEditBatchStartTime] = useState("06:00");
  const [editBatchEndTime, setEditBatchEndTime] = useState("07:00");

  // Show batch creation dialog when navigated from class creation
  useEffect(() => {
    if ((location.state as any)?.isNew) {
      setShowBatchDialog(true);
      // Clear the state so it won't re-trigger on refresh
      window.history.replaceState({}, "");
    }
  }, [location.state]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
          <Skeleton className="h-6 w-40" />
        </header>
        <div className="p-6 space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="h-4 w-full" />
        </div>
      </div>
    );
  }

  if (!cls) return null;

  const handleToggleStatus = async () => {
    const newStatus = cls.status === "published" ? "paused" : "published";
    try {
      await updateStatus.mutateAsync({ classId: cls.id, status: newStatus });
      toast.success(newStatus === "published" ? "Class published" : "Class paused");
    } catch {
      toast.error("Failed to update status");
    }
  };

  const openEditClass = () => {
    if (!cls) return;
    setEditTitle(cls.title || "");
    setEditClassType(cls.class_type || "recurring");
    setEditShortDesc(cls.short_description || "");
    setEditDesc(cls.description || "");
    setEditVenue(cls.venue_details || "");
    setEditWhatToBring(cls.what_to_bring || "");
    setEditTrialAvailable(cls.trial_available ?? false);
    setEditTrialFee(cls.trial_fee ? String(cls.trial_fee) : "0");
    setEditPromoUrl((cls as any).promo_video_url ?? "");
    setEditFacebookUrl((cls as any).facebook_url ?? "");
    setEditInstagramUrl((cls as any).instagram_url ?? "");
    setEditTwitterUrl((cls as any).twitter_url ?? "");
    setEditIsHomeBased((cls as any).is_home_based ?? false);
    setEditHomeRadiusKm((cls as any).home_radius_km ?? 5);
    // Pre-populate address text; lat/lng initialised if available
    const lat = (cls as any).location_lat;
    const lng = (cls as any).location_lng;
    setEditClassLocation(
      cls.address
        ? { address: cls.address, lat: lat ?? 0, lng: lng ?? 0 }
        : null
    );
    setEditClassOpen(true);
  };

  const handleSaveClass = async () => {
    if (!cls) return;
    try {
      await updateClass.mutateAsync({
        classId: cls.id,
        title: editTitle,
        classType: editClassType,
        shortDescription: editShortDesc,
        description: editDesc,
        venueDetails: editVenue,
        whatToBring: editWhatToBring,
        trialAvailable: editTrialAvailable,
        trialFee: editTrialAvailable ? parseFloat(editTrialFee) || 0 : 0,
        promoVideoUrl: editPromoUrl,
        facebookUrl: editFacebookUrl,
        instagramUrl: editInstagramUrl,
        twitterUrl: editTwitterUrl,
        address: editClassLocation?.address,
        isHomeBased: editIsHomeBased,
        locationLat: editClassLocation?.lat ?? null,
        locationLng: editClassLocation?.lng ?? null,
        homeRadiusKm: editIsHomeBased ? editHomeRadiusKm : 5,
      });
      toast.success("Class updated");
      setEditClassOpen(false);
    } catch {
      toast.error("Failed to update class");
    }
  };

  const openEditBatch = async (batch: any) => {
    setEditBatchId(batch.id);
    setEditBatchName(batch.batch_name || "");
    setEditBatchType(batch.batch_type || "level");
    setEditBatchSkillLevel(batch.skill_level || "");
    setEditBatchAgeMin(batch.age_group_min ? String(batch.age_group_min) : "");
    setEditBatchAgeMax(batch.age_group_max ? String(batch.age_group_max) : "");
    setEditBatchTrainerId(batch.trainer_id || "");
    setEditBatchCapacity(String(batch.max_batch_size || ""));
    setEditBatchFee(String(batch.fee_amount || ""));
    setEditBatchFeeFreq(batch.fee_frequency || "monthly");
    setEditBatchRegFee(String(batch.registration_fee ?? 0));
    setEditBatchStartDate(batch.start_date || "");
    setEditBatchEndDate(batch.end_date || "");
    setEditBatchTotalSessions(batch.total_sessions ? String(batch.total_sessions) : "");
    setEditBatchRegMode(batch.registration_mode || "auto");
    setEditBatchAutoWaitlist(batch.auto_waitlist ?? true);
    setEditBatchNotes(batch.notes || "");
    // Load existing schedules
    const { data: scheds } = await supabase
      .from("batch_schedules")
      .select("day_of_week, start_time, end_time")
      .eq("batch_id", batch.id);
    if (scheds && scheds.length > 0) {
      setEditBatchDays(scheds.map((s) => s.day_of_week));
      setEditBatchStartTime(scheds[0].start_time?.slice(0, 5) || "06:00");
      setEditBatchEndTime(scheds[0].end_time?.slice(0, 5) || "07:00");
    } else {
      setEditBatchDays([]);
      setEditBatchStartTime("06:00");
      setEditBatchEndTime("07:00");
    }
    setEditBatchOpen(true);
  };

  const toggleEditDay = (day: number) => {
    setEditBatchDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSaveBatch = async () => {
    try {
      await updateBatch.mutateAsync({
        batchId: editBatchId,
        batchName: editBatchName,
        batchType: editBatchType,
        skillLevel: editBatchSkillLevel || null,
        ageGroupMin: editBatchAgeMin ? parseInt(editBatchAgeMin) : null,
        ageGroupMax: editBatchAgeMax ? parseInt(editBatchAgeMax) : null,
        trainerId: editBatchTrainerId || null,
        maxBatchSize: parseInt(editBatchCapacity) || 10,
        feeAmount: parseFloat(editBatchFee) || 0,
        feeFrequency: editBatchFeeFreq,
        registrationFee: parseFloat(editBatchRegFee) || 0,
        startDate: editBatchStartDate || null,
        endDate: editBatchEndDate || null,
        totalSessions: editBatchTotalSessions ? parseInt(editBatchTotalSessions) : null,
        registrationMode: editBatchRegMode,
        autoWaitlist: editBatchAutoWaitlist,
        notes: editBatchNotes,
        schedules: editBatchDays.map((d) => ({
          dayOfWeek: d,
          startTime: editBatchStartTime,
          endTime: editBatchEndTime,
        })),
      });
      toast.success("Batch updated");
      setEditBatchOpen(false);
    } catch (error) {
      if (error instanceof Error && error.name === DUPLICATE_BATCH_NAME_ERROR) {
        toast.error("Batch name already exists for this class. Please choose a different name.");
        return;
      }
      toast.error("Failed to update batch");
    }
  };

  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  // In v2, featured requests go through the sponsored_listings workflow
  // managed from /provider/sponsored — see useProviderSponsoredRequests
  const handleRequestFeatured = async () => {
    if (!bannerFile || !cls) return;
    try {
      // Upload banner image for future use
      await uploadBanner.mutateAsync({ classId: cls.id, file: bannerFile });
      toast.success("Banner uploaded. Go to Sponsored tab to submit a featured listing request.");
      setFeaturedSheetOpen(false);
      setBannerFile(null);
      setBannerPreview("");
    } catch {
      toast.error("Failed to upload banner");
    }
  };

  const handleAddAddon = async () => {
    if (!addonName.trim() || !addonFee) return;
    try {
      await createAddon.mutateAsync({
        classId: cls.id,
        name: addonName.trim(),
        description: addonDesc,
        feeAmount: parseFloat(addonFee),
        feeType: addonFeeType,
        isMandatory: addonMandatory,
      });
      toast.success("Add-on created");
      setAddonName("");
      setAddonDesc("");
      setAddonFee("");
      setAddonSheetOpen(false);
    } catch {
      toast.error("Failed to create add-on");
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/class/${cls.id}`;
    const text = `Check out ${cls.title} on CampusBee!`;
    if (navigator.share) {
      navigator.share({ title: cls.title, text, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url)
        .then(() => toast.success("Class link copied!"))
        .catch(() => toast.error("Failed to copy link"));
    }
  };

  return (
    <div ref={ref} className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-bold truncate flex-1">{cls.title}</h1>
        <Badge className={`text-xs ${cls.status === "published" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"} border-0`}>
          {cls.status}
        </Badge>
        {cls.status === "published" && (
          <button
            onClick={handleShare}
            className="flex items-center gap-1 rounded-lg border border-provider/40 bg-provider/5 px-2.5 py-1.5 text-xs font-semibold text-provider hover:bg-provider/10 transition-colors"
            title="Share class link"
          >
            <Share2 size={13} />
            <span>Share</span>
          </button>
        )}
      </header>

      {/* Cover */}
      {cls.cover_image_url && (
        <img src={cls.cover_image_url} alt="" className="w-full h-40 object-cover" />
      )}

      <div className="mx-auto w-full max-w-lg px-4 py-4">
        {/* Quick actions */}
        <div className="flex gap-2 mb-4">
          <Button
            size="sm"
            variant="outline"
            onClick={openEditClass}
            className="flex-1"
          >
            <Pencil size={14} className="mr-1" /> Edit
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={handleToggleStatus}
            disabled={updateStatus.isPending}
            className="flex-1"
          >
            {cls.status === "published" ? (
              <><Pause size={14} className="mr-1" /> Pause</>
            ) : (
              <><Play size={14} className="mr-1" /> Publish</>
            )}
          </Button>
          <Button
            size="sm"
            onClick={() => navigate(`/provider/classes/${cls.id}/batch/new`)}
            className="flex-1 bg-provider hover:bg-provider/90 text-white"
          >
            <Plus size={14} className="mr-1" /> Batch
          </Button>
        </div>

        <Tabs defaultValue="batches">
          <TabsList className="w-full">
            <TabsTrigger value="batches" className="flex-1">Batches</TabsTrigger>
            <TabsTrigger value="addons" className="flex-1">Add-ons</TabsTrigger>
            <TabsTrigger value="featured" className="flex-1">Featured</TabsTrigger>
            <TabsTrigger value="info" className="flex-1">Info</TabsTrigger>
          </TabsList>

          {/* Batches Tab */}
          <TabsContent value="batches" className="space-y-3 mt-4">
            {batchesLoading ? (
              <Skeleton className="h-24 rounded-xl" />
            ) : batches && batches.length > 0 ? (
              batches.map((batch) => (
                <Card key={batch.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-semibold text-sm">{batch.batch_name}</h4>
                      <p className="text-xs text-muted-foreground capitalize">
                        {batch.skill_level?.replace("_", " ")} · {batch.batch_type?.replace("_", " ")}
                      </p>
                    </div>
                    <Badge className={`text-[10px] border-0 ${
                      batch.status === "active" ? "bg-green-100 text-green-700" :
                      batch.status === "full" ? "bg-amber-100 text-amber-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {batch.status}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users size={12} />
                      {batch.current_enrollment_count}/{batch.max_batch_size}
                    </span>
                    <span className="font-semibold text-foreground">
                      ₹{batch.fee_amount}{FEE_LABELS[batch.fee_frequency] ?? ""}
                    </span>
                  </div>
                  {(batch.trainers as any)?.name && (
                    <p className="text-xs text-muted-foreground">
                      Trainer: {(batch.trainers as any).name}
                    </p>
                  )}
                  {(() => {
                    const schedules: any[] = (batch as any).batch_schedules ?? [];
                    if (!schedules.length) return null;
                    const days = schedules
                      .map((s: any) => DAY_NAMES[s.day_of_week])
                      .join(", ");
                    const s0 = schedules[0];
                    const time = `${s0.start_time?.slice(0, 5)} – ${s0.end_time?.slice(0, 5)}`;
                    return (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar size={11} />
                          {days}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={11} />
                          {time}
                        </span>
                      </div>
                    );
                  })()}
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" variant="outline" className="text-xs h-7"
                      onClick={() => openEditBatch(batch)}>
                      <Pencil size={12} className="mr-1" /> Edit
                    </Button>
                    {batch.status === "active" && (
                      <Button size="sm" variant="outline" className="text-xs h-7"
                        onClick={() => updateBatchStatus.mutateAsync({ batchId: batch.id, status: "paused" })}>
                        Pause
                      </Button>
                    )}
                    {batch.status === "paused" && (
                      <Button size="sm" variant="outline" className="text-xs h-7"
                        onClick={() => updateBatchStatus.mutateAsync({ batchId: batch.id, status: "active" })}>
                        Activate
                      </Button>
                    )}
                    {batch.status === "draft" && (
                      <Button size="sm" className="text-xs h-7 bg-provider text-white"
                        onClick={() => updateBatchStatus.mutateAsync({ batchId: batch.id, status: "active" })}>
                        Activate
                      </Button>
                    )}
                  </div>
                </Card>
              ))
            ) : (
              <div className="flex flex-col items-center gap-4 py-10 text-center px-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-provider/10">
                  <Layers size={28} className="text-provider" />
                </div>
                <div className="space-y-1">
                  <p className="text-base font-semibold">No batches yet</p>
                  <p className="text-sm text-muted-foreground">
                    Batches are the scheduled groups under this class — each with its own timing, capacity, and fee. Students enroll into a batch, not the class itself.
                  </p>
                </div>
                <Button
                  onClick={() => navigate(`/provider/classes/${cls.id}/batch/new`)}
                  className="bg-provider hover:bg-provider/90 text-white gap-1.5 px-6"
                >
                  <Plus size={15} /> Create Your First Batch
                </Button>
                <button
                  className="text-xs text-muted-foreground underline underline-offset-2"
                  onClick={() => setShowBatchDialog(true)}
                >
                  What's the difference between a class and a batch?
                </button>
              </div>
            )}
          </TabsContent>

          {/* Addons Tab */}
          <TabsContent value="addons" className="space-y-3 mt-4">
            {addons && addons.length > 0 ? (
              addons.map((addon) => (
                <Card key={addon.id} className="flex items-center gap-3 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-provider/10">
                    <Package size={16} className="text-provider" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{addon.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ₹{addon.fee_amount} · {addon.fee_type?.replace("_", " ")}
                      {addon.is_mandatory && " · Mandatory"}
                    </p>
                  </div>
                  <button onClick={() => deleteAddon.mutate(addon.id)} className="p-1 text-muted-foreground hover:text-destructive">
                    <Trash2 size={14} />
                  </button>
                </Card>
              ))
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No add-ons</p>
            )}

            <Sheet open={addonSheetOpen} onOpenChange={setAddonSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full border-dashed border-provider text-provider">
                  <Plus size={14} className="mr-1" /> Add Add-on
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="rounded-t-2xl">
                <SheetHeader><SheetTitle>New Add-on</SheetTitle></SheetHeader>
                <div className="space-y-3 py-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Name</Label>
                    <Input value={addonName} onChange={(e) => setAddonName(e.target.value)} placeholder="e.g. Equipment Kit" className="h-10 rounded-lg" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Description</Label>
                    <Input value={addonDesc} onChange={(e) => setAddonDesc(e.target.value)} placeholder="Optional" className="h-10 rounded-lg" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Fee (₹)</Label>
                      <Input type="number" value={addonFee} onChange={(e) => setAddonFee(e.target.value)} placeholder="500" className="h-10 rounded-lg" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Fee Type</Label>
                      <Select value={addonFeeType} onValueChange={setAddonFeeType}>
                        <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="one_time">One-time</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                          <SelectItem value="per_event">Per Event</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Mandatory?</Label>
                    <Switch checked={addonMandatory} onCheckedChange={setAddonMandatory} />
                  </div>
                  <Button onClick={handleAddAddon} disabled={!addonName.trim() || !addonFee || createAddon.isPending} className="w-full bg-provider text-white rounded-lg">
                    {createAddon.isPending ? <Loader2 size={16} className="animate-spin" /> : "Add"}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </TabsContent>

          {/* Featured Tab */}
          <TabsContent value="featured" className="space-y-4 mt-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-amber-600" />
                <p className="text-sm font-semibold text-amber-800">Sponsored Listings</p>
              </div>
              <p className="text-xs text-amber-700">
                In v2, featured spots are managed as <strong>sponsored listings</strong>. Visit{" "}
                <strong>/provider/sponsored</strong> to request a sponsored slot for this class.
              </p>
            </div>

            {/* Banner upload (can still upload a banner image here) */}
            {cls.status === "published" && (
              <Button
                onClick={() => setFeaturedSheetOpen(true)}
                className="w-full border-dashed border-provider text-provider"
                variant="outline"
              >
                <Sparkles size={14} className="mr-1" /> Upload Banner Image
              </Button>
            )}
          </TabsContent>

          {/* Info Tab */}
          <TabsContent value="info" className="space-y-4 mt-4">
            <div>
              <Label className="text-xs text-muted-foreground">Category</Label>
              <p className="text-sm font-medium">{(cls.class_categories as any)?.name}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Type</Label>
              <p className="text-sm font-medium capitalize">{cls.class_type?.replace("_", " ")}</p>
            </div>
            {cls.short_description && (
              <div>
                <Label className="text-xs text-muted-foreground">Short Description</Label>
                <p className="text-sm">{cls.short_description}</p>
              </div>
            )}
            {cls.description && (
              <div>
                <Label className="text-xs text-muted-foreground">Full Description</Label>
                <p className="text-sm whitespace-pre-wrap">{cls.description}</p>
              </div>
            )}
            {cls.venue_details && (
              <div>
                <Label className="text-xs text-muted-foreground">Venue</Label>
                <p className="text-sm">{cls.venue_details}</p>
              </div>
            )}
            {cls.what_to_bring && (
              <div>
                <Label className="text-xs text-muted-foreground">What to Bring</Label>
                <p className="text-sm">{cls.what_to_bring}</p>
              </div>
            )}
            <div className="flex gap-3">
              {(cls.rating_count ?? 0) > 0 && (
                <div className="flex items-center gap-1">
                  <Star size={14} className="text-amber-500 fill-amber-500" />
                  <span className="text-sm font-medium">{cls.total_rating}</span>
                  <span className="text-xs text-muted-foreground">({cls.rating_count} reviews)</span>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Edit Class Sheet */}
      <Sheet open={editClassOpen} onOpenChange={setEditClassOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Class</SheetTitle></SheetHeader>
          <div className="space-y-3 py-4">
            {/* Title */}
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-10 rounded-lg" />
            </div>

            {/* Class Type */}
            <div className="space-y-1">
              <Label className="text-xs">Class Type</Label>
              <Select value={editClassType} onValueChange={setEditClassType}>
                <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="recurring">Recurring (ongoing batches)</SelectItem>
                  <SelectItem value="fixed_duration">Fixed Duration (e.g. 3-month course)</SelectItem>
                  <SelectItem value="one_time">One-Time (single session)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* What to Bring */}
            <div className="space-y-1">
              <Label className="text-xs">What to Bring</Label>
              <Input value={editWhatToBring} onChange={(e) => setEditWhatToBring(e.target.value)} placeholder="e.g. Racquet, sportswear" className="h-10 rounded-lg" />
            </div>

            {/* Short Description */}
            <div className="space-y-1">
              <Label className="text-xs">Short Description</Label>
              <Input value={editShortDesc} onChange={(e) => setEditShortDesc(e.target.value.slice(0, 300))} className="h-10 rounded-lg" />
              <p className="text-[10px] text-muted-foreground text-right">{editShortDesc.length}/300</p>
            </div>

            {/* Full Description */}
            <div className="space-y-1">
              <Label className="text-xs">Full Description</Label>
              <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={4} className="rounded-lg" />
            </div>

            {/* Trial */}
            <div className="flex items-center justify-between">
              <Label className="text-xs">Offer trial / demo classes?</Label>
              <Switch checked={editTrialAvailable} onCheckedChange={setEditTrialAvailable} />
            </div>
            {editTrialAvailable && (
              <div className="space-y-1">
                <Label className="text-xs">Trial Fee (₹)</Label>
                <Input type="number" value={editTrialFee} onChange={(e) => setEditTrialFee(e.target.value)} placeholder="0 for free" className="h-10 rounded-lg" />
              </div>
            )}

            {/* Venue Details */}
            <div className="space-y-1 pt-2 border-t">
              <Label className="text-xs">Venue Details</Label>
              <Input value={editVenue} onChange={(e) => setEditVenue(e.target.value)} placeholder="e.g. Community Hall, Block A" className="h-10 rounded-lg" />
            </div>

            {/* Location section */}
            <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Home-based / I travel to students</Label>
                <Switch checked={editIsHomeBased} onCheckedChange={setEditIsHomeBased} />
              </div>
              <div>
                <Label className="text-xs">Class Location <span className="text-red-500">*</span></Label>
              </div>
              <ClassLocationPicker
                isHomeBased={editIsHomeBased}
                location={editClassLocation}
                homeRadiusKm={editHomeRadiusKm}
                onLocationChange={setEditClassLocation}
                onRadiusChange={setEditHomeRadiusKm}
              />
            </div>

            {/* Social Media */}
            <div className="space-y-2 pt-2 border-t">
              <Label className="text-xs font-semibold">Social Media</Label>
              <div className="space-y-1.5">
                <Label className="text-[11px] flex items-center gap-1.5 text-muted-foreground">
                  <Youtube size={11} className="text-red-500" /> YouTube / Promo Video
                </Label>
                <Input value={editPromoUrl} onChange={(e) => setEditPromoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..." className="h-9 rounded-lg text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] flex items-center gap-1.5 text-muted-foreground">
                  <Facebook size={11} className="text-blue-500" /> Facebook
                </Label>
                <Input value={editFacebookUrl} onChange={(e) => setEditFacebookUrl(e.target.value)} placeholder="https://facebook.com/yourpage" className="h-9 rounded-lg text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] flex items-center gap-1.5 text-muted-foreground">
                  <Instagram size={11} className="text-pink-500" /> Instagram
                </Label>
                <Input value={editInstagramUrl} onChange={(e) => setEditInstagramUrl(e.target.value)} placeholder="https://instagram.com/yourhandle" className="h-9 rounded-lg text-xs" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] flex items-center gap-1.5 text-muted-foreground">
                  <Twitter size={11} className="text-sky-500" /> Twitter / X
                </Label>
                <Input value={editTwitterUrl} onChange={(e) => setEditTwitterUrl(e.target.value)} placeholder="https://twitter.com/yourhandle" className="h-9 rounded-lg text-xs" />
              </div>
            </div>

            <Button onClick={handleSaveClass} disabled={!editTitle.trim() || !editClassLocation || updateClass.isPending} className="w-full bg-provider text-white rounded-lg">
              {updateClass.isPending ? <Loader2 size={16} className="animate-spin" /> : "Save Changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Request Featured Sheet */}
      <Sheet open={featuredSheetOpen} onOpenChange={setFeaturedSheetOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Request Featured Listing</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              Upload a banner image (3:1 ratio recommended) for your class. Then visit <strong>/provider/sponsored</strong> to submit a sponsored listing request.
            </p>
            <div className="space-y-2">
              <Label className="text-xs">Banner Image</Label>
              <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed p-6 transition-colors hover:border-provider">
                {bannerPreview ? (
                  <img src={bannerPreview} alt="Banner preview" className="w-full rounded-lg aspect-[3/1] object-cover" />
                ) : (
                  <>
                    <Image size={28} className="text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Upload banner (3:1 ratio)</span>
                    <span className="text-xs text-muted-foreground">e.g. 1200 x 400 px</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" onChange={handleBannerSelect} />
              </label>
            </div>
            <Button
              onClick={handleRequestFeatured}
              disabled={!bannerFile || uploadBanner.isPending}
              className="w-full bg-provider text-white rounded-lg"
            >
              {uploadBanner.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Sparkles size={14} className="mr-1" /> Upload Banner
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Classes vs Batches explainer dialog */}
      <Dialog open={showBatchDialog} onOpenChange={setShowBatchDialog}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Layers size={18} className="text-provider" />
              Classes &amp; Batches — how it works
            </DialogTitle>
          </DialogHeader>
          <DialogDescription asChild>
            <div className="space-y-3 text-sm text-foreground">
              <div className="rounded-xl bg-provider/8 border border-provider/20 p-3 space-y-1">
                <p className="font-semibold text-provider flex items-center gap-1.5">
                  <BookOpen size={14} /> Class = the "What"
                </p>
                <p className="text-muted-foreground text-xs">
                  Describes what you teach — name, category, description, photos, location, and pricing structure. Seekers browse and discover classes.
                </p>
              </div>
              <div className="rounded-xl bg-provider/8 border border-provider/20 p-3 space-y-1">
                <p className="font-semibold text-provider flex items-center gap-1.5">
                  <Calendar size={14} /> Batch = the "When &amp; Who"
                </p>
                <p className="text-muted-foreground text-xs">
                  A scheduled group under the class — with its own days, timings, capacity, and fee. Students enroll into a <strong>batch</strong>, not the class itself.
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                You can run <strong>multiple batches</strong> under one class — e.g. a "Morning Beginners" batch and an "Evening Advanced" batch, each with different seats and fees.
              </p>
            </div>
          </DialogDescription>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full bg-provider hover:bg-provider/90 text-white gap-1.5"
              onClick={() => {
                setShowBatchDialog(false);
                navigate(`/provider/classes/${cls.id}/batch/new`);
              }}
            >
              <Plus size={15} /> Create First Batch
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={() => setShowBatchDialog(false)}>
              I'll do it later
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Batch Sheet */}
      <Sheet open={editBatchOpen} onOpenChange={setEditBatchOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Batch</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Batch Name</Label>
              <Input value={editBatchName} onChange={(e) => setEditBatchName(e.target.value)} className="h-11 rounded-xl" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Batch Type</Label>
                <Select value={editBatchType} onValueChange={setEditBatchType}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="level">Level</SelectItem>
                    <SelectItem value="age_group">Age Group</SelectItem>
                    <SelectItem value="time_slot">Time Slot</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editBatchType === "level" && (
                <div className="space-y-2">
                  <Label>Skill Level</Label>
                  <Select value={editBatchSkillLevel} onValueChange={setEditBatchSkillLevel}>
                    <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Beginner</SelectItem>
                      <SelectItem value="intermediate">Intermediate</SelectItem>
                      <SelectItem value="advanced">Advanced</SelectItem>
                      <SelectItem value="all">All Levels</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {editBatchType === "age_group" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Min Age</Label>
                  <Input type="number" value={editBatchAgeMin} onChange={(e) => setEditBatchAgeMin(e.target.value)} className="h-11 rounded-xl" />
                </div>
                <div className="space-y-2">
                  <Label>Max Age</Label>
                  <Input type="number" value={editBatchAgeMax} onChange={(e) => setEditBatchAgeMax(e.target.value)} className="h-11 rounded-xl" />
                </div>
              </div>
            )}

            {isAcademy && trainers && trainers.length > 0 && (
              <div className="space-y-2">
                <Label>Assign Trainer</Label>
                <Select value={editBatchTrainerId} onValueChange={setEditBatchTrainerId}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select trainer" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {trainers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Schedule */}
            <div className="space-y-2">
              <Label>Schedule</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: 1, label: "Mon" },
                  { value: 2, label: "Tue" },
                  { value: 3, label: "Wed" },
                  { value: 4, label: "Thu" },
                  { value: 5, label: "Fri" },
                  { value: 6, label: "Sat" },
                  { value: 0, label: "Sun" },
                ].map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => toggleEditDay(d.value)}
                    className={`h-10 w-10 rounded-lg text-xs font-semibold transition-all ${
                      editBatchDays.includes(d.value)
                        ? "bg-provider text-white"
                        : "bg-muted text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Start Time</Label>
                  <ClockTimePicker value={editBatchStartTime} onChange={setEditBatchStartTime} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">End Time</Label>
                  <ClockTimePicker value={editBatchEndTime} onChange={setEditBatchEndTime} />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Max Batch Size</Label>
              <Input type="number" value={editBatchCapacity} onChange={(e) => setEditBatchCapacity(e.target.value)} className="h-11 rounded-xl" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Class Fee (₹)</Label>
                <Input type="number" value={editBatchFee} onChange={(e) => setEditBatchFee(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>Fee Frequency</Label>
                <Select value={editBatchFeeFreq} onValueChange={setEditBatchFeeFreq}>
                  <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="per_session">Per Session</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="for_duration">For Duration</SelectItem>
                    <SelectItem value="one_time">One-time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Registration Fee (₹)</Label>
              <Input type="number" value={editBatchRegFee} onChange={(e) => setEditBatchRegFee(e.target.value)} placeholder="0" className="h-11 rounded-xl" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Date</Label>
                <Input type="date" value={editBatchStartDate} onChange={(e) => setEditBatchStartDate(e.target.value)} className="h-11 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label>End Date</Label>
                <Input type="date" value={editBatchEndDate} onChange={(e) => setEditBatchEndDate(e.target.value)} className="h-11 rounded-xl" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Total Sessions</Label>
              <Input type="number" value={editBatchTotalSessions} onChange={(e) => setEditBatchTotalSessions(e.target.value)} placeholder="Optional" className="h-11 rounded-xl" />
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border">
              <div>
                <p className="text-sm font-medium">Registration Mode</p>
                <p className="text-[10px] text-muted-foreground">
                  {editBatchRegMode === "auto" ? "Auto-accept enrollments" : "Manual approval required"}
                </p>
              </div>
              <Select value={editBatchRegMode} onValueChange={setEditBatchRegMode}>
                <SelectTrigger className="w-24 h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between p-3 rounded-xl border">
              <div>
                <p className="text-sm font-medium">Auto-Waitlist</p>
                <p className="text-[10px] text-muted-foreground">Add to waitlist when full</p>
              </div>
              <Switch checked={editBatchAutoWaitlist} onCheckedChange={setEditBatchAutoWaitlist} />
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={editBatchNotes} onChange={(e) => setEditBatchNotes(e.target.value)} rows={2} className="rounded-xl" />
            </div>

            <Button onClick={handleSaveBatch} disabled={!editBatchName.trim() || updateBatch.isPending} className="w-full bg-provider text-white rounded-xl">
              {updateBatch.isPending ? <Loader2 size={16} className="animate-spin" /> : "Save Changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
});

ProviderClassDetail.displayName = "ProviderClassDetail";

export default ProviderClassDetail;
