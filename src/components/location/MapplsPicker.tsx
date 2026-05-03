/**
 * MapplsPicker — interactive address picker.
 *
 * Fix history (v3):
 * - Custom React autocomplete dropdown using window.mappls.search() so we
 *   never fight the SDK widget over DOM ownership or z-index.
 * - Address is taken directly from the autocomplete result; coordinates are
 *   only shown when the user manually pans the map without a prior search.
 * - map.resize() called after init so the canvas fills its container.
 * - mapReadyRef guards moveend from firing before the user interacts,
 *   preventing the initial render from clobbering a null location.
 * - emitLocation() is called BEFORE setCenter() so locationRef is current
 *   when moveend fires and the same-location dedup skips the redundant call.
 */

import * as React from "react";
import { Loader2, MapPin, Navigation2, Search, X } from "lucide-react";
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
const ZOOM_SELECTED = 18;   // ~180 m view ≈ 30 m radius
const ZOOM_DEFAULT  = 12;
const SEARCH_DEBOUNCE_MS = 350;
const MIN_SEARCH_CHARS   = 3;
// Skip moveend re-emit when center moved less than ~1 m
const SAME_LOC_EPS = 0.00001;

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
    const mapContainerId  = useMapId();
    const mapContainerRef = React.useRef<HTMLDivElement | null>(null);
    const mapInstanceRef  = React.useRef<MapplsMap | null>(null);
    // Tracks whether the map has finished its initial render so we skip the
    // first synthetic moveend that fires during map initialisation.
    const mapReadyRef     = React.useRef(false);
    // Always-current snapshot of the last emitted location for use inside
    // event handler closures without stale-closure issues.
    const locationRef     = React.useRef<LocationValue | null>(value ?? null);
    const searchTimerRef  = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const wrapperRef      = React.useRef<HTMLDivElement | null>(null);

    const [sdkLoading,     setSdkLoading]     = React.useState(true);
    const [sdkError,       setSdkError]       = React.useState<string | null>(null);
    const [mapMoving,      setMapMoving]       = React.useState(false);
    const [inputText,      setInputText]       = React.useState(value?.address ?? "");
    const [suggestions,    setSuggestions]     = React.useState<MapplsAutocompleteResult[]>([]);
    const [showDropdown,   setShowDropdown]    = React.useState(false);
    const [searchLoading,  setSearchLoading]   = React.useState(false);
    const [displayAddress, setDisplayAddress]  = React.useState(value?.address ?? "");

    // Sync controlled state when the parent pushes a new value (e.g. reset)
    React.useEffect(() => {
      locationRef.current = value ?? null;
      const addr = value?.address ?? "";
      setDisplayAddress(addr);
      setInputText(addr);
    }, [value?.address, value?.lat, value?.lng]);

    // ── Helpers ────────────────────────────────────────────────────────────

    const emitLocation = React.useCallback(
      (lat: number, lng: number, address: string) => {
        const loc: LocationValue = { address, lat, lng };
        locationRef.current = loc;
        setDisplayAddress(address);
        onChange(loc);
      },
      [onChange]
    );

    /** Resolve an address from coordinates.
     *  Uses SDK ReverseGeocode when available; otherwise keeps the last
     *  known address so a zoom doesn't degrade a formatted result to raw
     *  coordinates. */
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
            resolve(
              locationRef.current?.address ??
                `${lat.toFixed(5)}, ${lng.toFixed(5)}`
            );
          }
        }),
      []
    );

    // ── Programmatic autosuggest ───────────────────────────────────────────

    const fetchSuggestions = React.useCallback((query: string) => {
      const mpl = window.mappls as typeof window.mappls & {
        search?: (opts: { query: string; region?: string }, cb: (d: unknown) => void) => void;
        autosuggest?: (opts: { query: string; region?: string }, cb: (d: unknown) => void) => void;
      };
      if (!mpl) return;

      setSearchLoading(true);

      const handleResults = (data: unknown) => {
        setSearchLoading(false);
        const raw = data as { suggestedLocations?: MapplsAutocompleteResult[] } | null;
        const results = raw?.suggestedLocations ?? [];
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      };

      if (typeof mpl.search === "function") {
        mpl.search({ query, region: "IND" }, handleResults);
      } else if (typeof mpl.autosuggest === "function") {
        mpl.autosuggest({ query, region: "IND" }, handleResults);
      } else {
        // SDK programmatic API not available; widget fallback active (see below)
        setSearchLoading(false);
      }
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const text = e.target.value;
      setInputText(text);
      setShowDropdown(false);
      setSuggestions([]);

      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (text.length >= MIN_SEARCH_CHARS) {
        searchTimerRef.current = setTimeout(() => fetchSuggestions(text), SEARCH_DEBOUNCE_MS);
      }
    };

    const handleSuggestionSelect = (result: MapplsAutocompleteResult) => {
      // Latitude/longitude can arrive as numbers or numeric strings from the SDK
      const lat = typeof result.latitude  === "string" ? parseFloat(result.latitude  as unknown as string) : result.latitude;
      const lng = typeof result.longitude === "string" ? parseFloat(result.longitude as unknown as string) : result.longitude;
      const address =
        result.placeAddress ??
        result.formattedAddress ??
        result.placeName ??
        "";

      if (lat == null || isNaN(lat) || lng == null || isNaN(lng)) return;

      setInputText(address);
      setSuggestions([]);
      setShowDropdown(false);

      // Emit BEFORE moving the map so locationRef is current when moveend fires
      emitLocation(lat, lng, address);

      const mapAny = mapInstanceRef.current as any;
      mapAny?.setCenter?.({ lat, lng });
      mapAny?.setZoom?.(ZOOM_SELECTED);
    };

    const handleClearInput = () => {
      setInputText("");
      setSuggestions([]);
      setShowDropdown(false);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };

    // Close dropdown on outside click
    React.useEffect(() => {
      const handlePointerDown = (e: PointerEvent) => {
        if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
          setShowDropdown(false);
        }
      };
      document.addEventListener("pointerdown", handlePointerDown);
      return () => document.removeEventListener("pointerdown", handlePointerDown);
    }, []);

    // ── SDK + map initialisation ───────────────────────────────────────────

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

          /* ── Map ──────────────────────────────────────────── */
          if (showMap && mapContainerRef.current && !mapInstanceRef.current) {
            const map = new mappls.Map(mapContainerId, {
              center: { lat: startLat, lng: startLng },
              zoom: value ? ZOOM_SELECTED : ZOOM_DEFAULT,
              zoomControl: true,
              location: false,
            });
            mapInstanceRef.current = map;

            // Force canvas to fill the container after tiles settle
            setTimeout(() => {
              if (!cancelled) map.resize();
            }, 200);

            // Animate pin while map is in motion
            map.on("movestart", () => {
              if (!cancelled) setMapMoving(true);
            });

            // Mark map as ready after the first natural moveend (init pan/zoom)
            // then start processing user-driven moves from the second event onward.
            map.on("moveend", () => {
              if (cancelled) return;
              setMapMoving(false);

              if (!mapReadyRef.current) {
                mapReadyRef.current = true;
                return; // Skip the synthetic moveend on initial render
              }

              const center = map.getCenter();
              if (!center) return;

              const lat =
                typeof (center as any).lat === "function"
                  ? (center as any).lat()
                  : (center as any).lat;
              const lng =
                typeof (center as any).lng === "function"
                  ? (center as any).lng()
                  : (center as any).lng;

              if (lat == null || lng == null) return;

              // Dedup: skip if map hasn't actually moved
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
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        try { mapInstanceRef.current?.remove(); } catch { /* ignore */ }
        mapInstanceRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Render ─────────────────────────────────────────────────────────────

    return (
      <div ref={(el) => {
        wrapperRef.current = el;
        if (typeof ref === "function") ref(el);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
      }} className={cn("w-full space-y-3", className)}>

        {/* ── Search input + custom dropdown ───────────────── */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10"
          />
          <input
            type="text"
            value={inputText}
            onChange={handleInputChange}
            onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            className="flex h-11 w-full rounded-xl border border-input bg-background pl-9 pr-9 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          />
          {/* Right-side icon: spinner while searching, X to clear when text present */}
          {searchLoading ? (
            <Loader2
              size={15}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin pointer-events-none"
            />
          ) : inputText ? (
            <button
              type="button"
              onClick={handleClearInput}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={15} />
            </button>
          ) : sdkLoading ? (
            <Loader2
              size={15}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin pointer-events-none"
            />
          ) : null}

          {/* Suggestion dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-border bg-background shadow-lg overflow-hidden max-h-60 overflow-y-auto">
              {suggestions.map((s, i) => (
                <li key={s.eLoc ?? i}>
                  <button
                    type="button"
                    onPointerDown={(e) => {
                      e.preventDefault(); // prevent input blur before click registers
                      handleSuggestionSelect(s);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex flex-col gap-0.5"
                  >
                    <span className="font-medium text-foreground leading-snug">
                      {s.placeName ?? s.formattedAddress ?? ""}
                    </span>
                    {s.placeAddress && s.placeAddress !== s.placeName && (
                      <span className="text-xs text-muted-foreground leading-snug truncate">
                        {s.placeAddress}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Map with CSS overlay pin ──────────────────────── */}
        {showMap && (
          <div className="relative w-full rounded-xl overflow-hidden border border-border bg-muted" style={{ height: 256 }}>

            {/* Mappls map: absolute fill, explicit 100% × 100% for resize() */}
            <div
              id={mapContainerId}
              ref={mapContainerRef}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            />

            {/* CSS overlay pin — tip always on the exact map centre.
                left:50% top:50% + translateX(-50%) translateY(-100%) puts the
                bottom-centre (tip) of MapPin at the centre of the container.
                Extra upward shift while map moves = "hover" animation. */}
            {!sdkLoading && !sdkError && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  pointerEvents: "none",
                }}
              >
                {/* Pin icon */}
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
                        ? "drop-shadow(0 8px 14px rgba(0,0,0,0.4))"
                        : "drop-shadow(0 3px 6px rgba(0,0,0,0.35))",
                      transition: "filter 0.15s ease",
                    }}
                  />
                </div>
                {/* Shadow ellipse under pin tip */}
                <div
                  style={{
                    position: "absolute",
                    left: "50%",
                    top: "50%",
                    transform: "translateX(-50%) translateY(-50%)",
                    width:  mapMoving ? 20 : 8,
                    height: mapMoving ? 8  : 3,
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
                  <p className="text-xs text-destructive max-w-[80%] text-center">{sdkError}</p>
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

        {/* ── Selected location display ─────────────────────── */}
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
