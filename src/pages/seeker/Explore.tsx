import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useExploreClasses, usePlatformSettings, useActiveSponsoredClassIds } from "@/hooks/useSeeker";
import { useActiveFeaturedListings } from "@/hooks/useFeatured";
import { useIncomingInvites } from "@/hooks/useFamilyLinking";
import { useCategories } from "@/hooks/useClasses";
import { useQueryClient } from "@tanstack/react-query";
import { useUpdateSeekerLocation, haversineKm, formatDistance, type LocationValue } from "@/hooks/useLocation";
import MapplsPicker from "@/components/location/MapplsPicker";
import Header from "@/components/layout/Header";
import ClassCard from "@/components/shared/ClassCard";
import BottomNav from "@/components/BottomNav";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  SlidersHorizontal,
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
  ChevronDown,
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
  const [filterSheet, setFilterSheet]     = useState(false);
  const [searchRadius, setSearchRadius]   = useState(10);
  const [radiusSheet, setRadiusSheet]     = useState(false);
  const [catsExpanded, setCatsExpanded]   = useState(false);

  const { data: allCategories } = useCategories();
  const parentCategories = allCategories?.filter((c) => !c.parent_id) ?? [];

  const FIRST_ROW_COUNT = 5;
  const firstRowCats    = parentCategories.slice(0, FIRST_ROW_COUNT);
  const secondRowCats   = parentCategories.slice(FIRST_ROW_COUNT);
  const hasSecondRow    = secondRowCats.length > 0;
  const activeInSecondRow = secondRowCats.some((c) => c.slug === categorySlug);

  const handleCatSelect = (slug: string) => {
    setCategorySlug((prev) => (prev === slug ? "" : slug));
    setCatsExpanded(false);
  };

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

  const isSearching = !!debouncedSearch;

  // Primary query: title/description + category filter
  const { data: classes, isLoading } = useExploreClasses({
    apartmentId: undefined,
    search:      debouncedSearch || undefined,
    categoryIds: combinedCategoryIds,
    sort,
    limit: 50,
  });

  // Secondary: category name match (text search only)
  const { data: catMatchClasses } = useExploreClasses({
    apartmentId: undefined,
    categoryIds: searchCategoryIds,
    sort,
    limit: 50,
  });

  // All classes in the category filter (for client-side provider name search)
  const { data: allAptClasses } = useExploreClasses({
    apartmentId: undefined,
    categoryIds: selectedCategoryIds,
    sort,
    limit: 100,
  });

  // Distance helpers
  const seekerLat = profile?.seeker_home_lat ?? null;
  const seekerLng = profile?.seeker_home_lng ?? null;
  const hasLocation = seekerLat != null && seekerLng != null;

  const computeDistance = (cls: any): number | null => {
    if (!hasLocation || !cls.location_lat || !cls.location_lng) return null;
    return haversineKm(
      { lat: seekerLat!, lng: seekerLng! },
      { lat: cls.location_lat, lng: cls.location_lng },
    );
  };

  const withinRadius = (cls: any): boolean => {
    if (!hasLocation || !cls.location_lat || !cls.location_lng) return true;
    const dist = haversineKm(
      { lat: seekerLat!, lng: seekerLng! },
      { lat: cls.location_lat, lng: cls.location_lng },
    );
    return cls.is_home_based ? dist <= (cls.home_radius_km ?? 5) : dist <= searchRadius;
  };

  // Merge + deduplicate search results
  const rawDisplayClasses = (() => {
    if (!isSearching) return classes;
    const map = new Map<string, any>();
    (classes ?? []).forEach((c) => map.set(c.id, c));
    (catMatchClasses ?? []).forEach((c) => map.set(c.id, c));
    if (allAptClasses && debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      allAptClasses.forEach((c: any) => {
        const sp = c.service_providers;
        const name = sp?.business_name || sp?.users?.full_name || "";
        if (name.toLowerCase().includes(term)) map.set(c.id, c);
      });
    }
    return Array.from(map.values());
  })();

  // Trust-marker thresholds from platform_settings
  const { data: platformSettings }  = usePlatformSettings();
  const { data: sponsoredClassIds } = useActiveSponsoredClassIds();

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

  const displayClasses = useMemo(() => {
    if (!rawDisplayClasses) return rawDisplayClasses;
    const withDist = (rawDisplayClasses as any[])
      .filter(withinRadius)
      .map((cls: any) => ({ ...cls, distanceKm: computeDistance(cls) }));
    return applyTrustMarkers(withDist);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawDisplayClasses, seekerLat, seekerLng, searchRadius, applyTrustMarkers]);

  const { data: featuredListings } = useActiveFeaturedListings(undefined);
  const { data: incomingInvites }  = useIncomingInvites(
    profile?.id, profile?.email ?? null, profile?.mobile_number ?? null,
  );
  const pendingInviteCount = incomingInvites?.length ?? 0;

  // Auto-advancing featured carousel
  const carouselRef = useRef<HTMLDivElement>(null);
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    if (!featuredListings || featuredListings.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentSlide((prev) => {
        const next = (prev + 1) % featuredListings.length;
        carouselRef.current?.scrollTo({ left: next * carouselRef.current.offsetWidth, behavior: "smooth" });
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [featuredListings]);

  useEffect(() => {
    const el = carouselRef.current;
    if (!el) return;
    const handleScroll = () => setCurrentSlide(Math.round(el.scrollLeft / el.offsetWidth));
    el.addEventListener("scrollend", handleScroll);
    return () => el.removeEventListener("scrollend", handleScroll);
  }, []);

  const filteredClasses = useMemo(() => {
    if (!classes) return classes;
    const withDist = (classes as any[])
      .filter(withinRadius)
      .map((cls: any) => ({ ...cls, distanceKm: computeDistance(cls) }));
    return applyTrustMarkers(withDist);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes, seekerLat, seekerLng, searchRadius, applyTrustMarkers]);

  const clearFilters = () => { setCategorySlug(""); setSearch(""); setSort("newest"); };
  const hasFilters = !!categorySlug || !!debouncedSearch;

  // Unified list for display
  const activeList = isSearching ? displayClasses : filteredClasses;

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

          {/* Location card */}
          <div
            className="flex items-center justify-between rounded-2xl px-4 py-3"
            style={{ background: "linear-gradient(135deg, oklch(0.97 0.04 250), oklch(0.93 0.08 250))" }}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15">
                <MapPin size={16} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-medium text-muted-foreground leading-none mb-0.5">Classes near</p>
                <p className="text-sm font-bold leading-tight truncate max-w-[160px]">
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

          {/* Featured / sponsored carousel */}
          {!isSearching && featuredListings && featuredListings.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">Featured</h2>
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-600">
                  Sponsored
                </span>
              </div>
              <div className="relative">
                <div
                  ref={carouselRef}
                  className="flex overflow-x-auto scrollbar-hide"
                  style={{ scrollSnapType: "x mandatory", WebkitOverflowScrolling: "touch" }}
                >
                  {featuredListings.map((listing) => (
                    <div
                      key={listing.id}
                      className="w-full flex-shrink-0 cursor-pointer"
                      style={{ scrollSnapAlign: "start", minWidth: "100%" }}
                      onClick={() => navigate(`/class/${listing.class_id}`)}
                    >
                      <div className="relative aspect-[16/7] overflow-hidden rounded-2xl">
                        <img
                          src={(listing.classes as any)?.cover_image_url ?? ""}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                        <div className="absolute bottom-3 left-4 right-4">
                          <p className="truncate text-sm font-bold text-white">
                            {(listing.classes as any)?.title}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {featuredListings.length > 1 && (
                  <div className="mt-2 flex justify-center gap-1.5">
                    {featuredListings.map((_, i) => (
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
          )}

        </div>

        {/* ── STICKY: search bar + category icon pills ───────────────────── */}
        <div className="sticky top-14 z-30 border-b border-border/40 bg-background/95 backdrop-blur-sm">
          <div className="space-y-2.5 px-4 pb-3 pt-3">

            {/* Search row */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search classes, sports, activities…"
                  className="h-10 rounded-full border-border/50 bg-muted/40 pl-9 pr-8 text-sm focus-visible:bg-background"
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
              <button
                onClick={() => setFilterSheet(true)}
                className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted/50 transition-colors hover:bg-muted active:scale-95"
              >
                <SlidersHorizontal size={17} />
                {hasFilters && (
                  <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary" />
                )}
              </button>
            </div>

            {/* Category pills — row 1 (sticky, always visible) */}
            <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5 scrollbar-hide">

              {/* "All" pill */}
              <button
                onClick={() => { setCategorySlug(""); setCatsExpanded(false); }}
                className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all active:scale-95"
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

              {/* First-row category pills */}
              {firstRowCats.map((cat, idx) => {
                const IconComp = CATEGORY_ICONS[cat.icon ?? ""] ?? BookOpen;
                const hue = PILL_HUES[idx % PILL_HUES.length];
                const isActive = categorySlug === cat.slug;
                return (
                  <button
                    key={cat.id}
                    onClick={() => handleCatSelect(cat.slug)}
                    className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all active:scale-95"
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

              {/* Expand toggle — shown only when there are second-row categories */}
              {hasSecondRow && (
                <button
                  onClick={() => setCatsExpanded((v) => !v)}
                  className="relative flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all active:scale-95"
                  style={{
                    background: catsExpanded ? "oklch(0.90 0.06 250)" : "oklch(0.95 0.03 250)",
                    color: "oklch(0.42 0.18 250)",
                    border: "1.5px dashed oklch(0.72 0.14 250)",
                  }}
                >
                  {catsExpanded
                    ? <X size={11} />
                    : <><ChevronDown size={11} />{`+${secondRowCats.length}`}</>
                  }
                  {/* Dot when an active filter lives in the second row */}
                  {!catsExpanded && activeInSecondRow && (
                    <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" />
                  )}
                </button>
              )}

            </div>

            {/* Category pills — row 2 (animated expand/collapse) */}
            {hasSecondRow && (
              <div
                className="-mx-4 overflow-hidden transition-all duration-300 ease-in-out"
                style={{
                  maxHeight: catsExpanded ? "120px" : "0px",
                  opacity: catsExpanded ? 1 : 0,
                }}
              >
                <div className="flex flex-wrap gap-2 px-4 pb-1.5 pt-1">
                  {secondRowCats.map((cat, idx) => {
                    const IconComp = CATEGORY_ICONS[cat.icon ?? ""] ?? BookOpen;
                    const hue = PILL_HUES[(idx + FIRST_ROW_COUNT) % PILL_HUES.length];
                    const isActive = categorySlug === cat.slug;
                    return (
                      <button
                        key={cat.id}
                        onClick={() => handleCatSelect(cat.slug)}
                        className="flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all active:scale-95"
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
              </div>
            )}

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

      {/* ── Filter Sheet ──────────────────────────────────────────────── */}
      <Sheet open={filterSheet} onOpenChange={setFilterSheet}>
        <SheetContent side="bottom" className="max-h-[60vh] overflow-y-auto rounded-t-2xl">
          <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Category</p>
              <div className="flex flex-wrap gap-2">
                {parentCategories.map((cat) => (
                  <Badge
                    key={cat.id}
                    variant={categorySlug === cat.slug ? "default" : "outline"}
                    className={`cursor-pointer ${categorySlug === cat.slug ? "bg-primary" : ""}`}
                    onClick={() => setCategorySlug(categorySlug === cat.slug ? "" : cat.slug)}
                  >
                    {cat.name}
                  </Badge>
                ))}
              </div>
            </div>
            {hasFilters && (
              <button
                onClick={() => { clearFilters(); setFilterSheet(false); }}
                className="w-full py-2 text-center text-sm font-medium text-destructive"
              >
                Clear All Filters
              </button>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <BottomNav persona="seeker" />
    </div>
  );
};

export default Explore;
