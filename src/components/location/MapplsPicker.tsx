/**
 * MapplsPicker — interactive address picker.
 *
 * - Uncontrolled <input> so the Mappls placeAutocomplete widget can manage
 *   the DOM directly without React fighting it (fixes suggestions not showing).
 * - CSS overlay pin: always centred in the viewport, never drifts on zoom.
 * - User repositions by panning/dragging the map; pin lifts during movement.
 * - moveend → reads map.getCenter() → reverse-geocodes (SDK) or keeps last
 *   known address, then calls onChange.
 * - Dedicated "Selected Location" field shows the current pin address.
 * - On autocomplete pick the map flies to zoom 18 (~180 m view ≈ 30 m radius).
 */

import * as React from "react";
import { Loader2, MapPin, Navigation2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  loadMappls,
  mapplsConfig,
  type MapplsMap,
  type MapplsAutocompleteResult,
  type MapplsReverseGeocodeResult,
} from "@/integrations/mappls/client";
import type { LocationValue } from "@/hooks/useLocation";

function useMapId() {
  const id = React.useId();
  return `mappls-map-${id.replace(/:/g, "")}`;
}

export type MapplsPickerProps = {
  value: LocationValue | null;
  onChange: (value: LocationValue) => void;
  placeholder?: string;
  defaultCenter?: [number, number]; // [lat, lng]
  className?: string;
  showMap?: boolean;
};

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946]; // Bengaluru
const ZOOM_SELECTED = 18;  // ~180 m view when an address is chosen
const ZOOM_DEFAULT  = 12;
// Tolerance in degrees below which we skip re-emitting (≈ 1 m)
const SAME_LOC_EPS  = 0.00001;

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
    const inputRef        = React.useRef<HTMLInputElement | null>(null);
    const mapContainerRef = React.useRef<HTMLDivElement | null>(null);
    const mapInstanceRef  = React.useRef<MapplsMap | null>(null);
    // Ref so moveend handler always sees the latest emitted location
    const locationRef     = React.useRef<LocationValue | null>(value ?? null);

    const [sdkLoading,    setSdkLoading]    = React.useState(true);
    const [sdkError,      setSdkError]      = React.useState<string | null>(null);
    const [mapMoving,     setMapMoving]      = React.useState(false);
    const [displayAddress, setDisplayAddress] = React.useState(value?.address ?? "");

    // Keep ref + display address in sync when parent pushes a new value
    React.useEffect(() => {
      locationRef.current = value ?? null;
      setDisplayAddress(value?.address ?? "");
      if (inputRef.current && document.activeElement !== inputRef.current) {
        inputRef.current.value = value?.address ?? "";
      }
    }, [value?.address, value?.lat, value?.lng]);

    // Emit a location change and update local refs/display
    const emitLocation = React.useCallback(
      (lat: number, lng: number, address: string) => {
        const loc: LocationValue = { address, lat, lng };
        locationRef.current = loc;
        setDisplayAddress(address);
        onChange(loc);
      },
      [onChange]
    );

    // Resolve an address from coordinates.
    // Uses SDK ReverseGeocode when available; falls back to last known address
    // (so a plain zoom doesn't wipe a nicely formatted autocomplete result).
    const resolveAddress = React.useCallback(
      (lat: number, lng: number): Promise<string> =>
        new Promise((resolve) => {
          const mpl = window.mappls;
          if (mpl?.ReverseGeocode) {
            mpl.ReverseGeocode({
              lat,
              lng,
              callback: (data: MapplsReverseGeocodeResult) => {
                const addr =
                  data?.results?.[0]?.formatted_address ??
                  data?.results?.[0]?.place_name ??
                  locationRef.current?.address ??
                  `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
                resolve(addr);
              },
            });
          } else {
            // No reverse geocode available — preserve the last address so a
            // zoom-only interaction doesn't degrade to raw coordinates.
            resolve(
              locationRef.current?.address ??
                `${lat.toFixed(5)}, ${lng.toFixed(5)}`
            );
          }
        }),
      []
    );

    React.useEffect(() => {
      let cancelled = false;

      if (!mapplsConfig.hasKey) {
        setSdkError("Map service unavailable (missing API key)");
        setSdkLoading(false);
        return;
      }

      loadMappls()
        .then((mappls) => {
          if (cancelled || !mappls) return;

          const startLat = value?.lat ?? defaultCenter[0];
          const startLng = value?.lng ?? defaultCenter[1];

          /* ── Map ─────────────────────────────────────────── */
          if (showMap && mapContainerRef.current && !mapInstanceRef.current) {
            const map = new mappls.Map(mapContainerId, {
              center: { lat: startLat, lng: startLng },
              zoom: value ? ZOOM_SELECTED : ZOOM_DEFAULT,
              zoomControl: true,
              location: false,
            });
            mapInstanceRef.current = map;

            // Animate the CSS pin upward while the map is in motion
            map.on("movestart", () => {
              if (!cancelled) setMapMoving(true);
            });

            // On every pan/zoom end: read center, reverse-geocode, emit
            map.on("moveend", () => {
              if (cancelled) return;
              setMapMoving(false);

              const center = map.getCenter();
              if (!center) return;

              // getCenter() can return {lat, lng} as values or as functions
              // depending on the underlying MapLibre version — handle both.
              const lat =
                typeof (center as any).lat === "function"
                  ? (center as any).lat()
                  : (center as any).lat;
              const lng =
                typeof (center as any).lng === "function"
                  ? (center as any).lng()
                  : (center as any).lng;

              if (lat == null || lng == null) return;

              // Skip if the map hasn't actually moved (e.g. tap without pan)
              const cur = locationRef.current;
              if (
                cur &&
                Math.abs(cur.lat - lat) < SAME_LOC_EPS &&
                Math.abs(cur.lng - lng) < SAME_LOC_EPS
              ) {
                return;
              }

              resolveAddress(lat, lng).then((address) => {
                if (!cancelled) emitLocation(lat, lng, address);
              });
            });
          }

          /* ── Autocomplete ─────────────────────────────────── */
          // Use an UNCONTROLLED input so the Mappls widget can manipulate the
          // DOM value directly without React fighting it.
          if (inputRef.current && mappls.placeAutocomplete) {
            mappls.placeAutocomplete(
              inputRef.current,
              {
                region: "ind",
                height: "300px",
                tokenizeAddress: true,
              },
              (result: MapplsAutocompleteResult) => {
                const lat = result.latitude;
                const lng = result.longitude;
                const address =
                  result.placeAddress ??
                  result.formattedAddress ??
                  result.placeName ??
                  "";
                if (lat == null || lng == null) return;

                // Sync the input text to the selected address
                if (inputRef.current) inputRef.current.value = address;

                // Fly to the selected location at ~30 m zoom
                const mapAny = mapInstanceRef.current as any;
                mapAny?.setCenter?.({ lat, lng });
                mapAny?.setZoom?.(ZOOM_SELECTED);

                emitLocation(lat, lng, address);
              }
            );
          }

          setSdkLoading(false);
        })
        .catch((err: Error) => {
          if (cancelled) return;
          console.error("[MapplsPicker]", err);
          setSdkError(err.message);
          setSdkLoading(false);
        });

      return () => {
        cancelled = true;
        try {
          mapInstanceRef.current?.remove();
        } catch {
          /* ignore */
        }
        mapInstanceRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
      <div ref={ref} className={cn("w-full space-y-3", className)}>

        {/* ── Search input (uncontrolled) ─────────────────── */}
        <div className="relative">
          <MapPin
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10"
          />
          <input
            ref={inputRef}
            type="text"
            defaultValue={value?.address ?? ""}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            className="flex h-11 w-full rounded-xl border border-input bg-background pl-10 pr-10 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          {sdkLoading && !sdkError && (
            <Loader2
              size={16}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin"
            />
          )}
        </div>

        {/* ── Map with CSS overlay pin ────────────────────── */}
        {showMap && (
          <div className="relative w-full h-64 rounded-xl overflow-hidden border border-border bg-muted">

            {/* Mappls map container — fills the whole box */}
            <div
              id={mapContainerId}
              ref={mapContainerRef}
              className="absolute inset-0"
            />

            {/* CSS overlay pin — always visually centred.
                left:50% top:50% positions the top-left corner at centre.
                translateX(-50%) centres horizontally.
                translateY(-100%) lifts so the PIN TIP sits on the centre point.
                Additional upward shift while the map is moving creates a
                "hover" effect that makes it feel like dragging a real pin. */}
            {!sdkLoading && !sdkError && (
              <div className="absolute inset-0 pointer-events-none">
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: `translateX(-50%) translateY(${mapMoving ? "calc(-100% - 10px)" : "-100%"})`,
                    transition: "transform 0.15s ease",
                  }}
                >
                  <MapPin
                    size={38}
                    className="text-primary"
                    style={{
                      filter: mapMoving
                        ? "drop-shadow(0 6px 12px rgba(0,0,0,0.4))"
                        : "drop-shadow(0 3px 6px rgba(0,0,0,0.35))",
                      transition: "filter 0.15s ease",
                    }}
                  />
                </div>

                {/* Shadow dot under the pin tip */}
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translateX(-50%) translateY(-50%)",
                    width:  mapMoving ? "18px" : "8px",
                    height: mapMoving ? "8px"  : "4px",
                    borderRadius: "50%",
                    background: "rgba(0,0,0,0.18)",
                    transition: "all 0.15s ease",
                  }}
                />
              </div>
            )}

            {/* Drag hint */}
            {!sdkLoading && !sdkError && (
              <div className="absolute bottom-2 left-0 right-0 flex justify-center pointer-events-none">
                <span className="bg-black/50 text-white text-[11px] px-2.5 py-1 rounded-full">
                  Drag map to reposition pin
                </span>
              </div>
            )}

            {/* Loading / error overlay */}
            {(sdkLoading || sdkError) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-muted/80 backdrop-blur-sm gap-2 z-10">
                {sdkError ? (
                  <p className="text-xs text-destructive max-w-[80%] text-center">
                    {sdkError}
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

        {/* ── Selected location display field ─────────────── */}
        {displayAddress && (
          <div className="flex items-start gap-2.5 rounded-xl bg-primary/5 border border-primary/20 px-3 py-2.5">
            <Navigation2 size={15} className="mt-0.5 flex-shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                Selected Location
              </p>
              <p className="text-sm text-foreground leading-relaxed break-words">
                {displayAddress}
              </p>
            </div>
          </div>
        )}

      </div>
    );
  }
);

MapplsPicker.displayName = "MapplsPicker";

export default MapplsPicker;
