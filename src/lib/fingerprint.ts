import FingerprintJS from "@fingerprintjs/fingerprintjs";

let cached: Promise<string> | null = null;

/**
 * Returns a stable visitor hash for the current device/browser. Lazy-loads the
 * FingerprintJS agent once per page; subsequent calls reuse the cached promise.
 * Falls back to a random-but-persisted UUID in localStorage if FP fails.
 */
export function getDeviceFingerprint(): Promise<string> {
  if (cached) return cached;

  cached = (async () => {
    try {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      return result.visitorId;
    } catch (err) {
      console.warn("[CampusBee] FingerprintJS failed, falling back:", err);
      const KEY = "campusbee_fallback_fp";
      const existing = localStorage.getItem(KEY);
      if (existing) return existing;
      const fallback =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `fb-${Math.random().toString(36).slice(2)}-${Date.now()}`;
      localStorage.setItem(KEY, fallback);
      return fallback;
    }
  })();

  return cached;
}

/** Best-effort caller IP via ipify. Returns null on failure. */
export async function getClientIp(): Promise<string | null> {
  try {
    const res = await fetch("https://api.ipify.org?format=json", {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { ip?: string };
    return typeof json.ip === "string" ? json.ip : null;
  } catch {
    return null;
  }
}
