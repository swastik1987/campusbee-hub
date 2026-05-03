/**
 * MapplsPicker — interactive address picker.
 *
 * Autocomplete: Nominatim (OpenStreetMap) — the Mappls SDK key in this
 * project does not include the Places plugin, so Nominatim is used instead.
 * It is free, requires no key, and is explicitly CORS-enabled.
 *
 * Map rendering: Mappls SDK (vector tiles, map controls).
 *
 * Interaction model:
 * - User types ≥3 chars → debounced Nominatim search → custom React dropdown
 * - Selecting a result flies the map to zoom 18 (~30 m radius view)
 * - CSS overlay pin always stays at the centre of the viewport (never drifts on zoom)
 * - Panning the map repositions the pin; moveend reads getCenter() and updates location
 * - mapReadyRef skips the first synthetic moveend on map init
 * - emitLocation() is called BEFORE setCenter() to avoid race in moveend dedup
 */

import * as React from "react";
import { Loader2, MapPin, Navigation2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  loadMappls,
  mapplsConfig,
  type MapplsMap,
} from "@/integrations/mappls/client";
import type { LocationValue } from "@/hooks/useLocation";

/* ── Nominatim types ──────────────────────────────────────────────────────── */
type NominatimResult = {
  place_id: number;
  display_name: string;
  name?: string;
  lat: string;   // string in Nominatim responses
  lon: string;   // NOTE: "lon" not "lng"
  type: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    state?: string;
    country?: string;
  };
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */

function useMapId() {
  const id = React.useId();
  return `mappls-map-${id.replace(/:/g, "")}`;
}

/** First ~2 segments of a display_name (before the city/state/country) */
function shortName(result: NominatimResult): string {
  const parts = result.display_name.split(",").map(s => s.trim());
  // Try to get a meaningful 1-2 part name
  if (result.name && result.name.length > 2) return result.name;
  return parts.slice(0, 2).join(", ");
}

/** Remaining address context (city + state) */
function addressContext(result: NominatimResult): string {
  const a = result.address;
  const city = a?.city || a?.town || a?.village || "";
  const state = a?.state || "";
  return [city, state].filter(Boolean).join(", ");
}

/* ── Component ────────────────────────────────────────────────────────────── */

export type MapplsPickerProps = {
  value: LocationValue | null;
  onChange: (value: LocationValue) => void;
  placeholder?: string;
  defaultCenter?: [number, number]; // [lat, lng]
  className?: string;
  showMap?: boolean;
};

