import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useProviderRegistrations } from "@/hooks/useProvider";
import { useProviderClasses } from "@/hooks/useClasses";
import { useAnnouncements, useCreateAnnouncement } from "@/hooks/useEngagement";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
  AlertTriangle,
  ArrowLeft,
  Bell,
  Calendar,
  Loader2,
  Megaphone,
  Pin,
  Plus,
} from "lucide-react";
import { toast } from "sonner";

const TYPE_ICONS: Record<string, typeof Bell> = {
  general: Bell,
  schedule_change: Calendar,
  cancellation: AlertTriangle,
  new_batch: Plus,
  urgent: AlertTriangle,
};

const TYPE_COLORS: Record<string, string> = {
  general: "bg-blue-100 text-blue-700",
  schedule_change: "bg-amber-100 text-amber-700",
  cancellation: "bg-red-100 text-red-700",
  new_batch: "bg-green-100 text-green-700",
  urgent: "bg-red-100 text-red-700",
};

const Announcements = () => {
  const navigate = useNavigate();
  const { profile, providerProfile, currentApartment } = useUser();

  const { data: registrations } = useProviderRegistrations(providerProfile?.id);
  const approvedRegIds = registrations?.filter((r) => r.status === "approved").map((r) => r.id) ?? [];
  const { data: classes } = useProviderClasses(approvedRegIds);

  const { data: announcements, isLoading } = useAnnouncements({
    apartmentId: currentApartment?.id,
  });
  const createAnnouncement = useCreateAnnouncement();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [announcementType, setAnnouncementType] = useState("general");
  const [targetAudience, setTargetAudience] = useState("all_apartment");
  const [selectedClassId, setSelectedClassId] = useState("");
  const [isPinned, setIsPinned] = useState(false);

  const handleCreate = async () => {
    if (!title.trim() || !body.trim() || !profile) return;
    try {
      await createAnnouncement.mutateAsync({
        authorId: profile.id,
        apartmentId: targetAudience === "all_apartment" ? currentApartment?.id : undefined,
        classId: targetAudience === "class_students" ? selectedClassId : undefined,
        targetAudience,
        title: title.trim(),
        body: body.trim(),
        announcementType,
        isPinned,
      });
      toast.success("Announcement posted");
      setTitle(""); setBody(""); setAnnouncementType("general");
      setTargetAudience("all_apartment"); setIsPinned(false);
      setSheetOpen(false);
    } catch {
      toast.error("Failed to post announcement");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-bold flex-1">Announcements</h1>
      </header>

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : announcements && announcements.length > 0 ? (
          <div className="space-y-3">
            {announcements.map((ann) => {
              const TypeIcon = TYPE_ICONS[ann.announcement_type ?? "general"] ?? Bell;
              const typeColor = TYPE_COLORS[ann.announcement_type ?? "general"] ?? "bg-gray-100 text-gray-600";
              return (
                <Card key={ann.id} className={`p-4 space-y-2 ${ann.announcement_type === "urgent" ? "border-red-300" : ""}`}>
                  <div className="flex items-start gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${typeColor} flex-shrink-0`}>
                      <TypeIcon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <h4 className="text-sm font-semibold">{ann.title}</h4>
                        {ann.is_pinned && <Pin size={10} className="text-muted-foreground" />}
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">{ann.body}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span>{(ann.users as any)?.full_name}</span>
                    <span>·</span>
                    <span>
                      {new Date(ann.created_at).toLocaleDateString("en-IN", {
                        day: "numeric", month: "short",
                      })}
                    </span>
                    <Badge variant="secondary" className="text-[9px] capitalize">
                      {ann.announcement_type?.replace("_", " ")}
                    </Badge>
                  </div>
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Megaphone size={28} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No announcements yet</p>
          </div>
        )}

        {/* Create button */}
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <Button className="w-full bg-provider hover:bg-provider/90 text-white rounded-xl">
              <Plus size={16} className="mr-1" /> Post Announcement
            </Button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
            <SheetHeader><SheetTitle>New Announcement</SheetTitle></SheetHeader>
            <div className="space-y-3 py-4">
              <div className="space-y-1">
                <Label className="text-xs">Title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Announcement title" className="h-10 rounded-lg" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Message</Label>
                <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Details..." rows={3} className="rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select value={announcementType} onValueChange={setAnnouncementType}>
                    <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="schedule_change">Schedule Change</SelectItem>
                      <SelectItem value="cancellation">Cancellation</SelectItem>
                      <SelectItem value="new_batch">New Batch</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Audience</Label>
                  <Select value={targetAudience} onValueChange={setTargetAudience}>
                    <SelectTrigger className="h-10 rounded-lg"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all_apartment">All in Apartment</SelectItem>
                      <SelectItem value="class_students">Class Students</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {targetAudience === "class_students" && classes && classes.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Select Class</Label>
                  <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                    <SelectTrigger className="h-10 rounded-lg"><SelectValue placeholder="Choose class" /></SelectTrigger>
                    <SelectContent>
                      {classes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center justify-between">
                <Label className="text-xs">Pin to top</Label>
                <Switch checked={isPinned} onCheckedChange={setIsPinned} />
              </div>
              <Button
                onClick={handleCreate}
                disabled={!title.trim() || !body.trim() || createAnnouncement.isPending}
                className="w-full bg-provider text-white rounded-lg"
              >
                {createAnnouncement.isPending ? <Loader2 size={16} className="animate-spin" /> : "Post"}
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
};

export default Announcements;
