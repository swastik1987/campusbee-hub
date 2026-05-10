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
 *
 * GPS:
 * - On mount, requests device location via navigator.geolocation (auto, no prompt delay).
 * - Renders a permanent blue dot at GPS coordinates (non-draggable Mappls marker).
 * - If no value is pre-set, pans the map to GPS position once it arrives — this triggers
 *   the existing moveend → reverse-geocode flow, auto-populating the address field.
 * - Falls back to defaultCenter on denial or any error (silent).
 */

import * as React from "react";
import { Loader2, MapPin, Navigation2, Search, X } from "lucide-react";
import { toast } from "sonner";
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

/* ── GPS blue dot — Data URL SVG (classic Google Maps style) ─────────────── */
const GPS_DOT_SVG = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">' +
    '<circle cx="11" cy="11" r="9" fill="#4285F4" stroke="white" stroke-width="3"/>' +
    '<circle cx="11" cy="11" r="3" fill="rgba(255,255,255,0.65)"/>' +
  '</svg>'
)}`;

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
    const reverseAbortRef = React.useRef<AbortController | null>(null);

    // GPS state
    const [gpsCoords, setGpsCoords]         = React.useState<[number, number] | null>(null);
    const [mapInitialized, setMapInitialized] = React.useState(false);
    const mapplsSdkRef  = React.useRef<any>(null);
    const gpsDotRef     = React.useRef<any>(null);
    const [gpsLoading,  setGpsLoading]       = React.useState(false);  // button spinner
    const [gpsDenied,   setGpsDenied]        = React.useState(false);  // permission denied

    const [sdkLoading,      setSdkLoading]      = React.useState(true);
    const [sdkError,        setSdkError]        = React.useState<string | null>(null);
    const [mapMoving,       setMapMoving]        = React.useState(false);
    const [inputText,       setInputText]        = React.useState(value?.address ?? "");
    const [suggestions,     setSuggestions]      = React.useState<NominatimResult[]>([]);
    const [showDropdown,    setShowDropdown]     = React.useState(false);
    const [searchLoading,   setSearchLoading]    = React.useState(false);
    const [reverseLoading,  setReverseLoading]   = React.useState(false);
    const [displayAddress,  setDisplayAddress]   = React.useState(value?.address ?? "");

    /* ── GPS auto-request on mount ──────────────────────────────────────── */
    React.useEffect(() => {
      if (!navigator.geolocation) return;
      let active = true;
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (active) setGpsCoords([pos.coords.latitude, pos.coords.longitude]);
        },
        () => { /* denied / unavailable — silent fallback to defaultCenter */ },
        { timeout: 10000, maximumAge: 300000, enableHighAccuracy: false }
      );
      return () => { active = false; };
    }, []);

    /* ── Blue dot + initial GPS pan ─────────────────────────────────────── */
    React.useEffect(() => {
      if (!gpsCoords || !mapInitialized || !mapInstanceRef.current || !mapplsSdkRef.current) return;

      const [lat, lng] = gpsCoords;
      const mapAny   = mapInstanceRef.current as any;
      const mappls   = mapplsSdkRef.current as any;

      // Remove any previous GPS dot
      if (gpsDotRef.current) {
        try { gpsDotRef.current.remove?.(); } catch { /* ignore */ }
        try { gpsDotRef.current.setMap?.(null); } catch { /* ignore */ }
        gpsDotRef.current = null;
      }

      // Place blue dot at GPS coordinates (non-draggable)
      try {
        gpsDotRef.current = new mappls.Marker({
          map: mapAny,
          position: { lat, lng },
          icon: GPS_DOT_SVG,
          draggable: false,
        });
      } catch {
        // GPS dot unavailable — map still functions normally
      }

      // Pan + zoom to z=18 if no value has been selected yet (triggers moveend → reverse-geocode)
      if (!value) {
        mapAny?.setCenter?.({ lat, lng });
        mapAny?.setZoom?.(ZOOM_SELECTED);
      }
    }, [gpsCoords, mapInitialized, value]);

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
        setInputText(address);
        onChange(loc);
      },
      [onChange]
    );

    // Keep a ref so the moveend closure (created once) always calls the latest version
    const emitLocationRef = React.useRef(emitLocation);
    React.useEffect(() => { emitLocationRef.current = emitLocation; }, [emitLocation]);

    /* ── Nominatim search ───────────────────────────────────────────────── */
    const fetchSuggestions = React.useCallback((query: string) => {
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

    /* ── "Use my location" button handler ──────────────────────────────── */
    const handleUseMyLocation = React.useCallback(() => {
      if (!navigator.geolocation) {
        toast.error("Geolocation is not supported by your browser.");
        return;
      }
      // If previously denied, re-attempt and let the browser decide;
      // on second failure we'll show the toast again.
      setGpsLoading(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setGpsLoading(false);
          setGpsDenied(false);
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setGpsCoords([lat, lng]);

          // Clear locationRef so moveend dedup doesn't skip the reverse-geocode
          locationRef.current = null;

          const mapAny = mapInstanceRef.current as any;
          mapAny?.setCenter?.({ lat, lng });
          mapAny?.setZoom?.(ZOOM_SELECTED);
        },
        (err) => {
          setGpsLoading(false);
          if (err.code === 1 /* PERMISSION_DENIED */) {
            setGpsDenied(true);
            toast.error("Location access denied — enable it in your browser settings and try again.");
          } else {
            toast.error("Couldn't get your location. Please try again.");
          }
        },
        { timeout: 8000, maximumAge: 0, enableHighAccuracy: true },
      );
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

              // Immediately emit coordinates as a placeholder
              const coordFallback = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
              emitLocationRef.current(lat, lng, coordFallback);

              // Reverse-geocode the new centre via Nominatim
              reverseAbortRef.current?.abort();
              reverseAbortRef.current = new AbortController();
              setReverseLoading(true);

              const params = new URLSearchParams({
                lat: String(lat),
                lon: String(lng),
                format: "json",
              });

              fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
                signal: reverseAbortRef.current.signal,
                headers: { "Accept": "application/json", "Accept-Language": "en" },
              })
                .then(r => r.json())
                .then((data: { display_name?: string }) => {
                  if (cancelled) return;
                  setReverseLoading(false);
                  const address = (data.display_name ?? "")
                    .replace(/,\s*India\s*$/, "");
                  if (address) emitLocationRef.current(lat, lng, address);
                })
                .catch(err => {
                  if ((err as Error).name === "AbortError") return;
                  setReverseLoading(false);
                  // keep coordinate fallback already emitted above
                });
            });
          }

          // Store SDK ref and mark map ready for GPS blue dot effect
          mapplsSdkRef.current = mappls;
          setSdkLoading(false);
          if (!cancelled) setMapInitialized(true);
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
        reverseAbortRef.current?.abort();
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        // Clean up GPS dot before removing map
        if (gpsDotRef.current) {
          try { gpsDotRef.current.remove?.(); } catch { /* ignore */ }
          gpsDotRef.current = null;
        }
        try { mapInstanceRef.current?.remove(); } catch { /* ignore */ }
        mapInstanceRef.current = null;
        mapplsSdkRef.current = null;
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
                      e.preventDefault();
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

            {/* GPS indicator hint — shown while GPS is pending */}
            {!sdkLoading && !sdkError && !gpsCoords && (
              <div className="absolute top-2 left-0 right-0 flex justify-center pointer-events-none">
                <span className="flex items-center gap-1 bg-black/45 text-white text-[10px] px-2.5 py-1 rounded-full">
                  <Navigation2 size={10} />
                  Detecting your location…
                </span>
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

            {/* Use My Location button — floating bottom-right of map */}
            {!sdkLoading && !sdkError && (
              <button
                type="button"
                onClick={handleUseMyLocation}
                disabled={gpsLoading}
                title="Use my current location"
                className="absolute bottom-10 right-2 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-background shadow-md border border-border hover:bg-muted transition-colors active:scale-95 disabled:opacity-60"
                style={{ pointerEvents: "all" }}
              >
                {gpsLoading ? (
                  <Loader2 size={16} className="animate-spin text-primary" />
                ) : (
                  <Navigation2
                    size={16}
                    className={gpsDenied ? "text-muted-foreground" : "text-primary"}
                  />
                )}
              </button>
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
            {reverseLoading
              ? <Loader2 size={15} className="mt-0.5 flex-shrink-0 text-primary animate-spin" />
              : <Navigation2 size={15} className="mt-0.5 flex-shrink-0 text-primary" />
            }
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide mb-0.5">
                Selected Location
              </p>
              <p className={cn("text-sm leading-relaxed break-words", reverseLoading ? "text-muted-foreground" : "text-foreground")}>
                {reverseLoading ? "Finding address…" : displayAddress}
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