const DEFAULT_CENTER: [number, number] = [12.9716, 77.5946]; // Bengaluru
const ZOOM_SELECTED   = 18;   // ~180 m view ≈ 30 m radius
const ZOOM_DEFAULT    = 12;
const SEARCH_DEBOUNCE = 500;  // ms — respects Nominatim 1 req/s limit
const MIN_CHARS       = 3;
const SAME_LOC_EPS    = 0.00001; // ~1 m tolerance for moveend dedup

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
    const mapReadyRef     = React.useRef(false);
    const locationRef     = React.useRef<LocationValue | null>(value ?? null);
    const searchTimerRef  = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const wrapperRef      = React.useRef<HTMLDivElement | null>(null);
    const abortRef        = React.useRef<AbortController | null>(null);

    const [sdkLoading,     setSdkLoading]     = React.useState(true);
    const [sdkError,       setSdkError]       = React.useState<string | null>(null);
    const [mapMoving,      setMapMoving]       = React.useState(false);
    const [inputText,      setInputText]       = React.useState(value?.address ?? "");
    const [suggestions,    setSuggestions]     = React.useState<NominatimResult[]>([]);
    const [showDropdown,   setShowDropdown]    = React.useState(false);
    const [searchLoading,  setSearchLoading]   = React.useState(false);
    const [displayAddress, setDisplayAddress]  = React.useState(value?.address ?? "");

    /* ── Sync with external value changes ──────────────────────────────── */
    React.useEffect(() => {
      locationRef.current = value ?? null;
      setDisplayAddress(value?.address ?? "");
      setInputText(value?.address ?? "");
    }, [value?.address, value?.lat, value?.lng]);

    /* ── Location helpers ───────────────────────────────────────────────── */
    const emitLocation = React.useCallback(
      (lat: number, lng: number, address: string) => {
        const loc: LocationValue = { address, lat, lng };
        locationRef.current = loc;
        setDisplayAddress(address);
        onChange(loc);
      },
      [onChange]
    );

    /* ── Nominatim search ───────────────────────────────────────────────── */
    const fetchSuggestions = React.useCallback((query: string) => {
      // Cancel any in-flight request
      abortRef.current?.abort();
      abortRef.current = new AbortController();

      setSearchLoading(true);
      const params = new URLSearchParams({
        q: query,
        format: "json",
        countrycodes: "in",
        limit: "7",
        addressdetails: "1",
      });

      fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
        signal: abortRef.current.signal,
        headers: {
          "Accept": "application/json",
          "Accept-Language": "en",
        },
      })
        .then(r => r.json())
        .then((data: NominatimResult[]) => {
          setSearchLoading(false);
          setSuggestions(data ?? []);
          setShowDropdown((data ?? []).length > 0);
        })
        .catch(err => {
          if (err.name === "AbortError") return;
          setSearchLoading(false);
          setSuggestions([]);
          setShowDropdown(false);
        });
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const text = e.target.value;
      setInputText(text);
      setSuggestions([]);
      setShowDropdown(false);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (text.length >= MIN_CHARS) {
        searchTimerRef.current = setTimeout(() => fetchSuggestions(text), SEARCH_DEBOUNCE);
      }
    };

    const handleSuggestionSelect = (result: NominatimResult) => {
      const lat = parseFloat(result.lat);
      const lng = parseFloat(result.lon); // Nominatim uses "lon"
      if (isNaN(lat) || isNaN(lng)) return;

      // Build a clean address string (strip trailing ", India")
      const address = result.display_name.replace(/,\s*India\s*$/, "");

      setInputText(address);
      setSuggestions([]);
      setShowDropdown(false);

      // Emit BEFORE moving map so locationRef is set when moveend fires
      emitLocation(lat, lng, address);

      const mapAny = mapInstanceRef.current as any;
      mapAny?.setCenter?.({ lat, lng });
      mapAny?.setZoom?.(ZOOM_SELECTED);
    };

    const handleClearInput = () => {
      setInputText("");
      setSuggestions([]);
      setShowDropdown(false);
      abortRef.current?.abort();
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };

    /* ── Close dropdown on outside click ───────────────────────────────── */
    React.useEffect(() => {
      const handler = (e: PointerEvent) => {
        if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
          setShowDropdown(false);
        }
      };
      document.addEventListener("pointerdown", handler);
      return () => document.removeEventListener("pointerdown", handler);
    }, []);

    /* ── Mappls map init ────────────────────────────────────────────────── */
    React.useEffect(() => {
      let cancelled = false;

      if (!mapplsConfig.hasKey) {
        setSdkError("Map service unavailable (missing API key)");
        setSdkLoading(false);
        return;
      }

      loadMappls()
        .then(mappls => {
          if (cancelled || !mappls) return;

          const startLat = value?.lat ?? defaultCenter[0];
          const startLng = value?.lng ?? defaultCenter[1];

          if (showMap && mapContainerRef.current && !mapInstanceRef.current) {
            const map = new mappls.Map(mapContainerId, {
              center: { lat: startLat, lng: startLng },
              zoom: value ? ZOOM_SELECTED : ZOOM_DEFAULT,
              zoomControl: true,
              location: false,
            });
            mapInstanceRef.current = map;

            // Force canvas to fill container after first paint
            setTimeout(() => { if (!cancelled) map.resize(); }, 200);

            map.on("movestart", () => { if (!cancelled) setMapMoving(true); });

            map.on("moveend", () => {
              if (cancelled) return;
              setMapMoving(false);

              // Skip the synthetic moveend that fires during map initialisation
              if (!mapReadyRef.current) {
                mapReadyRef.current = true;
                return;
              }

              const center = map.getCenter();
              if (!center) return;

              const lat = typeof (center as any).lat === "function"
                ? (center as any).lat() : (center as any).lat;
              const lng = typeof (center as any).lng === "function"
                ? (center as any).lng() : (center as any).lng;
              if (lat == null || lng == null) return;

              // Skip if map hasn't actually moved
              const cur = locationRef.current;
              if (
                cur &&
                Math.abs(cur.lat - lat) < SAME_LOC_EPS &&
                Math.abs(cur.lng - lng) < SAME_LOC_EPS
              ) return;

              // Keep last known address; update coordinates
              // (full reverse geocode requires the server-side mappls-proxy edge function)
              const address =
                locationRef.current?.address ??
                `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
              emitLocation(lat, lng, address);
            });
          }

          setSdkLoading(false);
        })
        .catch(err => {
          if (cancelled) return;
          console.error("[MapplsPicker]", err);
          setSdkError(err.message);
          setSdkLoading(false);
        });

      return () => {
        cancelled = true;
        abortRef.current?.abort();
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        try { mapInstanceRef.current?.remove(); } catch { /* ignore */ }
        mapInstanceRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ── Render ─────────────────────────────────────────────────────────── */
    return (
      <div
        ref={el => {
          wrapperRef.current = el;
          if (typeof ref === "function") ref(el);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = el;
        }}
        className={cn("w-full space-y-3", className)}
      >

        {/* ── Search input ────────────────────────────────────────── */}
        <div className="relative z-20">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
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
          {searchLoading ? (
            <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin pointer-events-none" />
          ) : inputText ? (
            <button type="button" onClick={handleClearInput}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={15} />
            </button>
          ) : sdkLoading ? (
            <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin pointer-events-none" />
          ) : null}

          {/* Suggestion dropdown */}
          {showDropdown && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-border bg-background shadow-lg overflow-hidden max-h-64 overflow-y-auto">
              {suggestions.map(s => (
                <li key={s.place_id}>
                  <button
                    type="button"
                    onPointerDown={e => {
                      e.preventDefault(); // keep input focused until selection completes
                      handleSuggestionSelect(s);
                    }}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-muted flex flex-col gap-0.5"
                  >
                    <span className="font-medium text-foreground leading-snug line-clamp-1">
                      {shortName(s)}
                    </span>
                    <span className="text-xs text-muted-foreground leading-snug line-clamp-1">
                      {addressContext(s) || s.display_name.split(",").slice(2, 4).join(",")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Map with CSS overlay pin ─────────────────────────────── */}
        {showMap && (
          <div className="relative w-full rounded-xl overflow-hidden border border-border bg-muted" style={{ height: 256 }}>

            {/* Mappls map — fills container; explicit 100×100% for resize() */}
            <div
              id={mapContainerId}
              ref={mapContainerRef}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            />

            {/* CSS overlay pin — tip always on exact map centre.
                translateY(-100%) puts the bottom-centre (tip) at top:50%  */}
            {!sdkLoading && !sdkError && (
              <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
                <div style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: `translateX(-50%) translateY(${mapMoving ? "calc(-100% - 10px)" : "-100%"})`,
                  transition: "transform 0.15s ease",
                }}>
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
                {/* Shadow dot under pin tip */}
                <div style={{
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: "translateX(-50%) translateY(-50%)",
                  width:  mapMoving ? 20 : 8,
                  height: mapMoving ? 8  : 3,
                  borderRadius: "50%",
                  background: "rgba(0,0,0,0.18)",
                  transition: "all 0.15s ease",
                }} />
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

        {/* ── Selected location display ────────────────────────────── */}
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
