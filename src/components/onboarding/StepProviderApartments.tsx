import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useApartments } from "@/hooks/useOnboarding";
import {
  Building2,
  Check,
  ChevronLeft,
  Loader2,
  MapPin,
  Search,
} from "lucide-react";

interface StepProviderApartmentsProps {
  onNext: (apartmentIds: string[]) => void;
  onBack: () => void;
  isSubmitting: boolean;
}

const StepProviderApartments = ({ onNext, onBack, isSubmitting }: StepProviderApartmentsProps) => {
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedApts, setSelectedApts] = useState<{ id: string; name: string; locality: string; city: string }[]>([]);

  const { data: apartments, isLoading } = useApartments(search);

  const toggleApartment = (apt: { id: string; name: string; locality: string; city: string }) => {
    if (selectedIds.includes(apt.id)) {
      setSelectedIds((prev) => prev.filter((id) => id !== apt.id));
      setSelectedApts((prev) => prev.filter((a) => a.id !== apt.id));
    } else {
      setSelectedIds((prev) => [...prev, apt.id]);
      setSelectedApts((prev) => [...prev, apt]);
    }
  };

  return (
    <div className="space-y-6 animate-fade-up">
      <div className="flex items-center gap-2">
        <button onClick={onBack} className="p-1">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h2 className="text-xl font-bold text-foreground">Where will you provide services?</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Select one or more apartment communities
          </p>
        </div>
      </div>

      {/* Selected apartments */}
      {selectedApts.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Selected ({selectedApts.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedApts.map((apt) => (
              <button
                key={apt.id}
                onClick={() => toggleApartment(apt)}
                className="flex items-center gap-1.5 rounded-full bg-provider/10 px-3 py-1.5 text-xs font-medium text-provider transition-colors hover:bg-provider/20"
              >
                <Building2 size={12} />
                {apt.name}
                <span className="ml-0.5 text-provider/60">&times;</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
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
        {isLoading && (
          <div className="flex justify-center py-4">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        )}
        {apartments?.map((apt) => {
          const isSelected = selectedIds.includes(apt.id);
          return (
            <Card
              key={apt.id}
              className={`flex cursor-pointer items-center gap-3 p-3 transition-colors ${
                isSelected
                  ? "border-provider bg-provider/5"
                  : "hover:bg-accent/50 active:bg-accent"
              }`}
              onClick={() => toggleApartment(apt)}
            >
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                isSelected ? "bg-provider/10" : "bg-muted"
              }`}>
                <Building2 size={18} className={isSelected ? "text-provider" : "text-muted-foreground"} />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">{apt.name}</p>
                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin size={10} />
                  {apt.locality}, {apt.city}
                </p>
              </div>
              {isSelected && <Check size={18} className="text-provider" />}
            </Card>
          );
        })}
        {!isLoading && apartments?.length === 0 && search && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No approved apartments found
          </p>
        )}
      </div>

      <Button
        onClick={() => onNext(selectedIds)}
        disabled={selectedIds.length === 0 || isSubmitting}
        className="w-full gradient-primary text-primary-foreground h-12 font-semibold rounded-xl"
      >
        {isSubmitting ? (
          <Loader2 size={20} className="animate-spin" />
        ) : (
          `Continue with ${selectedIds.length} apartment${selectedIds.length !== 1 ? "s" : ""}`
        )}
      </Button>
    </div>
  );
};

export default StepProviderApartments;
