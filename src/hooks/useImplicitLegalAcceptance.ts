import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/contexts/UserContext";
import { getClientIp, getDeviceFingerprint } from "@/lib/fingerprint";

/**
 * Records implicit acceptance of T&Cs + Privacy Policy for a freshly created
 * user. Triggered when `isNewUser` flips true in UserContext. Best-effort —
 * any failure is logged but never throws (legal records should not block
 * sign-in). Idempotent within a session via a ref guard.
 */
export function useImplicitLegalAcceptance() {
  const { isNewUser, profile } = useUser();
  const firedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isNewUser || !profile || firedFor.current === profile.id) return;
    firedFor.current = profile.id;

    (async () => {
      try {
        const [ip, fingerprint] = await Promise.all([
          getClientIp(),
          getDeviceFingerprint(),
        ]);
        const userAgent =
          typeof navigator !== "undefined" ? navigator.userAgent : null;

        for (const docType of ["terms", "privacy"] as const) {
          const { error } = await supabase.rpc("record_legal_acceptance", {
            p_doc_type: docType,
            p_ip: ip,
            p_user_agent: userAgent,
            p_fingerprint: fingerprint,
          });
          if (error) {
            console.warn(
              `[CampusBee] record_legal_acceptance(${docType}) failed:`,
              error.message,
            );
          }
        }
      } catch (err) {
        console.warn("[CampusBee] implicit legal acceptance failed:", err);
      }
    })();
  }, [isNewUser, profile]);
}
