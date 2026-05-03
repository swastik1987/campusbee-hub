/**
 * Mappls (MapMyIndia) JS SDK loader.
 *
 * Loads the Web SDK once on demand and exposes the global `mappls` object
 * so components can render maps and use Places autocomplete without each
 * one re-injecting the script tag.
 *
 * Server-side REST calls (geocoding, OAuth) live in `geocode.ts` and go
 * through a Supabase edge function — never call those directly from the
 * client because they need MAPPLS_CLIENT_SECRET.
 */

const MAPPLS_API_KEY = import.meta.env.VITE_MAPPLS_API_KEY as string | undefined;

const SDK_URL = MAPPLS_API_KEY
  ? `https://apis.mappls.com/advancedmaps/api/${MAPPLS_API_KEY}/map_sdk?layer=vector&v=3.0`
  : null;

const PLACES_SDK_URL = MAPPLS_API_KEY
  ? `https://apis.mappls.com/advancedmaps/api/${MAPPLS_API_KEY}/map_sdk_plugins?v=3.0`
  : null;

let loadPromise: Promise<typeof window.mappls> | null = null;

/** Mappls v3 uses {lat, lng} objects throughout (NOT arrays). */
export type MapplsLatLng = { lat: number; lng: number };

declare global {
  interface Window {
    mappls?: {
      Map: new (
        container: string,           // string element-ID only in v3
        opts: {
          center: MapplsLatLng;
          zoom?: number;
          zoomControl?: boolean;
          location?: boolean;
        }
      ) => MapplsMap;
      Marker: new (opts: {
        map: MapplsMap;
        position: MapplsLatLng;
        draggable?: boolean;
        icon?: string;
      }) => MapplsMarker;
      placeAutocomplete?: (
        input: HTMLInputElement,
        opts?: {
          location?: string;
          region?: string;
          height?: string;
          width?: string;
          hyperlink?: boolean;
          tokenizeAddress?: boolean;
        },
        callback?: (data: MapplsAutocompleteResult) => void
      ) => void;
      ReverseGeocode?: (opts: {
        lat: number;
        lng: number;
        callback: (data: MapplsReverseGeocodeResult) => void;
      }) => void;
    };
  }
}

export type MapplsMap = {
  setCenter: (latLng: MapplsLatLng) => void;
  setZoom: (zoom: number) => void;
  getCenter: () => MapplsLatLng;
  on: (event: string, handler: (e: unknown) => void) => void;
  remove: () => void;
};

export type MapplsReverseGeocodeResult = {
  results?: Array<{
    formatted_address?: string;
    place_name?: string;
    city?: string;
    state?: string;
  }>;
};

export type MapplsMarker = {
  setPosition: (latLng: MapplsLatLng) => void;
  getPosition: () => MapplsLatLng;
  on: (event: string, handler: (e: unknown) => void) => void;
  remove: () => void;
};

export type MapplsAutocompleteResult = {
  placeName?: string;
  placeAddress?: string;
  formattedAddress?: string;
  latitude?: number;
  longitude?: number;
  eLoc?: string;
};

/**
 * Idempotent loader. Resolves with `window.mappls` once both the core SDK
 * and the plugins (Places autocomplete) have loaded.
 */
export function loadMappls(): Promise<typeof window.mappls> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Mappls SDK can only load in the browser"));
  }
  if (!MAPPLS_API_KEY || !SDK_URL || !PLACES_SDK_URL) {
    return Promise.reject(
      new Error(
        "VITE_MAPPLS_API_KEY is not set. Add it to .env and restart the dev server."
      )
    );
  }
  if (window.mappls) {
    return Promise.resolve(window.mappls);
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = new Promise((resolve, reject) => {
    const inject = (src: string): Promise<void> =>
      new Promise((ok, fail) => {
        const existing = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
        if (existing) {
          if (existing.dataset.loaded === "true") return ok();
          existing.addEventListener("load", () => ok(), { once: true });
          existing.addEventListener("error", () => fail(new Error(`failed to load ${src}`)), {
            once: true,
          });
          return;
        }
        const tag = document.createElement("script");
        tag.src = src;
        tag.async = true;
        tag.defer = true;
        tag.dataset.loaded = "false";
        tag.addEventListener(
          "load",
          () => {
            tag.dataset.loaded = "true";
            ok();
          },
          { once: true }
        );
        tag.addEventListener(
          "error",
          () => fail(new Error(`failed to load ${src}`)),
          { once: true }
        );
        document.head.appendChild(tag);
      });

    inject(SDK_URL!)
      .then(() => inject(PLACES_SDK_URL!))
      .then(() => {
        if (window.mappls) {
          resolve(window.mappls);
        } else {
          reject(new Error("Mappls SDK loaded but window.mappls is undefined"));
        }
      })
      .catch((err) => {
        loadPromise = null; // allow retry
        reject(err);
      });
  });

  return loadPromise;
}

export const mapplsConfig = {
  hasKey: !!MAPPLS_API_KEY,
  apiKey: MAPPLS_API_KEY,
};
