import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useCreateBatch } from "@/hooks/useClasses";
import { useTrainers } from "@/hooks/useProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

const DAYS = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

const CreateBatch = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { providerProfile } = useUser();
  const isAcademy = providerProfile?.provider_type === "academy";

  const [batchName, setBatchName] = useState("");
  const [batchType, setBatchType] = useState("level");
  const [skillLevel, setSkillLevel] = useState("");
  const [ageMin, setAgeMin] = useState("");
  const [ageMax, setAgeMax] = useState("");
  const [trainerId, setTrainerId] = useState("");
  const [maxSize, setMaxSize] = useState("");
  const [feeAmount, setFeeAmount] = useState("");
  const [feeFrequency, setFeeFrequency] = useState("monthly");
  const [registrationFee, setRegistrationFee] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [totalSessions, setTotalSessions] = useState("");
  const [regMode, setRegMode] = useState("auto");
  const [autoWaitlist, setAutoWaitlist] = useState(true);
  const [notes, setNotes] = useState("");

  // Schedule
  const [selectedDays, setSelectedDays] = useState<number[]>([]);
  const [startTime, setStartTime] = useState("06:00");
  const [endTime, setEndTime] = useState("07:00");

  const { data: trainers } = useTrainers(providerProfile?.id);
  const createBatch = useCreateBatch();

  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = async (status: string) => {
    if (!batchName.trim() || !maxSize || !feeAmount || !classId) return;

    try {
      await createBatch.mutateAsync({
        classId,
        trainerId: trainerId || null,
        batchName: batchName.trim(),
        batchType,
        skillLevel: skillLevel || null,
        ageGroupMin: ageMin ? parseInt(ageMin) : null,
        ageGroupMax: ageMax ? parseInt(ageMax) : null,
        maxBatchSize: parseInt(maxSize),
        feeAmount: parseFloat(feeAmount),
        feeFrequency,
        registrationFee: registrationFee ? parseFloat(registrationFee) : 0,
        startDate: startDate || null,
        endDate: endDate || null,
        totalSessions: totalSessions ? parseInt(totalSessions) : null,
        registrationMode: regMode,
        autoWaitlist,
        notes,
        status,
        schedules: selectedDays.map((d) => ({
          dayOfWeek: d,
          startTime,
          endTime,
        })),
      });
      toast.success(status === "active" ? "Batch activated!" : "Draft saved!");
      navigate(-1);
    } catch {
      toast.error("Failed to create batch");
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-bold">Add Batch</h1>
      </header>

      <div className="mx-auto w-full max-w-lg px-6 py-4 space-y-5">
        <div className="space-y-2">
          <Label>Batch Name</Label>
          <Input value={batchName} onChange={(e) => setBatchName(e.target.value)} placeholder="e.g. Morning Beginners" className="h-11 rounded-xl" />
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
              <Select value={skillLevel} onValueChange={setSkillLevel}>
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
              <Input type="number" value={ageMin} onChange={(e) => setAgeMin(e.target.value)} className="h-11 rounded-xl" />
            </div>
            <div className="space-y-2">
              <Label>Max Age</Label>
              <Input type="number" value={ageMax} onChange={(e) => setAgeMax(e.target.value)} className="h-11 rounded-xl" />
            </div>
          </div>
        )}

        {isAcademy && trainers && trainers.length > 0 && (
          <div className="space-y-2">
            <Label>Assign Trainer</Label>
            <Select value={trainerId} onValueChange={setTrainerId}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Select trainer" /></SelectTrigger>
              <SelectContent>
                {trainers.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Schedule */}
        <div className="space-y-3">
          <Label>Schedule</Label>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => toggleDay(d.value)}
                className={`h-10 w-10 rounded-lg text-xs font-semibold transition-all ${
                  selectedDays.includes(d.value)
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
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="h-10 rounded-lg" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">End Time</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="h-10 rounded-lg" />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <Label>Max Batch Size</Label>
          <Input type="number" value={maxSize} onChange={(e) => setMaxSize(e.target.value)} placeholder="15" className="h-11 rounded-xl" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Fee Amount (₹)</Label>
            <Input type="number" value={feeAmount} onChange={(e) => setFeeAmount(e.target.value)} placeholder="2000" className="h-11 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>Fee Frequency</Label>
            <Select value={feeFrequency} onValueChange={setFeeFrequency}>
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
          <Input type="number" value={registrationFee} onChange={(e) => setRegistrationFee(e.target.value)} placeholder="0 (one-time fee at enrollment)" className="h-11 rounded-xl" />
          <p className="text-xs text-muted-foreground">One-time fee charged when a student enrolls. Leave empty or 0 for no registration fee.</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label>Start Date</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="h-11 rounded-xl" />
          </div>
          <div className="space-y-2">
            <Label>End Date</Label>
            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="h-11 rounded-xl" />
          </div>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl border">
          <div>
            <p className="text-sm font-medium">Registration Mode</p>
            <p className="text-xs text-muted-foreground">
              {regMode === "auto" ? "Auto-accept enrollments" : "Manual approval required"}
            </p>
          </div>
          <Select value={regMode} onValueChange={setRegMode}>
            <SelectTrigger className="w-28 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">Auto</SelectItem>
              <SelectItem value="manual">Manual</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between p-3 rounded-xl border">
          <div>
            <p className="text-sm font-medium">Auto-Waitlist</p>
            <p className="text-xs text-muted-foreground">Add to waitlist when batch is full</p>
          </div>
          <Switch checked={autoWaitlist} onCheckedChange={setAutoWaitlist} />
        </div>

        <div className="space-y-2">
          <Label>Notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any additional info..." rows={2} className="rounded-xl" />
        </div>

        <div className="flex gap-3 pb-6">
          <Button
            variant="outline"
            onClick={() => handleSave("draft")}
            disabled={!batchName.trim() || !maxSize || !feeAmount || createBatch.isPending}
            className="flex-1 h-12 rounded-xl"
          >
            Save Draft
          </Button>
          <Button
            onClick={() => handleSave("active")}
            disabled={!batchName.trim() || !maxSize || !feeAmount || createBatch.isPending}
            className="flex-1 h-12 bg-provider hover:bg-provider/90 text-white font-semibold rounded-xl"
          >
            {createBatch.isPending ? <Loader2 size={20} className="animate-spin" /> : "Activate"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateBatch;
