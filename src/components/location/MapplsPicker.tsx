/**
 * MapplsPicker — interactive address picker.
 *
 * Renders an autocomplete input + a draggable map pin. On every change
 * (autocomplete pick, pin drag, search blur) emits {address, lat, lng}.
 *
 * Uses ONLY the public Web SDK key (VITE_MAPPLS_API_KEY) — no server keys
 * required. Reverse geocoding on pin drag is approximated via the SDK's
 * marker-position event; for accurate addresses on drag, Phase 3's
 * mappls-proxy edge function will be wired in.
 */

import * as React from "react";
import { Loader2, MapPin } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  loadMappls,
  mapplsConfig,
  type MapplsMap,
  type MapplsMarker,
  type MapplsAutocompleteResult,
} from "@/integrations/mappls/client";
import type { LocationValue } from "@/hooks/useLocation";

/** Generate a stable, unique DOM id for the map container. */
function useMapId() {
  const id = React.useId();
  // React.useId() returns ":r0:" style strings — strip colons for a valid HTML id.
  return `mappls-map-${id.replace(/:/g, "")}`;
}

export type MapplsPickerProps = {
  value: LocationValue | null;
  onChange: (value: LocationValue) => void;
  placeholder?: string;
  defaultCenter?: [number, number]; // [lat, lng] — defaults to Bengaluru
  className?: string;
  showMap?: boolean;
};

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946]; // Bengaluru

const MapplsPicker = React.forwardRef<HTMLDivElement, MapplsPickerProps>(
  (
    {
      value,
      onChange,
      placeholder = "Search for your address",
      defaultCenter = DEFAULT_CENTER,
      className,
      showMap = true,
    },
    ref
  ) => {
    const mapContainerId = useMapId();
    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const mapContainerRef = React.useRef<HTMLDivElement | null>(null);
    const mapInstanceRef = React.useRef<MapplsMap | null>(null);
    const markerRef = React.useRef<MapplsMarker | null>(null);

    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | null>(null);
    const [text, setText] = React.useState(value?.address ?? "");

    // Keep input text in sync if value changes from outside
    React.useEffect(() => {
      setText(value?.address ?? "");
    }, [value?.address]);

    // Load SDK + initialise map + autocomplete
    React.useEffect(() => {
      let cancelled = false;

      if (!mapplsConfig.hasKey) {
        setError("Map service unavailable (missing API key)");
        setLoading(false);
        return;
      }

      loadMappls()
        .then((mappls) => {
          if (cancelled || !mappls) return;

          const startLat = value?.lat ?? defaultCenter[0];
          const startLng = value?.lng ?? defaultCenter[1];

          // Init map — Mappls v3 requires a string element ID (not HTMLElement).
          // The container div below carries this same id.
          if (showMap && mapContainerRef.current && !mapInstanceRef.current) {
            const map = new mappls.Map(mapContainerId, {
              center: { lat: startLat, lng: startLng },
              zoom: value ? 15 : 12,
              zoomControl: true,
              location: false,
            });
            mapInstanceRef.current = map;

            const marker = new mappls.Marker({
              map,
              position: { lat: startLat, lng: startLng },
              draggable: true,
            });
            markerRef.current = marker;

            // dragend — Mappls v3 puts coords in e.lngLat (note: "lngLat" but has .lat/.lng)
            marker.on("dragend", (e: unknown) => {
              const ev = e as { lngLat?: { lat: number; lng: number } };
              const lat = ev.lngLat?.lat;
              const lng = ev.lngLat?.lng;
              if (lat == null || lng == null) return;
              // Accurate reverse geocode wired in Phase 3; use coordinates as fallback label
              onChange({
                address: text || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
                lat,
                lng,
              });
            });
          }

          // Init autocomplete
          if (inputRef.current && mappls.placeAutocomplete) {
            mappls.placeAutocomplete(
              inputRef.current,
              { region: "ind", height: "300px" },
              (result: MapplsAutocompleteResult) => {
                const lat = result.latitude;
                const lng = result.longitude;
                const address =
                  result.placeAddress ??
                  result.formattedAddress ??
                  result.placeName ??
                  "";
                if (lat == null || lng == null) return;

                setText(address);
                onChange({ address, lat, lng });

                if (mapInstanceRef.current && markerRef.current) {
                  mapInstanceRef.current.setCenter({ lat, lng });
                  mapInstanceRef.current.setZoom(15);
                  markerRef.current.setPosition({ lat, lng });
                }
              }
            );
          }

          setLoading(false);
        })
        .catch((err: Error) => {
          if (cancelled) return;
          console.error("[MapplsPicker]", err);
          setError(err.message);
          setLoading(false);
        });

      return () => {
        cancelled = true;
        try {
          markerRef.current?.remove();
          mapInstanceRef.current?.remove();
        } catch {
          /* ignore */
        }
        markerRef.current = null;
        mapInstanceRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div ref={ref} className={cn("w-full space-y-3", className)}>
        <div className="relative">
          <MapPin
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={placeholder}
            className="pl-10 h-11 rounded-xl"
            autoComplete="off"
          />
          {loading && (
            <Loader2
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin"
            />
          )}
        </div>

        {showMap && (
          <div
            id={mapContainerId}
            ref={mapContainerRef}
            className="w-full h-56 rounded-xl bg-muted relative overflow-hidden border border-border"
          >
            {(loading || error) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 backdrop-blur-sm gap-2 z-10">
                {error ? (
                  <p className="text-xs text-destructive max-w-[80%] text-center">
                    {error}
                  </p>
                ) : (
                  <>
                    <Loader2 size={20} className="animate-spin text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">Loading map…</p>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {value && (
          <p className="text-xs text-muted-foreground px-1">
            Selected: <span className="text-foreground">{value.address}</span>
          </p>
        )}
      </div>
    );
  }
);

MapplsPicker.displayName = "MapplsPicker";

export default MapplsPicker;
