import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useUser } from "@/contexts/UserContext";
import { useApartments, useCreateFamily, useRequestApartment } from "@/hooks/useOnboarding";
import { Building2, ChevronLeft, Loader2, MapPin, Plus, Search, Check } from "lucide-react";
import { toast } from "sonner";

interface StepApartmentProps {
  onNext: (familyId: string) => void;
  onBack: () => void;
}

const StepApartment = ({ onNext, onBack }: StepApartmentProps) => {
  const { profile } = useUser();
  const [search, setSearch] = useState("");
  const [selectedApt, setSelectedApt] = useState<{
    id: string;
    name: string;
    city: string;
    locality: string;
  } | null>(null);
  const [flatNumber, setFlatNumber] = useState("");
  const [blockTower, setBlockTower] = useState("");
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [reqName, setReqName] = useState("");
  const [reqCity, setReqCity] = useState("");
  const [reqLocality, setReqLocality] = useState("");

  const { data: apartments, isLoading: searchLoading } = useApartments(search);
  const createFamily = useCreateFamily();
  const requestApartment = useRequestApartment();

  const handleSelectApartment = (apt: typeof selectedApt) => {
    setSelectedApt(apt);
    setSearch("");
    setShowRequestForm(false);
  };

  const handleRequestApartment = async () => {
    if (!reqName.trim() || !reqCity.trim() || !reqLocality.trim()) return;

    try {
      const apt = await requestApartment.mutateAsync({
        name: reqName.trim(),
        city: reqCity.trim(),
        locality: reqLocality.trim(),
      });
      toast.success("Apartment request submitted! You'll be notified when it's approved.");
      setSelectedApt(apt);
      setShowRequestForm(false);
    } catch {
      toast.error("Failed to submit request");
    }
  };

  const handleSubmit = async () => {
    if (!selectedApt || !profile) return;

    try {
      const result = await createFamily.mutateAsync({
        userId: profile.id,
        apartmentId: selectedApt.id,
        flatNumber,
        blockTower,
      });
      onNext(result.id);
    } catch (err: any) {
      console.error("[CampusBee] Failed to save apartment details:", err);
      toast.error(err?.message || "Failed to save apartment details");
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-foreground">Select your apartment</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Find your apartment community
          </p>
        </div>
      </div>

      {/* Selected apartment */}
      {selectedApt && (
        <Card className="flex items-center gap-3 p-4 border-primary bg-primary/5">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Building2 size={20} className="text-primary" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm">{selectedApt.name}</p>
            <p className="text-xs text-muted-foreground">
              {selectedApt.locality}, {selectedApt.city}
            </p>
          </div>
          <Check size={18} className="text-primary" />
        </Card>
      )}

      {/* Search */}
      {!selectedApt && !showRequestForm && (
        <>
          <div className="relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search apartments..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-12 pl-10 rounded-xl"
              autoFocus
            />
          </div>

          {/* Results */}
          <div className="max-h-60 space-y-2 overflow-y-auto">
            {searchLoading && (
              <div className="flex justify-center py-4">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            )}
            {apartments?.map((apt) => (
              <Card
                key={apt.id}
                className="flex cursor-pointer items-center gap-3 p-3 transition-colors hover:bg-accent/50 active:bg-accent"
                onClick={() => handleSelectApartment(apt)}
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                  <Building2 size={18} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{apt.name}</p>
                  <p className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin size={10} />
                    {apt.locality}, {apt.city}
                  </p>
                </div>
              </Card>
            ))}
            {!searchLoading && apartments?.length === 0 && search && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No apartments found
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={() => setShowRequestForm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/30 p-3 text-sm font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Plus size={16} />
            Don't see your apartment? Request to add it
          </button>
        </>
      )}

      {/* Request form */}
      {showRequestForm && !selectedApt && (
        <div className="space-y-4 rounded-xl border bg-card p-4">
          <h3 className="font-semibold text-sm">Request new apartment</h3>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Apartment Name</Label>
              <Input
                placeholder="e.g. Prestige Lakeside"
                value={reqName}
                onChange={(e) => setReqName(e.target.value)}
                className="h-10 rounded-lg"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">City</Label>
                <Input
                  placeholder="e.g. Bangalore"
                  value={reqCity}
                  onChange={(e) => setReqCity(e.target.value)}
                  className="h-10 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Locality</Label>
                <Input
                  placeholder="e.g. Whitefield"
                  value={reqLocality}
                  onChange={(e) => setReqLocality(e.target.value)}
                  className="h-10 rounded-lg"
                />
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1 rounded-lg"
              onClick={() => setShowRequestForm(false)}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 gradient-primary text-primary-foreground rounded-lg"
              onClick={handleRequestApartment}
              disabled={!reqName.trim() || !reqCity.trim() || !reqLocality.trim() || requestApartment.isPending}
            >
              {requestApartment.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "Submit"
              )}
            </Button>
          </div>
        </div>
      )}

      {/* Flat / Block details */}
      {selectedApt && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="flat">Flat Number</Label>
              <Input
                id="flat"
                placeholder="e.g. A-301"
                value={flatNumber}
                onChange={(e) => setFlatNumber(e.target.value)}
                className="h-12 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="block">Block / Tower</Label>
              <Input
                id="block"
                placeholder="e.g. Tower A"
                value={blockTower}
                onChange={(e) => setBlockTower(e.target.value)}
                className="h-12 rounded-xl"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setSelectedApt(null)}
              className="rounded-xl"
            >
              Change
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createFamily.isPending}
              className="flex-1 gradient-primary text-primary-foreground h-12 font-semibold rounded-xl"
            >
              {createFamily.isPending ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                "Continue"
              )}
            </Button>
          </div>
        </>
      )}
    </div>
  );
};

export default StepApartment;
