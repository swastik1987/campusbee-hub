import { useState } from "react";
import { useParams } from "react-router-dom";
import {
  useDemoSessions,
  useCreateDemoSession,
  useCancelDemoSession,
} from "@/hooks/useDemoSessions";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Calendar, Clock, Loader2, Plus, Users, X, CalendarDays } from "lucide-react";
import { toast } from "sonner";

const STATUS_COLORS: Record<string, string> = {
  upcoming: "bg-blue-100 text-blue-700",
  ongoing: "bg-green-100 text-green-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
};

const ProviderDemoSessions = () => {
  const { classId } = useParams<{ classId: string }>();
  const { data: sessions, isLoading } = useDemoSessions(classId);
  const createSession = useCreateDemoSession();
  const cancelSession = useCancelDemoSession();

  const [showAdd, setShowAdd] = useState(false);
  const [sessionDate, setSessionDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [maxParticipants, setMaxParticipants] = useState("10");
  const [fee, setFee] = useState("0");
  const [notes, setNotes] = useState("");

  const resetForm = () => {
    setSessionDate("");
    setStartTime("");
    setEndTime("");
    setMaxParticipants("10");
    setFee("0");
    setNotes("");
    setShowAdd(false);
  };

  const handleCreate = async () => {
    if (!classId || !sessionDate || !startTime || !endTime) return;
    try {
      await createSession.mutateAsync({
        classId,
        sessionDate,
        startTime,
        endTime,
        maxParticipants: parseInt(maxParticipants) || 10,
        fee: parseFloat(fee) || 0,
        notes: notes.trim() || undefined,
      });
      toast.success("Demo session scheduled");
      resetForm();
    } catch {
      toast.error("Failed to create session");
    }
  };

  const handleCancel = async (id: string) => {
    try {
      await cancelSession.mutateAsync(id);
      toast.success("Session cancelled");
    } catch {
      toast.error("Failed to cancel");
    }
  };

  const formatTime = (t: string) => {
    const [h, m] = t.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    return `${hour > 12 ? hour - 12 : hour || 12}:${m} ${ampm}`;
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Trial / Demo Sessions</h2>
          <Button size="sm" className="gap-1 text-xs" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Schedule
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : sessions && sessions.length > 0 ? (
          <div className="space-y-2">
            {sessions.map((s) => (
              <Card key={s.id} className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar size={14} className="text-muted-foreground" />
                    <span className="text-sm font-semibold">
                      {new Date(s.session_date).toLocaleDateString("en-IN", {
                        weekday: "short", day: "numeric", month: "short",
                      })}
                    </span>
                  </div>
                  <Badge className={`text-[10px] border-0 ${STATUS_COLORS[s.status ?? "upcoming"]}`}>
                    {s.status}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {formatTime(s.start_time)} - {formatTime(s.end_time)}
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={12} /> {s.current_count}/{s.max_participants}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">
                    {Number(s.fee) > 0 ? `₹${s.fee}` : "Free"}
                  </span>
                  {s.status === "upcoming" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs text-destructive border-destructive"
                      onClick={() => handleCancel(s.id)}
                    >
                      <X size={12} className="mr-1" /> Cancel
                    </Button>
                  )}
                </div>

                {s.notes && (
                  <p className="text-xs text-muted-foreground">{s.notes}</p>
                )}
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <CalendarDays size={28} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No demo sessions scheduled</p>
            <p className="text-xs text-muted-foreground">Schedule trial classes to let seekers try before enrolling</p>
          </div>
        )}
      </div>

      {/* Add Session Sheet */}
      <Sheet open={showAdd} onOpenChange={setShowAdd}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader><SheetTitle>Schedule Demo Session</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={sessionDate}
                onChange={(e) => setSessionDate(e.target.value)}
                min={new Date().toISOString().slice(0, 10)}
                className="h-10 rounded-lg"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Start Time</Label>
                <Input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="h-10 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">End Time</Label>
                <Input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="h-10 rounded-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Max Participants</Label>
                <Input
                  type="number"
                  value={maxParticipants}
                  onChange={(e) => setMaxParticipants(e.target.value)}
                  min="1"
                  className="h-10 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Fee (₹)</Label>
                <Input
                  type="number"
                  value={fee}
                  onChange={(e) => setFee(e.target.value)}
                  min="0"
                  placeholder="0 for free"
                  className="h-10 rounded-lg"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Notes (optional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any instructions for attendees"
                className="h-10 rounded-lg"
              />
            </div>

            <Button
              onClick={handleCreate}
              disabled={!sessionDate || !startTime || !endTime || createSession.isPending}
              className="w-full rounded-lg"
            >
              {createSession.isPending ? <Loader2 size={16} className="animate-spin" /> : "Schedule Session"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <BottomNav persona="provider" />
    </div>
  );
};

export default ProviderDemoSessions;
