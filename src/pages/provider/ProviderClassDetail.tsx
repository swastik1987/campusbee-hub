import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  useClassDetail,
  useBatches,
  useClassAddons,
  useUpdateClassStatus,
  useUpdateClass,
  useUpdateBatchStatus,
  useUpdateBatch,
  useCreateAddon,
  useDeleteAddon,
} from "@/hooks/useClasses";
import {
  useRequestFeaturedListing,
  useProviderFeaturedRequests,
  useUploadBannerImage,
  useProviderRespondToFeaturedFee,
} from "@/hooks/useFeatured";
import { useProviderRegistrations, useTrainers } from "@/hooks/useProvider";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  Image,
  Loader2,
  Package,
  Pause,
  Pencil,
  Play,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Users,
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

const ProviderClassDetail = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
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

  // Featured listing hooks
  const { data: registrations } = useProviderRegistrations(providerProfile?.id);
  const approvedRegIds = registrations?.filter((r) => r.status === "approved").map((r) => r.id) ?? [];
  const { data: featuredRequests } = useProviderFeaturedRequests(providerProfile?.id, approvedRegIds);
  const requestFeatured = useRequestFeaturedListing();
  const uploadBanner = useUploadBannerImage();
  const respondToFee = useProviderRespondToFeaturedFee();

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
  const [editShortDesc, setEditShortDesc] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editVenue, setEditVenue] = useState("");
  const [editWhatToBring, setEditWhatToBring] = useState("");
  const [editTrialAvailable, setEditTrialAvailable] = useState(false);
  const [editTrialFee, setEditTrialFee] = useState("");

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
    setEditShortDesc(cls.short_description || "");
    setEditDesc(cls.description || "");
    setEditVenue(cls.venue_details || "");
    setEditWhatToBring(cls.what_to_bring || "");
    setEditTrialAvailable(cls.trial_available ?? false);
    setEditTrialFee(cls.trial_fee ? String(cls.trial_fee) : "0");
    setEditClassOpen(true);
  };

  const handleSaveClass = async () => {
    if (!cls) return;
    try {
      await updateClass.mutateAsync({
        classId: cls.id,
        title: editTitle,
        shortDescription: editShortDesc,
        description: editDesc,
        venueDetails: editVenue,
        whatToBring: editWhatToBring,
        trialAvailable: editTrialAvailable,
        trialFee: editTrialAvailable ? parseFloat(editTrialFee) || 0 : 0,
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
      .eq("batch_id", batch.id)
      .eq("is_active", true);
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
    } catch {
      toast.error("Failed to update batch");
    }
  };

  // Featured listing for this class
  const classFeatured = featuredRequests?.filter((r) => r.class_id === classId) ?? [];
  const hasActiveFeatured = classFeatured.some((r) => r.status === "active" || r.status === "pending_approval" || r.status === "fee_proposed");

  const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBannerFile(file);
    setBannerPreview(URL.createObjectURL(file));
  };

  const handleRequestFeatured = async () => {
    if (!bannerFile || !cls || !profile) return;
    const par = cls.provider_apartment_registrations as any;
    const apartmentId = par?.apartment_id;
    const regId = cls.provider_registration_id;
    if (!apartmentId || !regId) {
      toast.error("Missing apartment info");
      return;
    }
    try {
      const bannerUrl = await uploadBanner.mutateAsync({ classId: cls.id, file: bannerFile });
      await requestFeatured.mutateAsync({
        classId: cls.id,
        apartmentId,
        providerRegistrationId: regId,
        bannerImageUrl: bannerUrl,
        requestedBy: profile.id,
      });
      toast.success("Featured request submitted! The apartment admin will review it.");
      setFeaturedSheetOpen(false);
      setBannerFile(null);
      setBannerPreview("");
    } catch {
      toast.error("Failed to submit featured request");
    }
  };

  const handleRespondToFee = async (listingId: string, accept: boolean) => {
    try {
      await respondToFee.mutateAsync({ listingId, accept });
      toast.success(accept ? "Fee accepted — your class is now featured!" : "Fee rejected");
    } catch {
      toast.error("Failed to respond");
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-bold truncate flex-1">{cls.title}</h1>
        <Badge className={`text-xs ${cls.status === "published" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"} border-0`}>
          {cls.status}
        </Badge>
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
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <Calendar size={24} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No batches yet</p>
                <Button
                  size="sm"
                  onClick={() => navigate(`/provider/classes/${cls.id}/batch/new`)}
                  className="bg-provider text-white"
                >
                  <Plus size={14} className="mr-1" /> Add Batch
                </Button>
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
            {/* Existing featured requests for this class */}
            {classFeatured.length > 0 ? (
              <div className="space-y-3">
                {classFeatured.map((req) => {
                  const st = FEATURED_STATUS_LABELS[req.status ?? ""] ?? { label: req.status, color: "bg-gray-100 text-gray-600" };
                  return (
                    <Card key={req.id} className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold">Featured Request</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(req.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge className={`text-[10px] border-0 ${st.color}`}>{st.label}</Badge>
                      </div>
                      {req.banner_image_url && (
                        <img src={req.banner_image_url} alt="Banner" className="w-full rounded-lg aspect-[3/1] object-cover" />
                      )}
                      {req.status === "fee_proposed" && (
                        <div className="space-y-2 rounded-lg bg-blue-50 p-3">
                          <p className="text-sm font-medium">Admin proposed ad fee: <span className="text-provider font-bold">₹{req.ad_fee}</span></p>
                          {req.valid_from && req.valid_until && (
                            <p className="text-xs text-muted-foreground">
                              Valid: {new Date(req.valid_from).toLocaleDateString()} — {new Date(req.valid_until).toLocaleDateString()}
                            </p>
                          )}
                          {req.admin_notes && (
                            <p className="text-xs text-muted-foreground">Note: {req.admin_notes}</p>
                          )}
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              className="flex-1 bg-provider text-white text-xs h-8"
                              onClick={() => handleRespondToFee(req.id, true)}
                              disabled={respondToFee.isPending}
                            >
                              Accept Fee
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-xs h-8"
                              onClick={() => handleRespondToFee(req.id, false)}
                              disabled={respondToFee.isPending}
                            >
                              Reject
                            </Button>
                          </div>
                        </div>
                      )}
                      {req.status === "active" && req.valid_until && (
                        <p className="text-xs text-green-700">
                          Active until {new Date(req.valid_until).toLocaleDateString()}
                        </p>
                      )}
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <Sparkles size={24} className="text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No featured requests yet</p>
              </div>
            )}

            {/* Request Featured button — only for published classes with no active/pending request */}
            {cls.status === "published" && !hasActiveFeatured && (
              <Button
                onClick={() => setFeaturedSheetOpen(true)}
                className="w-full border-dashed border-provider text-provider"
                variant="outline"
              >
                <Sparkles size={14} className="mr-1" /> Request Featured Listing
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
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="h-10 rounded-lg" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Short Description</Label>
              <Input value={editShortDesc} onChange={(e) => setEditShortDesc(e.target.value.slice(0, 300))} className="h-10 rounded-lg" />
              <p className="text-[10px] text-muted-foreground text-right">{editShortDesc.length}/300</p>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Full Description</Label>
              <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={4} className="rounded-lg" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Venue Details</Label>
              <Input value={editVenue} onChange={(e) => setEditVenue(e.target.value)} placeholder="e.g. Community Hall, Block A" className="h-10 rounded-lg" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">What to Bring</Label>
              <Input value={editWhatToBring} onChange={(e) => setEditWhatToBring(e.target.value)} placeholder="e.g. Racquet, sportswear" className="h-10 rounded-lg" />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs">Trial Available?</Label>
              <Switch checked={editTrialAvailable} onCheckedChange={setEditTrialAvailable} />
            </div>
            {editTrialAvailable && (
              <div className="space-y-1">
                <Label className="text-xs">Trial Fee (₹)</Label>
                <Input type="number" value={editTrialFee} onChange={(e) => setEditTrialFee(e.target.value)} placeholder="0 for free" className="h-10 rounded-lg" />
              </div>
            )}
            <Button onClick={handleSaveClass} disabled={!editTitle.trim() || updateClass.isPending} className="w-full bg-provider text-white rounded-lg">
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
              Upload a banner image (3:1 ratio recommended) for your class. The apartment admin will review your request and propose an ad fee.
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
              disabled={!bannerFile || requestFeatured.isPending || uploadBanner.isPending}
              className="w-full bg-provider text-white rounded-lg"
            >
              {(requestFeatured.isPending || uploadBanner.isPending) ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Sparkles size={14} className="mr-1" /> Submit Request
                </>
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Edit Batch Sheet */}
      <Sheet open={editBatchOpen} onOpenChange={setEditBatchOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Batch</SheetTitle></SheetHeader>
          <div className="space-y-3 py-4">
            <div className="space-y-1">
              <Label className="text-xs">Batch Name</Label>
              <Input value={editBatchName} onChange={(e) => setEditBatchName(e.target.value)} className="h-10 rounded-lg" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Batch Type</Label>
                <Select value={editBatchType} onValueChange={setEditBatchType}>
                  <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="level">Level</SelectItem>
                    <SelectItem value="age_group">Age Group</SelectItem>
                    <SelectItem value="time_slot">Time Slot</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {editBatchType === "level" && (
                <div className="space-y-1">
                  <Label className="text-xs">Skill Level</Label>
                  <Select value={editBatchSkillLevel} onValueChange={setEditBatchSkillLevel}>
                    <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Select" /></SelectTrigger>
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

            {editBatchType === "age_group" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Min Age</Label>
                  <Input type="number" value={editBatchAgeMin} onChange={(e) => setEditBatchAgeMin(e.target.value)} className="h-10 rounded-lg" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Max Age</Label>
                  <Input type="number" value={editBatchAgeMax} onChange={(e) => setEditBatchAgeMax(e.target.value)} className="h-10 rounded-lg" />
                </div>
              </div>
            )}

            {isAcademy && trainers && trainers.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Assign Trainer</Label>
                <Select value={editBatchTrainerId} onValueChange={setEditBatchTrainerId}>
                  <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Select trainer" /></SelectTrigger>
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
              <Label className="text-xs">Schedule</Label>
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
                    className={`h-9 w-9 rounded-lg text-xs font-semibold transition-all ${
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
                <div className="space-y-1">
                  <Label className="text-xs">Start Time</Label>
                  <Input type="time" value={editBatchStartTime} onChange={(e) => setEditBatchStartTime(e.target.value)} className="h-10 rounded-lg" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End Time</Label>
                  <Input type="time" value={editBatchEndTime} onChange={(e) => setEditBatchEndTime(e.target.value)} className="h-10 rounded-lg" />
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Max Batch Size</Label>
              <Input type="number" value={editBatchCapacity} onChange={(e) => setEditBatchCapacity(e.target.value)} className="h-10 rounded-lg" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Class Fee (₹)</Label>
                <Input type="number" value={editBatchFee} onChange={(e) => setEditBatchFee(e.target.value)} className="h-10 rounded-lg" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fee Frequency</Label>
                <Select value={editBatchFeeFreq} onValueChange={setEditBatchFeeFreq}>
                  <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
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

            <div className="space-y-1">
              <Label className="text-xs">Registration Fee (₹)</Label>
              <Input type="number" value={editBatchRegFee} onChange={(e) => setEditBatchRegFee(e.target.value)} placeholder="0" className="h-10 rounded-lg" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Start Date</Label>
                <Input type="date" value={editBatchStartDate} onChange={(e) => setEditBatchStartDate(e.target.value)} className="h-10 rounded-lg" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End Date</Label>
                <Input type="date" value={editBatchEndDate} onChange={(e) => setEditBatchEndDate(e.target.value)} className="h-10 rounded-lg" />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Total Sessions</Label>
              <Input type="number" value={editBatchTotalSessions} onChange={(e) => setEditBatchTotalSessions(e.target.value)} placeholder="Optional" className="h-10 rounded-lg" />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="text-xs font-medium">Registration Mode</p>
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

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="text-xs font-medium">Auto-Waitlist</p>
                <p className="text-[10px] text-muted-foreground">Add to waitlist when full</p>
              </div>
              <Switch checked={editBatchAutoWaitlist} onCheckedChange={setEditBatchAutoWaitlist} />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notes</Label>
              <Textarea value={editBatchNotes} onChange={(e) => setEditBatchNotes(e.target.value)} rows={2} className="rounded-lg" />
            </div>

            <Button onClick={handleSaveBatch} disabled={!editBatchName.trim() || updateBatch.isPending} className="w-full bg-provider text-white rounded-lg">
              {updateBatch.isPending ? <Loader2 size={16} className="animate-spin" /> : "Save Changes"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default ProviderClassDetail;
