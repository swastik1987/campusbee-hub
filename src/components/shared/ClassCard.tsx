import * as React from "react";
import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Home, MapPin, Star } from "lucide-react";
import { formatDistance } from "@/hooks/useLocation";
import {
  useTrackSponsoredImpression,
  useTrackSponsoredClick,
} from "@/hooks/useSponsored";

type ClassCardProps = {
  cls: {
    id: string;
    title: string;
    short_description?: string | null;
    cover_image_url?: string | null;
    class_type?: string | null;
    total_rating?: number | null;
    rating_count?: number | null;
    is_home_based?: boolean | null;
    address?: string | null;
    /** Distance from seeker's home (km) — computed client-side, optional */
    distanceKm?: number | null;
    class_categories?: { name: string; slug: string } | null;
    /** v2: direct service_providers join on classes */
    service_providers?: {
      business_name?: string | null;
      provider_type?: string | null;
      users?: { full_name: string; avatar_url: string | null } | null;
    } | null;
    batches?: {
      fee_amount: number;
      fee_frequency: string;
      status: string | null;
      max_batch_size: number;
      current_enrollment_count: number | null;
      batch_schedules?: { day_of_week: number; start_time: string; end_time: string }[] | null;
    }[] | null;
    /** Trust markers — computed by Explore.tsx before passing to ClassCard */
    isSponsored?: boolean;
    isNew?: boolean;
    isPopular?: boolean;
  };
  variant?: "horizontal" | "vertical";
};

const FEE_LABELS: Record<string, string> = {
  per_session: "/session",
  monthly: "/mo",
  quarterly: "/qtr",
  for_duration: " total",
  one_time: "",
};

/** Truncate an address to the first comma-separated segment. */
function shortAddress(address: string): string {
  const first = address.split(",")[0]?.trim() ?? address;
  return first.length > 36 ? first.slice(0, 34) + "…" : first;
}

