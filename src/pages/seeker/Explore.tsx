import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  useInfiniteExploreClasses,
  useNearbyClassIds,
  usePlatformSettings,
  useActiveSponsoredClassIds,
  useMyEnrollments,
} from "@/hooks/useSeeker";
import { useIncomingInvites } from "@/hooks/useFamilyLinking";
import { useCategories } from "@/hooks/useClasses";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateSeekerLocation, haversineKm, formatDistance, type LocationValue } from "@/hooks/useLocation";
import MapplsPicker from "@/components/location/MapplsPicker";
import Header from "@/components/layout/Header";
import ClassCard from "@/components/shared/ClassCard";
import SeekerBanners from "@/components/shared/SeekerBanners";
import BottomNav from "@/components/BottomNav";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Slider } from "@/components/ui/slider";
import {
  Search,
  ChevronUp,
  ChevronDown,
  X,
  Trophy,
  Swords,
  Music,
  Palette,
  GraduationCap,
  Guitar,
  Heart,
  Globe,
  Dumbbell,
  Leaf,
  Code,
  Sparkles,
  BookOpen,
  Users,
  MapPin,
  Pencil,
  Navigation2,
  ChevronRight,
  BookMarked,
} from "lucide-react";
import { toast } from "sonner";

const SORT_OPTIONS = [
  { value: "newest",  label: "Newest"    },
  { value: "rating",  label: "Top Rated" },
  { value: "popular", label: "Popular"   },
];

const CATEGORY_ICONS: Record<string, typeof Trophy> = {
  Trophy, Swords, Music, Palette, GraduationCap, Guitar, Heart, Globe,
  Dumbbell, Leaf, Code, Sparkles,
};

// Full-spectrum hues for category pills — one per category, visually distinct
const PILL_HUES = [22, 340, 280, 195, 240, 130, 160, 50, 310, 175, 210, 260];

// Suppress unused-import warning — formatDistance is used inside ClassCard via the hook
void formatDistance;

