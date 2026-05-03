import * as React from "react";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import MapplsPicker from "@/components/location/MapplsPicker";
import { useUpdateSeekerLocation, type LocationValue } from "@/hooks/useLocation";
import { useCreateFamily } from "@/hooks/useOnboarding";

interface StepLocationProps {
  userId: string;
  /** Called once both the location is saved and the family row is created. */
  onNext: (familyId: string) => void;
  onBack: () => void;
}

/**
 * Seeker onboarding step 2 — pick a home address via MapMyIndia, then
 * spin up the family record. Replaces the v1 StepApartment (apartment
 * search + flat/block fields).
 */
const StepLocation = React.forwardRef<HTMLDivElement, StepLocationProps>(
  ({ userId, onNext, onBack }, ref) => {
    const [value, setValue] = React.useState<LocationValue | null>(null);

    const updateLocation = useUpdateSeekerLocation();
    const createFamily = useCreateFamily();

    const submitting = updateLocation.isPending || createFamily.isPending;
    const canContinue = !!value && !submitting;

    const handleContinue = async () => {
      if (!value) return;
      try {
        await updateLocation.mutateAsync({ userId, ...value });
        const fam = await createFamily.mutateAsync({ userId });
        toast.success("Home location saved");
        onNext(fam.id);
      } catch (err) {
        console.error("[StepLocation]", err);
        toast.error("Couldn't save your location. Please try again.");
      }
    };

    return (
      <div ref={ref} className="space-y-6 animate-fade-up">
        <div className="flex items-center gap-2">
          <button onClick={onBack} className="p-1" aria-label="Back">
            <ChevronLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-foreground">Where do you live?</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              We'll show you classes near this address. You can change it any time.
            </p>
          </div>
        </div>

        <MapplsPicker value={value} onChange={setValue} />

        {!value && (
          <div className="flex items-start gap-2 rounded-xl bg-muted/40 p-3">
            <MapPin size={16} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Search for a building, society or landmark, then drag the pin for an exact spot.
            </p>
          </div>
        )}

        <Button
          onClick={handleContinue}
          disabled={!canContinue}
          className="w-full h-11 rounded-xl gradient-primary text-white"
        >
          {submitting ? (
            <>
              <Loader2 size={16} className="mr-2 animate-spin" />
              Saving…
            </>
          ) : (
            "Continue"
          )}
        </Button>
      </div>
    );
  }
);

StepLocation.displayName = "StepLocation";

export default StepLocation;
