/**
 * Phase 8 — Explore page featured-banner carousel.
 *
 * Renders a horizontal swipe carousel of the top 5 active featured banners
 * for the seeker's location, distance-ranked.  Auto-cycles every 4 seconds.
 *
 * - Featured tag is overlaid on the top-right of each banner.
 * - Class name is intentionally NOT rendered on the banner image.
 * - Impressions tracked once per banner per session.
 * - Clicks route to the banner's target_url (internal /path or external) or
 *   fall back to the linked class detail page.
 *
 * home_banner was removed in migration 033 — only explore banners ship now.
 */

import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useFeaturedBannersForLocation,
  useTrackBannerImpression,
  useTrackBannerClick,
  type FeaturedBannerForLocationRow,
} from "@/hooks/useSponsored";

const MAX_SLOTS = 5;
const ROTATION_MS = 4_000;

type Props = {
  lat?: number | null;
  lng?: number | null;
  className?: string;
};

const SeekerBanners = React.forwardRef<HTMLDivElement, Props>(({ lat, lng, className }, ref) => {
  const navigate = useNavigate();
  const trackImpression = useTrackBannerImpression();
  const trackClick = useTrackBannerClick();

  const { data } = useFeaturedBannersForLocation({
    surface: "explore_banner",
    lat: lat ?? null,
    lng: lng ?? null,
  });

  const banners = (data ?? []).slice(0, MAX_SLOTS);

  const [currentSlide, setCurrentSlide] = useState(0);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Impressions — once per banner per session
  useEffect(() => {
    banners.forEach((b) => trackImpression(b.id));
  }, [banners, trackImpression]);

  // Auto-rotate
  useEffect(() => {
    if (banners.length <= 1) return;
    const t = setInterval(() => {
      setCurrentSlide((prev) => {
        const next = (prev + 1) % banners.length;
        const el = scrollerRef.current;
        if (el) el.scrollTo({ left: next * el.offsetWidth, behavior: "smooth" });
        return next;
      });
    }, ROTATION_MS);
    return () => clearInterval(t);
  }, [banners.length]);

  // Manual swipe → keep indicator in sync
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const onScroll = () => setCurrentSlide(Math.round(el.scrollLeft / el.offsetWidth));
    el.addEventListener("scrollend", onScroll);
    return () => el.removeEventListener("scrollend", onScroll);
  }, []);

  if (!banners.length) return null;

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
                <div className="pointer-events-none absolute right-2 top-2 rounded-full bg-gradient-to-r from-[#FCD34D] to-[#F59E0B] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
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
});

SeekerBanners.displayName = "SeekerBanners";

export default SeekerBanners;
