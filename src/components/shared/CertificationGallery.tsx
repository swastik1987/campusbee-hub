import React, { useState } from "react";
import type { Certification } from "@/hooks/useCertifications";
import { Award } from "lucide-react";

// ── Props ──────────────────────────────────────────────────────────────────────

interface CertificationGalleryProps {
  certs: Certification[];
  /** Compact single-row scrollable layout vs. grid */
  layout?: "scroll" | "grid";
}

// ── Lightbox ───────────────────────────────────────────────────────────────────

interface LightboxProps {
  cert: Certification;
  onClose: () => void;
}

const Lightbox = React.forwardRef<HTMLDivElement, LightboxProps>(
  ({ cert, onClose }, ref) => (
    <div
      ref={ref}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/80 p-4"
      onClick={onClose}
    >
      <div
        className="relative max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={cert.image_url}
          alt={cert.name}
          className="w-full rounded-xl object-contain max-h-[60vh]"
        />
        <div className="mt-3 text-center space-y-0.5">
          <p className="text-white font-semibold text-sm">{cert.name}</p>
          {cert.issuing_authority && (
            <p className="text-white/70 text-xs">{cert.issuing_authority}</p>
          )}
          {cert.year_obtained && (
            <p className="text-white/50 text-xs">{cert.year_obtained}</p>
          )}
        </div>
        <button
          className="absolute -top-3 -right-3 h-7 w-7 rounded-full bg-white/20 text-white text-sm flex items-center justify-center"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
    </div>
  )
);
Lightbox.displayName = "Lightbox";

// ── Main component ─────────────────────────────────────────────────────────────

const CertificationGallery = React.forwardRef<
  HTMLDivElement,
  CertificationGalleryProps
>(({ certs, layout = "scroll" }, ref) => {
  const [lightbox, setLightbox] = useState<Certification | null>(null);

  if (certs.length === 0) return null;

  return (
    <>
      <div ref={ref}>
        {/* Section header */}
        <h3 className="text-sm font-bold mb-2 flex items-center gap-1.5">
          <Award size={15} className="text-provider" />
          Certifications
        </h3>

        {layout === "scroll" ? (
          /* Horizontal scrollable row */
          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
            {certs.map((cert) => (
              <button
                key={cert.id}
                className="flex-shrink-0 w-24 text-left focus:outline-none"
                onClick={() => setLightbox(cert)}
              >
                <img
                  src={cert.image_url}
                  alt={cert.name}
                  className="h-24 w-24 object-cover rounded-lg border border-border"
                />
                <p className="text-[10px] font-medium mt-1 line-clamp-2 leading-tight">
                  {cert.name}
                </p>
                {cert.issuing_authority && (
                  <p className="text-[9px] text-muted-foreground line-clamp-1">
                    {cert.issuing_authority}
                  </p>
                )}
              </button>
            ))}
          </div>
        ) : (
          /* 3-column grid */
          <div className="grid grid-cols-3 gap-2">
            {certs.map((cert) => (
              <button
                key={cert.id}
                className="text-left focus:outline-none"
                onClick={() => setLightbox(cert)}
              >
                <img
                  src={cert.image_url}
                  alt={cert.name}
                  className="h-24 w-full object-cover rounded-lg border border-border"
                />
                <p className="text-[10px] font-medium mt-1 line-clamp-2 leading-tight">
                  {cert.name}
                </p>
                {cert.issuing_authority && (
                  <p className="text-[9px] text-muted-foreground line-clamp-1">
                    {cert.issuing_authority}
                  </p>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox portal */}
      {lightbox && (
        <Lightbox cert={lightbox} onClose={() => setLightbox(null)} />
      )}
    </>
  );
});

CertificationGallery.displayName = "CertificationGallery";

export default CertificationGallery;
