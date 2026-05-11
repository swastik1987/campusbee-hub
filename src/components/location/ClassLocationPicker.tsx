/**
 * ClassLocationPicker
 *
 * Combines:
 * - MapplsPicker (address autocomplete + interactive map) for venue selection
 * - A radius Slider shown only for home-based classes
 *
 * Usage:
 *   <ClassLocationPicker
 *     isHomeBased={isHomeBased}
 *     location={classLocation}
 *     homeRadiusKm={homeRadiusKm}
 *     onLocationChange={setClassLocation}
 *     onRadiusChange={setHomeRadiusKm}
 *   />
 */

import * as React from "react";
import MapplsPicker from "./MapplsPicker";
import type { LocationValue } from "@/hooks/useLocation";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Home, MapPin } from "lucide-react";

export type ClassLocationPickerProps = {
  isHomeBased: boolean;
  location: LocationValue | null;
  homeRadiusKm: number;
  onLocationChange: (v: LocationValue) => void;
  onRadiusChange: (km: number) => void;
  className?: string;
};

const ClassLocationPicker = React.forwardRef<HTMLDivElement, ClassLocationPickerProps>(
  ({ isHomeBased, location, homeRadiusKm, onLocationChange, onRadiusChange, className }, ref) => {
    return (
      <div ref={ref} className={`space-y-4 ${className ?? ""}`}>
        {isHomeBased && (
          <div className="space-y-3 rounded-xl border border-border bg-muted/30 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Home size={15} className="text-provider" />
                <Label className="text-sm font-medium">Service Radius</Label>
              </div>
              <span className="text-sm font-bold text-provider">{homeRadiusKm} km</span>
            </div>

            <Slider
              min={2}
              max={30}
              step={1}
              value={[homeRadiusKm]}
              onValueChange={([v]) => onRadiusChange(v)}
              className="w-full"
            />

            {/* Tick labels */}
            <div className="flex justify-between text-[10px] text-muted-foreground px-0.5">
              <span>2 km</span>
              <span>10 km</span>
              <span>20 km</span>
              <span>30 km</span>
            </div>

            <div className="flex items-start gap-2 rounded-lg bg-primary/5 px-3 py-2">
              <MapPin size={13} className="mt-0.5 shrink-0 text-primary" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                You'll travel to students within <span className="font-semibold text-foreground">{homeRadiusKm} km</span> of the address below. Students outside this range won't see your class.
              </p>
            </div>
          </div>
        )}

        <MapplsPicker
          value={location}
          onChange={onLocationChange}
          showMap={true}
          placeholder={
            isHomeBased
              ? "Enter your home base / starting location"
              : "Search class venue address"
          }
        />
      </div>
    );
  }
);

ClassLocationPicker.displayName = "ClassLocationPicker";

export default ClassLocationPicker;
