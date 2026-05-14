/**
 * Phase 8 — Seeker-facing featured banner rotator / carousel.
 *
 * Surfaces:
 *   - "home_banner"    → single rotating banner (Landing).  Auto-cycles every 6s.
 *   - "explore_banner" → horizontal swipe carousel (Explore).  Auto-cycles every 4s.
 *
 * Renders nothing when there are no active banners for the seeker location.
 * Fires impression count on first appearance (deduped per session); click
 * count on tap-through.
 */

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useFeaturedBannersForLocation,
  useTrackBannerImpression,
  useTrackBannerClick,
  type FeaturedBannerForLocationRow,
  type FeaturedBannerSurface,
} from "@/hooks/useSponsored";

type Props = {
  surface: FeaturedBannerSurface;
  /** Required for explore_banner; ignored for home_banner. */
  lat?: number | null;
  lng?: number | null;
  className?: string;
};

const SeekerBanners = React.forwardRef<HTMLDivElement, Props>(
  ({ surface, lat, lng, className }, ref) => {
    const navigate = useNavigate();
    const trackImpression = useTrackBannerImpression();
    const trackClick = useTrackBannerClick();

    const { data: banners } = useFeaturedBannersForLocation({
      surface,
      lat: lat ?? null,
      lng: lng ?? null,
    });

    const [currentSlide, setCurrentSlide] = useState(0);
    const scrollerRef = useRef<HTMLDivElement>(null);
    const intervalMs = surface === "home_banner" ? 6000 : 4000;

    // Impression tracking (once per banner per session)
    useEffect(() => {
      banners?.forEach((b) => trackImpression(b.id));
    }, [banners, trackImpression]);

    // Auto-cycle
    useEffect(() => {
      if (!banners || banners.length <= 1) return;
      const t = setInterval(() => {
        setCurrentSlide((prev) => {
          const next = (prev + 1) % banners.length;
          const el = scrollerRef.current;
          if (el) el.scrollTo({ left: next * el.offsetWidth, behavior: "smooth" });
          return next;
        });
      }, intervalMs);
      return () => clearInterval(t);
    }, [banners, intervalMs]);

    useEffect(() => {
      const el = scrollerRef.current;
      if (!el) return;
      const onScroll = () => setCurrentSlide(Math.round(el.scrollLeft / el.offsetWidth));
      el.addEventListener("scrollend", onScroll);
      return () => el.removeEventListener("scrollend", onScroll);
    }, []);

    if (!banners?.length) return null;

    const goToTarget = (banner: FeaturedBannerForLocationRow) => {
      trackClick(banner.id);
      if (banner.target_url) {
        if (banner.target_url.startsWith("/")) navigate(banner.target_url);
        else window.open(banner.target_url, "_blank", "noopener");
      } else if (banner.class_id) {
        navigate(`/class/${banner.class_id}`);
      }
    };

    return (
      <div ref={ref} className={className}>
        <div className="relative">
          <div
            ref={scrollerRef}
            className="flex overflow-x-auto scrollbar-hide"
            style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
          >
            {banners.map((b) => (
              <div
                key={b.id}
                className="w-full flex-shrink-0 cursor-pointer"
                style={{ scrollSnapAlign: "start", minWidth: "100%" }}
                onClick={() => goToTarget(b)}
              >
                <div className="relative aspect-[16/7] overflow-hidden rounded-2xl">
                  <img src={b.image_url} alt="" className="h-full w-full object-cover" />
                  <div className="pointer-events-none absolute top-2 left-2 rounded-full bg-gradient-to-r from-[#FCD34D] to-[#F59E0B] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                    Featured
                  </div>
                </div>
              </div>
            ))}
          </div>
          {banners.length > 1 && (
            <div className="mt-2 flex justify-center gap-1.5">
              {banners.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === currentSlide ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }
);

SeekerBanners.displayName = "SeekerBanners";

export default SeekerBanners;
