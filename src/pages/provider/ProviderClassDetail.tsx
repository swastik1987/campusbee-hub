import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  useClassDetail,
  useBatches,
  useClassAddons,
  useUpdateClassStatus,
  useUpdateBatchStatus,
  useCreateAddon,
  useDeleteAddon,
} from "@/hooks/useClasses";
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
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Clock,
  Loader2,
  Package,
  Pause,
  Play,
  Plus,
  Star,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FEE_LABELS: Record<string, string> = {
  per_session: "/session",
  monthly: "/month",
  quarterly: "/quarter",
  for_duration: " total",
  one_time: " one-time",
};

const ProviderClassDetail = () => {
  const { classId } = useParams();
  const navigate = useNavigate();

  const { data: cls, isLoading } = useClassDetail(classId);
  const { data: batches, isLoading: batchesLoading } = useBatches(classId);
  const { data: addons } = useClassAddons(classId);
  const updateStatus = useUpdateClassStatus();
  const updateBatchStatus = useUpdateBatchStatus();
  const createAddon = useCreateAddon();
  const deleteAddon = useDeleteAddon();

  // Addon form state
  const [addonName, setAddonName] = useState("");
  const [addonDesc, setAddonDesc] = useState("");
  const [addonFee, setAddonFee] = useState("");
  const [addonFeeType, setAddonFeeType] = useState("one_time");
  const [addonMandatory, setAddonMandatory] = useState(false);
  const [addonSheetOpen, setAddonSheetOpen] = useState(false);

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
            <Plus size={14} className="mr-1" /> Add Batch
          </Button>
        </div>

        <Tabs defaultValue="batches">
          <TabsList className="w-full">
            <TabsTrigger value="batches" className="flex-1">Batches</TabsTrigger>
            <TabsTrigger value="addons" className="flex-1">Add-ons</TabsTrigger>
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
    </div>
  );
};

export default ProviderClassDetail;