const Explore = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { profile, refreshProfile } = useUser();
  const queryClient = useQueryClient();
  const updateLocation = useUpdateSeekerLocation();

  // Location picker sheet
  const [showLocationSheet, setShowLocationSheet] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<LocationValue | null>(null);

  const handleSaveLocation = async () => {
    if (!profile || !pendingLocation) return;
    try {
      await updateLocation.mutateAsync({ userId: profile.id, ...pendingLocation });
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["explore-classes"] });
      setShowLocationSheet(false);
      setPendingLocation(null);
      toast.success("Location updated");
    } catch {
      toast.error("Failed to save location");
    }
  };

  const [search, setSearch]               = useState(params.get("search")   ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [categorySlug, setCategorySlug]   = useState(params.get("category") ?? "");
  const [sort, setSort]                   = useState(params.get("sort")      ?? "newest");
  const [searchRadius, setSearchRadius]   = useState(10);
  const [pillsExpanded, setPillsExpanded] = useState(true);
  const [radiusSheet, setRadiusSheet]     = useState(false);

  const { data: allCategories } = useCategories();
  const parentCategories  = allCategories?.filter((c) => !c.parent_id) ?? [];
  const activeCatIdx      = categorySlug ? parentCategories.findIndex((c) => c.slug === categorySlug) : -1;
  const activeCat         = activeCatIdx >= 0 ? parentCategories[activeCatIdx] : null;
  const ActiveCatIcon     = activeCat ? (CATEGORY_ICONS[activeCat.icon ?? ""] ?? BookOpen) : null;
  const activeCatHue      = activeCatIdx >= 0 ? PILL_HUES[activeCatIdx % PILL_HUES.length] : 250;

  // Resolve selected parent category → include all child IDs
  const selectedCategoryIds = (() => {
    if (!categorySlug || !allCategories) return undefined;
    const parent = allCategories.find((c) => c.slug === categorySlug && !c.parent_id);
    if (parent) {
      const childIds = allCategories.filter((c) => c.parent_id === parent.id).map((c) => c.id);
      return [parent.id, ...childIds];
    }
    const sub = allCategories.find((c) => c.slug === categorySlug);
    return sub ? [sub.id] : undefined;
  })();

  // Category IDs that match the text search term
  const searchCategoryIds = (() => {
    if (!debouncedSearch || !allCategories) return undefined;
    const term = debouncedSearch.toLowerCase();
    const matching = allCategories.filter((c) => c.name.toLowerCase().includes(term));
    return matching.length > 0 ? matching.map((c) => c.id) : undefined;
  })();

  // Intersect when both active; else use whichever is set
  const combinedCategoryIds = (() => {
    if (selectedCategoryIds && searchCategoryIds) {
      return selectedCategoryIds.filter((id) => searchCategoryIds.includes(id));
    }
    return selectedCategoryIds;
  })();

  // 300 ms debounce on search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Auto-collapse categories when scrolling down; expand near top.
  // Hysteresis (separate collapse/expand thresholds) + direction-awareness +
  // a short post-toggle lockout prevent the layout-shift loop that otherwise
  // makes the section flicker open/closed on short pages.
  useEffect(() => {
    const COLLAPSE_AT = 120;
    const EXPAND_AT   = 24;
    const LOCKOUT_MS  = 450;
    let lastY = window.scrollY;
    let lockUntil = 0;
    let rafId: number | null = null;

    const update = () => {
      rafId = null;
      if (Date.now() < lockUntil) return;

      const y = window.scrollY;
      const goingDown = y > lastY;
      lastY = y;

      setPillsExpanded((prev) => {
        if (prev && goingDown && y > COLLAPSE_AT) {
          lockUntil = Date.now() + LOCKOUT_MS;
          return false;
        }
        if (!prev && y <= EXPAND_AT) {
          lockUntil = Date.now() + LOCKOUT_MS;
          return true;
        }
        return prev;
      });
    };

    const onScroll = () => {
      if (rafId === null) rafId = window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, []);

  const isSearching = !!debouncedSearch;

  // Distance helpers
  const seekerLat = profile?.seeker_home_lat ?? null;
  const seekerLng = profile?.seeker_home_lng ?? null;
  const hasLocation = seekerLat != null && seekerLng != null;

  // Step 1: PostGIS RPC returns IDs (and distance) of every published+approved
  // class within radius. Cached separately so changing sort/search/pagination
  // doesn't refetch it.
  const { data: nearbyDistances, isLoading: nearbyLoading } = useNearbyClassIds({
    lat: seekerLat,
    lng: seekerLng,
    radiusKm: searchRadius,
    categoryId: activeCat?.id ?? null,
  });

  // Only restrict the paginated query to the RPC's ID set when the RPC
  // actually returned something. If it comes back empty (e.g. before the
  // geo-backfill migration has been applied, or if a class row is missing
  // its geography column), fall back to no server-side restriction and
  // let the client-side haversine filter do its job — correctness over
  // perf in the degenerate case.
  const restrictToIds =
    hasLocation && nearbyDistances && nearbyDistances.size > 0
      ? Array.from(nearbyDistances.keys())
      : undefined;
  const usingRpcRestriction = restrictToIds !== undefined;

  // Step 2: Infinite-paginated PostgREST fetch, optionally restricted to the
  // nearby ID set. EXPLORE_PAGE_SIZE rows per page, sentinel-triggered.
  const {
    data: infiniteData,
    isLoading: pageLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteExploreClasses({
    search: debouncedSearch || undefined,
    categoryIds: combinedCategoryIds,
    searchOrCategoryIds: searchCategoryIds,
    sort,
    restrictToIds,
    enabled: !hasLocation || !nearbyLoading,
  });

  const fetchedClasses = useMemo(
    () => (infiniteData?.pages ?? []).flatMap((p) => p.rows),
    [infiniteData],
  );
  const isLoading = pageLoading || (hasLocation && nearbyLoading);

  // Distance: prefer the RPC's value (which respects home-based fallback),
  // fall back to client haversine for safety.
  const computeDistance = (cls: any): number | null => {
    const rpcDist = nearbyDistances?.get(cls.id);
    if (rpcDist != null) return rpcDist;
    if (!hasLocation || !cls.location_lat || !cls.location_lng) return null;
    return haversineKm(
      { lat: seekerLat!, lng: seekerLng! },
      { lat: cls.location_lat, lng: cls.location_lng },
    );
  };

  // Radius filter: when the RPC delivered a non-empty restriction, the
  // server has already filtered for us — skip the client pass. Otherwise
  // fall back to haversine on the denormalized lat/lng columns so the
  // page stays correct even when the RPC degrades.
  const withinRadius = (cls: any): boolean => {
    if (usingRpcRestriction) return true;
    if (!hasLocation || cls.location_lat == null || cls.location_lng == null) return true;
    const dist = haversineKm(
      { lat: seekerLat!, lng: seekerLng! },
      { lat: cls.location_lat, lng: cls.location_lng },
    );
    return cls.is_home_based ? dist <= (cls.home_radius_km ?? 5) : dist <= searchRadius;
  };

  // Search merge no longer needed: the infinite query handles
  // title/short_description ilike and category intersection in one pass.
  // Provider-name search is deferred to a follow-up improvement — surfacing
  // it consistently requires either a full-text index or a server RPC.
  const rawDisplayClasses = fetchedClasses;

  // Trust-marker thresholds from platform_settings
  const { data: platformSettings }  = usePlatformSettings();
  const { data: sponsoredClassIds } = useActiveSponsoredClassIds({
    lat: seekerLat,
    lng: seekerLng,
    categoryId: activeCat?.id ?? null,
  });

  const newThresholdDays      = parseInt(platformSettings?.new_class_days_threshold  ?? "7");
  const popularEnrollmentMin  = parseInt(platformSettings?.popular_enrollment_min    ?? "10");
  const popularRatingMin      = parseFloat(platformSettings?.popular_rating_min      ?? "4.0");
  const popularRatingCountMin = parseInt(platformSettings?.popular_rating_count_min  ?? "5");

  const applyTrustMarkers = useCallback((list: any[] | null | undefined): any[] | null | undefined => {
    if (!list) return list;
    const now = Date.now();
    const withMarkers = list.map((cls: any) => {
      const ageDays = cls.created_at ? (now - new Date(cls.created_at).getTime()) / 86_400_000 : Infinity;
      const totalEnrolled: number = (cls.batches ?? []).reduce(
        (s: number, b: any) => s + (b.current_enrollment_count ?? 0), 0,
      );
      return {
        ...cls,
        isSponsored: sponsoredClassIds?.has(cls.id) ?? false,
        isNew: ageDays <= newThresholdDays,
        isPopular:
          totalEnrolled >= popularEnrollmentMin ||
          ((cls.total_rating ?? 0) >= popularRatingMin && (cls.rating_count ?? 0) >= popularRatingCountMin),
      };
    });
    return [
      ...withMarkers.filter((c: any) => c.isSponsored),
      ...withMarkers.filter((c: any) => !c.isSponsored),
    ];
  }, [sponsoredClassIds, newThresholdDays, popularEnrollmentMin, popularRatingMin, popularRatingCountMin]);

  const activeList = useMemo(() => {
    if (!rawDisplayClasses) return rawDisplayClasses;
    const withDist = (rawDisplayClasses as any[])
      .filter(withinRadius)
      .map((cls: any) => ({ ...cls, distanceKm: computeDistance(cls) }));
    return applyTrustMarkers(withDist);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawDisplayClasses, seekerLat, seekerLng, searchRadius, applyTrustMarkers, nearbyDistances]);

  const { data: incomingInvites }  = useIncomingInvites(
    profile?.id, profile?.email ?? null, profile?.mobile_number ?? null,
  );
  const pendingInviteCount = incomingInvites?.length ?? 0;

  // Show "My Classes" shortcut only if seeker has any active/pending enrollments
  const { data: myEnrollments } = useMyEnrollments(profile?.id);
  const hasEnrollments = (myEnrollments ?? []).some(
    (e: any) => e.status === "active" || e.status === "pending",
  );

  const clearFilters = () => { setCategorySlug(""); setSearch(""); setSort("newest"); };

  // Sentinel-based infinite scroll: trigger fetchNextPage when the load marker
  // intersects the viewport. rootMargin pre-fetches one screen ahead.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!sentinelRef.current || !hasNextPage || isFetchingNextPage) return;
    const el = sentinelRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg">

        {/* ── Non-sticky top area ────────────────────────────────────────── */}
        <div className="px-4 pt-4 space-y-4">

          {/* Pending family invite banner */}
          {pendingInviteCount > 0 && (
            <button
              onClick={() => navigate("/family")}
              className="flex w-full items-center gap-3 rounded-xl bg-primary/10 px-4 py-3 text-left transition-colors hover:bg-primary/15 active:scale-[0.99]"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/20">
                <Users size={18} className="text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-primary">
                  {pendingInviteCount} family invite{pendingInviteCount > 1 ? "s" : ""} pending
                </p>
                <p className="text-xs text-muted-foreground">Tap to view and accept</p>
              </div>
              <ChevronRight size={16} className="text-primary shrink-0" />
            </button>
          )}

          {/* Featured banners (Phase 8 — explore-only, region-scoped, max 5) */}
          {!isSearching && (
            <SeekerBanners lat={seekerLat} lng={seekerLng} />
          )}

        </div>

        {/* ── STICKY: search bar + category icon pills ───────────────────── */}
        <div className="sticky top-14 z-30 border-b border-border/40 bg-background/95 backdrop-blur-sm">
          <div className="space-y-2.5 px-4 pb-3 pt-3">

            {/* Location card + (optional) My Classes shortcut — always visible */}
            <div className="flex items-stretch gap-2">
              <div
                className="flex flex-1 items-center justify-between rounded-2xl px-4 py-3 min-w-0"
                style={{ background: "linear-gradient(135deg, oklch(0.97 0.04 250), oklch(0.93 0.08 250))" }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
                    <MapPin size={16} className="text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-muted-foreground leading-none mb-0.5">Classes near</p>
                    <p className="text-sm font-bold leading-tight truncate max-w-[120px]">
                      {profile?.seeker_home_address
                        ? (profile.seeker_home_address.split(",")[0]?.trim() ?? profile.seeker_home_address)
                        : "Set your location"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setRadiusSheet(true)}
                    className="flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/25 active:scale-95"
                  >
                    <Navigation2 size={11} />
                    {searchRadius} km
                  </button>
                  <button
                    onClick={() => setShowLocationSheet(true)}
                    className="flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/25 active:scale-95"
                  >
                    <Pencil size={11} />
                    Edit
                  </button>
                </div>
              </div>
              {hasEnrollments && (
                <button
                  onClick={() => navigate("/my-classes")}
                  className="flex shrink-0 flex-col items-center justify-center gap-1 rounded-2xl border border-primary/20 bg-card px-3 py-2 text-primary transition-colors hover:bg-primary/5 active:scale-95"
                  aria-label="My Classes"
                >
                  <BookMarked size={18} />
                  <span className="text-[10px] font-semibold leading-none">My Classes</span>
                </button>
              )}
            </div>

            {/* Search row — full-width, white card */}
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search classes, sports, activities…"
                className="h-10 rounded-full border-border bg-card pl-9 pr-8 text-sm shadow-sm focus-visible:ring-primary/30"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Categories header + collapse toggle (entire row clickable) */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => setPillsExpanded((v) => !v)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setPillsExpanded((v) => !v);
                }
              }}
              aria-expanded={pillsExpanded}
              aria-label={pillsExpanded ? "Collapse categories" : "Expand categories"}
              className="flex cursor-pointer select-none items-center justify-between gap-2 rounded-md px-0.5 py-1 transition-colors hover:bg-muted/40"
            >
              <div className="flex min-w-0 items-center gap-2">
                <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {!pillsExpanded && activeCat ? "Selected Category" : "Categories"}
                </span>
                {!pillsExpanded && activeCat && ActiveCatIcon && (
                  <div
                    className="flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold"
                    style={{
                      background: `linear-gradient(135deg, oklch(0.65 0.22 ${activeCatHue}), oklch(0.52 0.24 ${activeCatHue}))`,
                      color: "#fff",
                      boxShadow: `0 2px 8px oklch(0.62 0.22 ${activeCatHue} / 0.35)`,
                    }}
                  >
                    <ActiveCatIcon size={11} style={{ color: "#fff" }} />
                    {activeCat.name}
                  </div>
                )}
              </div>
              <span className="flex shrink-0 items-center text-muted-foreground">
                {pillsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </span>
            </div>

            {/* Category icon + label pills — collapsible */}
            <div
              className="overflow-hidden"
              style={{
                maxHeight: pillsExpanded ? "240px" : "0px",
                opacity: pillsExpanded ? 1 : 0,
                transform: pillsExpanded ? "translateY(0)" : "translateY(-4px)",
                transition:
                  "max-height 400ms cubic-bezier(0.22, 1, 0.36, 1), " +
                  "opacity 260ms ease-out, " +
                  "transform 360ms cubic-bezier(0.22, 1, 0.36, 1)",
                willChange: "max-height, opacity, transform",
              }}
            >
            <div className="-mx-4 flex flex-wrap gap-2 px-4 pb-1 pt-0.5">

              {/* "All" pill */}
              <button
                onClick={() => setCategorySlug("")}
                className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all active:scale-95"
                style={{
                  background: !categorySlug
                    ? "linear-gradient(135deg, oklch(0.65 0.22 250), oklch(0.52 0.24 250))"
                    : "oklch(0.93 0.05 250)",
                  color: !categorySlug ? "#fff" : "oklch(0.42 0.18 250)",
                  boxShadow: !categorySlug ? "0 2px 8px oklch(0.62 0.22 250 / 0.35)" : "none",
                }}
              >
                <Sparkles size={12} style={{ color: !categorySlug ? "#fff" : "oklch(0.50 0.18 250)" }} />
                All
              </button>

              {/* Dynamic category pills */}
              {parentCategories.map((cat, idx) => {
                const IconComp = CATEGORY_ICONS[cat.icon ?? ""] ?? BookOpen;
                const hue = PILL_HUES[idx % PILL_HUES.length];
                const isActive = categorySlug === cat.slug;
                return (
                  <button
                    key={cat.id}
                    onClick={() => setCategorySlug(isActive ? "" : cat.slug)}
                    className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all active:scale-95"
                    style={{
                      background: isActive
                        ? `linear-gradient(135deg, oklch(0.65 0.22 ${hue}), oklch(0.52 0.24 ${hue}))`
                        : `oklch(0.93 0.06 ${hue})`,
                      color: isActive ? "#fff" : `oklch(0.38 0.18 ${hue})`,
                      boxShadow: isActive ? `0 2px 8px oklch(0.62 0.22 ${hue} / 0.35)` : "none",
                    }}
                  >
                    <IconComp size={12} style={{ color: isActive ? "#fff" : `oklch(0.45 0.22 ${hue})` }} />
                    {cat.name}
                  </button>
                );
              })}

            </div>
            </div>{/* end collapsible wrapper */}

          </div>
        </div>

        {/* ── Results: count + sort pills + class list ───────────────────── */}
        <div className="space-y-4 px-4 pb-8 pt-4">

          {/* Count + sort pills */}
          <div className="flex items-center gap-2">
            <p className="flex-1 text-xs">
              {isLoading ? (
                <span className="text-muted-foreground">Loading…</span>
              ) : (
                <>
                  <span className="font-bold text-foreground">{activeList?.length ?? 0}</span>{" "}
                  <span className="text-muted-foreground">
                    {(activeList?.length ?? 0) === 1 ? "class" : "classes"}
                    {hasLocation ? ` · within ${searchRadius} km` : ""}
                  </span>
                </>
              )}
            </p>
            <div className="flex gap-1.5">
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => setSort(o.value)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-semibold transition-all active:scale-95 ${
                    sort === o.value
                      ? "bg-primary text-white shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          {/* Loading skeletons */}
          {isLoading && (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-2xl" />
              ))}
            </div>
          )}

          {/* Class list — results */}
          {!isLoading && activeList && activeList.length > 0 && (
            <div className="space-y-3">
              {activeList.map((cls: any) => (
                <div
                  key={cls.id}
                  className={cls.isSponsored ? "relative pl-[5px]" : ""}
                >
                  {cls.isSponsored && (
                    <div
                      className="absolute left-0 top-3 bottom-3 z-10 w-[3px] rounded-full"
                      style={{ background: "linear-gradient(to bottom, #FCD34D, #F59E0B)" }}
                    />
                  )}
                  <ClassCard cls={cls as any} />
                </div>
              ))}

              {/* Infinite-scroll sentinel + next-page skeletons */}
              {hasNextPage && (
                <div ref={sentinelRef} className="space-y-3 pt-1">
                  {isFetchingNextPage &&
                    Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-24 rounded-2xl" />
                    ))}
                </div>
              )}
              {!hasNextPage && activeList.length >= 20 && (
                <p className="py-4 text-center text-[11px] text-muted-foreground">
                  You've reached the end.
                </p>
              )}
            </div>
          )}

          {/* Empty state */}
          {!isLoading && (!activeList || activeList.length === 0) && (
            <div className="flex flex-col items-center gap-4 py-14 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60">
                <Search size={26} className="text-muted-foreground/40" />
              </div>
              <div>
                <p className="text-sm font-semibold">
                  {isSearching ? "No classes match your search" : "No classes nearby yet"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {isSearching
                    ? "Try a different keyword or clear the search"
                    : hasLocation
                      ? `Nothing found within ${searchRadius} km`
                      : "Set your home location to see nearby classes"}
                </p>
              </div>
              {isSearching && (
                <button
                  onClick={clearFilters}
                  className="rounded-full bg-muted px-4 py-2 text-xs font-semibold text-foreground transition-colors hover:bg-muted/80 active:scale-95"
                >
                  Clear search
                </button>
              )}
              {!isSearching && hasLocation && (
                <button
                  onClick={() => setRadiusSheet(true)}
                  className="flex items-center gap-1.5 rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/15 active:scale-95"
                >
                  <Navigation2 size={12} />
                  Widen to {Math.min(searchRadius + 10, 50)} km
                </button>
              )}
            </div>
          )}

        </div>

      </div>

      {/* ── Location Picker Sheet ──────────────────────────────────────── */}
      <Sheet open={showLocationSheet} onOpenChange={(open) => {
        setShowLocationSheet(open);
        if (!open) setPendingLocation(null);
      }}>
        <SheetContent
          side="bottom"
          className="flex flex-col rounded-t-2xl"
          style={{ maxHeight: "92dvh", paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
        >
          <SheetHeader className="shrink-0 border-b border-border pb-3">
            <SheetTitle className="flex items-center gap-2">
              <MapPin size={16} className="text-primary" />
              {profile?.seeker_home_address ? "Update Home Location" : "Set Home Location"}
            </SheetTitle>
            <p className="text-left text-xs text-muted-foreground">
              Search, use GPS, or drag the map pin to your home address.
            </p>
          </SheetHeader>
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto py-4">
            <MapplsPicker
              value={pendingLocation}
              onChange={setPendingLocation}
              placeholder="Search for your home address"
            />
          </div>
          <div className="shrink-0 border-t border-border pt-3">
            <Button
              className="h-11 w-full rounded-xl font-semibold gradient-primary text-white"
              disabled={!pendingLocation || updateLocation.isPending}
              onClick={handleSaveLocation}
            >
              {updateLocation.isPending ? "Saving…" : "Save Location"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Radius Sheet ──────────────────────────────────────────────── */}
      <Sheet open={radiusSheet} onOpenChange={setRadiusSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle>Search Radius</SheetTitle>
          </SheetHeader>
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Show classes within</p>
              <span className="text-2xl font-bold text-primary">{searchRadius} km</span>
            </div>
            <Slider
              min={2}
              max={50}
              step={1}
              value={[searchRadius]}
              onValueChange={([v]) => setSearchRadius(v)}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>2 km</span><span>10 km</span><span>25 km</span><span>50 km</span>
            </div>
            {!hasLocation && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                Set your home location to enable distance filtering.
              </div>
            )}
            <div className="flex gap-3">
              {[5, 10, 15, 25].map((r) => (
                <button
                  key={r}
                  onClick={() => setSearchRadius(r)}
                  className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-all active:scale-95 ${
                    searchRadius === r
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {r} km
                </button>
              ))}
            </div>
            <Button className="w-full" onClick={() => setRadiusSheet(false)}>Apply</Button>
          </div>
        </SheetContent>
      </Sheet>

      <BottomNav persona="seeker" />
    </div>
  );
};

export default Explore;