const ClassCard = React.forwardRef<HTMLDivElement, ClassCardProps>(
  ({ cls, variant = "horizontal" }, ref) => {
  const navigate = useNavigate();
  const trackSponsoredImpression = useTrackSponsoredImpression();
  const trackSponsoredClick = useTrackSponsoredClick();

  // Sponsored impression tracking — fires once per session when ≥50% of the
  // sponsored card is in the viewport. Session-dedupe lives in the hook.
  const cardRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!cls.isSponsored || !cardRef.current) return;
    const node = cardRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          trackSponsoredImpression(cls.id);
          observer.disconnect();
        }
      },
      { threshold: 0.5 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [cls.id, cls.isSponsored, trackSponsoredImpression]);

  const handleCardClick = () => {
    if (cls.isSponsored) trackSponsoredClick(cls.id);
    navigate(`/class/${cls.id}`);
  };

  const provider = cls.service_providers;
  const providerName = provider?.business_name || provider?.users?.full_name || "Instructor";

  // Find lowest fee from active batches
  const activeBatches = cls.batches?.filter((b) => b.status === "active" || b.status === "full") ?? [];
  const lowestFee = activeBatches.length > 0
    ? Math.min(...activeBatches.map((b) => b.fee_amount))
    : null;
  const lowestBatch = activeBatches.find((b) => b.fee_amount === lowestFee);

  // Available slots
  const totalSlots = activeBatches.reduce((acc, b) => acc + b.max_batch_size - (b.current_enrollment_count ?? 0), 0);

  const distanceLabel = cls.distanceKm != null ? formatDistance(cls.distanceKm) : null;
  const addressLine = cls.address ? shortAddress(cls.address) : null;

  // Combine the outer forwardRef with our internal IntersectionObserver ref.
  const setCardNode = (node: HTMLDivElement | null) => {
    cardRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
  };

  if (variant === "vertical") {
    return (
      <Card
        ref={setCardNode}
        className="w-44 flex-shrink-0 cursor-pointer overflow-hidden transition-all hover:shadow-md active:scale-[0.98]"
        onClick={handleCardClick}
      >
        {cls.cover_image_url ? (
          <img src={cls.cover_image_url} alt="" className="h-24 w-full object-cover" />
        ) : (
          <div className="flex h-24 w-full items-center justify-center bg-muted">
            <BookOpen size={24} className="text-muted-foreground" />
          </div>
        )}
        <div className="p-2.5 space-y-1">
          <h4 className="text-xs font-semibold truncate">{cls.title}</h4>
          <p className="text-[10px] text-muted-foreground truncate">{providerName}</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            {cls.is_home_based && (
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Home size={9} />
                Home-based
              </span>
            )}
            {(cls.rating_count ?? 0) > 0 && (
              <span className="flex items-center gap-0.5 text-[10px]">
                <Star size={10} className="text-amber-500 fill-amber-500" />
                {cls.total_rating}
              </span>
            )}
            {lowestFee !== null && (
              <span className="text-[10px] font-semibold text-primary">
                ₹{lowestFee}{FEE_LABELS[lowestBatch?.fee_frequency ?? ""] ?? ""}
              </span>
            )}
          </div>
          {distanceLabel && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
              <MapPin size={9} />
              {distanceLabel}
            </span>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card
      ref={setCardNode}
      className="flex gap-3 p-3 cursor-pointer transition-all hover:shadow-md active:scale-[0.99]"
      onClick={handleCardClick}
    >
      {cls.cover_image_url ? (
        <img src={cls.cover_image_url} alt="" className="h-20 w-20 rounded-lg object-cover flex-shrink-0" />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted flex-shrink-0">
          <BookOpen size={24} className="text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        {/* Row 1 — Title + distance badge */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold truncate">{cls.title}</h3>
          {distanceLabel && (
            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
              <MapPin size={9} />
              {distanceLabel}
            </span>
          )}
        </div>

        {/* Row 2 — Provider name + Rating */}
        <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="truncate">
            {providerName}
            {provider?.provider_type === "academy" && (
              <Badge variant="secondary" className="ml-1 text-[9px] px-1 py-0">Academy</Badge>
            )}
          </span>
          {(cls.rating_count ?? 0) > 0 && (
            <span className="flex items-center gap-0.5 shrink-0">
              <Star size={11} className="text-amber-500 fill-amber-500" />
              {cls.total_rating}
              <span className="text-[10px]">({cls.rating_count})</span>
            </span>
          )}
        </div>

        {/* Row 3 — Trust badges */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {cls.isSponsored && (
            <Badge className="text-[10px] border-0 bg-amber-50 text-amber-700 border border-amber-200 gap-0.5 px-1.5">
              ✦ Sponsored
            </Badge>
          )}
          {cls.isNew && (
            <Badge className="text-[10px] border-0 bg-blue-50 text-blue-700 border border-blue-200 px-1.5">
              ✦ New
            </Badge>
          )}
          {cls.isPopular && (
            <Badge className="text-[10px] border-0 bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5">
              ★ Popular
            </Badge>
          )}
          {cls.class_categories?.name && (
            <Badge variant="outline" className="text-[10px]">{cls.class_categories.name}</Badge>
          )}
          {cls.is_home_based && (
            <Badge variant="secondary" className="text-[10px] gap-0.5 px-1.5">
              <Home size={10} />
              Home-based
            </Badge>
          )}
        </div>

        {/* Row 4 — Class location (if available) */}
        {addressLine && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin size={10} className="shrink-0" />
            <span className="truncate">{addressLine}</span>
          </p>
        )}

        {/* Row 5 — Fees starting from … (if batches exist) */}
        {lowestFee !== null && (
          <p className="mt-1 text-xs">
            <span className="text-muted-foreground">Starting from </span>
            <span className="font-semibold text-foreground">
              ₹{lowestFee}{FEE_LABELS[lowestBatch?.fee_frequency ?? ""] ?? ""}
            </span>
          </p>
        )}

        {/* Row 6 — Low-availability nudge */}
        {totalSlots > 0 && totalSlots <= 5 && (
          <p className="mt-0.5 text-[10px] font-medium text-green-600">{totalSlots} spots left</p>
        )}
      </div>
    </Card>
  );
});

ClassCard.displayName = "ClassCard";

export default ClassCard;
