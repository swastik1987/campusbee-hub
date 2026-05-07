import { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useExploreClasses, useNewClasses, usePopularClasses } from "@/hooks/useSeeker";
import { useActiveFeaturedListings } from "@/hooks/useFeatured";
import { useIncomingInvites } from "@/hooks/useFamilyLinking";
import { useCategories } from "@/hooks/useClasses";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ChevronRight,
  Users,
  MapPin,
  Pencil,
  Navigation2,
} from "lucide-react";
import { toast } from "sonner";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Top Rated" },
  { value: "popular", label: "Most Popular" },
];

const CATEGORY_ICONS: Record<string, typeof Trophy> = {
  Trophy, Swords, Music, Palette, GraduationCap, Guitar, Heart, Globe,
  Dumbbell, Leaf, Code, Sparkles,
};

const Explore = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
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

  const [search, setSearch] = useState(params.get("search") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [categorySlug, setCategorySlug] = useState(params.get("category") ?? "");
  const [sort, setSort] = useState(params.get("sort") ?? "newest");
  const [filterSheet, setFilterSheet] = useState(false);
  const [searchRadius, setSearchRadius] = useState(10); // km — seeker's explore radius
  const [radiusSheet, setRadiusSheet] = useState(false);

  const { data: allCategories } = useCategories();
  const parentCategories = allCategories?.filter((c) => !c.parent_id) ?? [];

  // Resolve selected parent category to include all its subcategory IDs
  const selectedCategoryIds = (() => {
    if (!categorySlug || !allCategories) return undefined;
    const parent = allCategories.find((c) => c.slug === categorySlug && !c.parent_id);
    if (parent) {
      const childIds = allCategories
        .filter((c) => c.parent_id === parent.id)
        .map((c) => c.id);
      return [parent.id, ...childIds];
    }
    const sub = allCategories.find((c) => c.slug === categorySlug);
    return sub ? [sub.id] : undefined;
  })();

  // Resolve search term to matching category IDs (for provider name / category name search)
  const searchCategoryIds = (() => {
    if (!debouncedSearch || !allCategories) return undefined;
    const term = debouncedSearch.toLowerCase();
    const matching = allCategories.filter((c) => c.name.toLowerCase().includes(term));
    return matching.length > 0 ? matching.map((c) => c.id) : undefined;
  })();

  // Merge category filter IDs with search category IDs when both are active
  const combinedCategoryIds = (() => {
    if (selectedCategoryIds && searchCategoryIds) {
      // When both filter and search are active, intersect: show only filtered categories that also match search
      return selectedCategoryIds.filter((id) => searchCategoryIds.includes(id));
    }
    return selectedCategoryIds;
  })();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Only hide discovery sections when there's a text search active
  const isSearching = !!debouncedSearch;

  // Main query: fetch by title/description search + category filter
  const { data: classes, isLoading } = useExploreClasses({
    apartmentId: undefined,
    search: debouncedSearch || undefined,
    categoryIds: combinedCategoryIds,
    sort,
    limit: 50,
  });

  // Secondary query when searching: also fetch by matching category names (without text search filter)
  const { data: catMatchClasses } = useExploreClasses({
    apartmentId: undefined,
    categoryIds: searchCategoryIds,
    sort,
    limit: 50,
  });

  // When searching, also fetch all classes (no text filter) so we can client-side match provider names
  const { data: allAptClasses } = useExploreClasses({
    apartmentId: undefined,
    categoryIds: selectedCategoryIds,
    sort,
    limit: 100,
  });

  // Seeker location for distance filtering
  const seekerLat = profile?.seeker_home_lat ?? null;
  const seekerLng = profile?.seeker_home_lng ?? null;
  const hasLocation = seekerLat != null && seekerLng != null;

  // Helper: compute distanceKm for a single class record
  const computeDistance = (cls: any): number | null => {
    if (!hasLocation || !cls.location_lat || !cls.location_lng) return null;
    return haversineKm(
      { lat: seekerLat!, lng: seekerLng! },
      { lat: cls.location_lat, lng: cls.location_lng }
    );
  };

  // Helper: decide if a class should appear given the seeker's radius and the class type
  const withinRadius = (cls: any): boolean => {
    if (!hasLocation || !cls.location_lat || !cls.location_lng) return true; // no coords → show
    const dist = haversineKm(
      { lat: seekerLat!, lng: seekerLng! },
      { lat: cls.location_lat, lng: cls.location_lng }
    );
    if (cls.is_home_based) {
      // Home-based: provider travels to the student — show if seeker is within provider's service radius
      return dist <= (cls.home_radius_km ?? 5);
    }
    // Venue-based: show if class venue is within seeker's chosen radius
    return dist <= searchRadius;
  };

  // Merge and deduplicate search results
  const rawDisplayClasses = (() => {
    if (!isSearching) return classes;
    const map = new Map<string, any>();
    // 1. Title/description matches from server
    (classes ?? []).forEach((c) => map.set(c.id, c));
    // 2. Category name matches
    (catMatchClasses ?? []).forEach((c) => map.set(c.id, c));
    // 3. Provider name matches (client-side) — v2: service_providers direct join
    if (allAptClasses && debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      allAptClasses.forEach((c: any) => {
        const sp = c.service_providers;
        const providerName = sp?.business_name || sp?.users?.full_name || "";
        if (providerName.toLowerCase().includes(term)) {
          map.set(c.id, c);
        }
      });
    }
    return Array.from(map.values());
  })();

  // Apply distance filter + attach distanceKm for display
  const displayClasses = useMemo(() => {
    if (!rawDisplayClasses) return rawDisplayClasses;
    return (rawDisplayClasses as any[])
      .filter(withinRadius)
      .map((cls: any) => ({ ...cls, distanceKm: computeDistance(cls) }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawDisplayClasses, seekerLat, seekerLng, searchRadius]);

  // Discovery data (only fetched when not actively searching)
  const { data: featuredListings } = useActiveFeaturedListings(undefined);
  const { data: newClasses } = useNewClasses();
  const { data: popular } = usePopularClasses();
  const { data: incomingInvites } = useIncomingInvites(profile?.id, profile?.email ?? null, profile?.mobile_number ?? null);
  const pendingInviteCount = incomingInvites?.length ?? 0;

  const { data: categories, isLoading: catLoading } = useQuery({
    queryKey: ["categories-parent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_categories")
        .select("id, name, slug, icon, sort_order")
        .is("parent_id", null)
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  // Featured carousel state
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
    const handleScroll = () => {
      const index = Math.round(el.scrollLeft / el.offsetWidth);
      setCurrentSlide(index);
    };
    el.addEventListener("scrollend", handleScroll);
    return () => el.removeEventListener("scrollend", handleScroll);
  }, []);

  // Apply distance filter + attach distanceKm for the non-search "all classes" list
  const filteredClasses = useMemo(() => {
    if (!classes) return classes;
    return (classes as any[])
      .filter(withinRadius)
      .map((cls: any) => ({ ...cls, distanceKm: computeDistance(cls) }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classes, seekerLat, seekerLng, searchRadius]);

  const clearFilters = () => {
    setCategorySlug("");
    setSearch("");
    setSort("newest");
  };

  const hasFilters = !!categorySlug || !!debouncedSearch;

  return (
    <div className="seeker-theme flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-6">
        {/* Incoming invite banner */}
        {pendingInviteCount > 0 && (
          <button
            onClick={() => navigate("/family")}
            className="flex w-full items-center gap-3 rounded-xl bg-primary/10 p-3.5 text-left transition-colors hover:bg-primary/15"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/20">
              <Users size={18} className="text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-primary">
                {pendingInviteCount} family invite{pendingInviteCount > 1 ? "s" : ""} pending
              </p>
              <p className="text-xs text-muted-foreground">Tap to view and accept</p>
            </div>
            <ChevronRight size={16} className="text-primary" />
          </button>
        )}

        {/* Location bar + radius control */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between rounded-2xl border border-primary/15 px-3 py-2.5" style={{ backgroundColor: "oklch(0.96 0.04 250)" }}>
            <div className="flex items-center gap-2 min-w-0">
              <MapPin size={15} className="text-primary shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground leading-none mb-0.5">Classes near</p>
                <p className="text-xs font-semibold truncate max-w-[160px]">
                  {profile?.seeker_home_address
                    ? (profile.seeker_home_address.split(",")[0]?.trim() ?? profile.seeker_home_address)
                    : "Set your location"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {/* Radius pill */}
              <button
                onClick={() => setRadiusSheet(true)}
                className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                <Navigation2 size={11} />
                {searchRadius} km
              </button>
              <button
                onClick={() => setShowLocationSheet(true)}
                className="flex items-center gap-1 rounded-lg bg-primary/10 px-2.5 py-1.5 text-[11px] font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                <Pencil size={11} />
                {profile?.seeker_home_address ? "Edit" : "Set"}
              </button>
            </div>
          </div>
          {hasLocation && (
            <p className="text-[10px] text-muted-foreground text-center">
              Showing classes within {searchRadius} km · tap radius to change
            </p>
          )}
        </div>

        {/* Featured Classes Banner Carousel */}
        {!isSearching && featuredListings && featuredListings.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">Featured Classes</h2>
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-600">
                SPONSORED
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
                      <img src={(listing.classes as any)?.cover_image_url ?? ""} alt="" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                      <div className="absolute bottom-3 left-4 right-4">
                        <p className="text-sm font-bold text-white truncate">
                          {(listing.classes as any)?.title}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {featuredListings.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-2">
                  {featuredListings.map((_, i) => (
                    <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentSlide ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"}`} />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Search bar + filter chips */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search classes, sports, activities..."
                className="h-10 pl-9 pr-8 rounded-lg"
              />
              {search && (
                <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1">
                  <X size={14} className="text-muted-foreground" />
                </button>
              )}
            </div>
            <button onClick={() => setFilterSheet(true)} className="relative p-2">
              <SlidersHorizontal size={18} />
              {hasFilters && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
              )}
            </button>
          </div>

          {/* Category chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <Badge
              variant={!categorySlug ? "default" : "outline"}
              className={`cursor-pointer whitespace-nowrap ${!categorySlug ? "bg-primary" : ""}`}
              onClick={() => setCategorySlug("")}
            >
              All
            </Badge>
            {parentCategories.map((cat) => (
              <Badge
                key={cat.id}
                variant={categorySlug === cat.slug ? "default" : "outline"}
                className={`cursor-pointer whitespace-nowrap ${categorySlug === cat.slug ? "bg-primary" : ""}`}
                onClick={() => setCategorySlug(categorySlug === cat.slug ? "" : cat.slug)}
              >
                {cat.name}
              </Badge>
            ))}
          </div>
        </div>

        {/* Search results (when text searching) */}
        {isSearching && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {isLoading ? "Searching..." : `${displayClasses?.length ?? 0} classes found`}
              </p>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-24 rounded-xl" />
                ))}
              </div>
            ) : displayClasses && displayClasses.length > 0 ? (
              <div className="space-y-3">
                {displayClasses.map((cls) => (
                  <ClassCard key={cls.id} cls={cls as any} />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Search size={32} className="text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No classes found matching your search</p>
                {hasFilters && (
                  <button onClick={clearFilters} className="text-xs text-primary font-medium">
                    Clear all filters
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Discovery sections (when not searching) */}
        {!isSearching && (
          <>
            {/* All classes list */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-muted-foreground">
                  {isLoading ? "Loading..." : `${filteredClasses?.length ?? 0} classes available${hasLocation ? ` within ${searchRadius} km` : ""}`}
                </p>
                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SORT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-24 rounded-xl" />
                  ))}
                </div>
              ) : filteredClasses && filteredClasses.length > 0 ? (
                <div className="space-y-3">
                  {filteredClasses.map((cls) => (
                    <ClassCard key={cls.id} cls={cls as any} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <Search size={28} className="text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">
                    {hasLocation ? `No classes found within ${searchRadius} km` : "No classes available yet"}
                  </p>
                  {hasLocation && (
                    <button
                      onClick={() => setRadiusSheet(true)}
                      className="text-xs text-primary font-medium"
                    >
                      Increase radius
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Category grid */}
            <div>
              <h2 className="mb-3 text-base font-bold">Browse Categories</h2>
              {catLoading ? (
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-2xl" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {categories?.map((cat, idx) => {
                    const IconComponent = CATEGORY_ICONS[cat.icon ?? ""] ?? BookOpen;
                    const isActive = categorySlug === cat.slug;
                    const hue = [250, 260, 240, 270, 245, 255, 235, 265, 248, 258, 242, 252][idx % 12];
                    return (
                      <button
                        key={cat.id}
                        className={`flex flex-col items-center justify-center gap-1.5 rounded-2xl py-3 px-1 transition-all active:scale-95 ${isActive ? "ring-2 ring-primary" : ""}`}
                        style={{ background: isActive ? `oklch(0.88 0.10 ${hue})` : `oklch(0.94 0.06 ${hue})` }}
                        onClick={() => setCategorySlug(isActive ? "" : cat.slug)}
                      >
                        <div
                          className="flex h-9 w-9 items-center justify-center rounded-xl"
                          style={{ background: `oklch(0.82 0.12 ${hue})` }}
                        >
                          <IconComponent size={19} style={{ color: `oklch(0.50 0.20 ${hue})` }} />
                        </div>
                        <span
                          className="text-[10px] font-semibold text-center leading-tight"
                          style={{ color: `oklch(0.38 0.16 ${hue})` }}
                        >
                          {cat.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* New This Month */}
            {newClasses && newClasses.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold">New This Month</h2>
                  <button
                    onClick={() => { setSort("newest"); setSearch(""); setCategorySlug(""); }}
                    className="text-xs text-primary font-medium flex items-center gap-0.5"
                  >
                    See All <ChevronRight size={14} />
                  </button>
                </div>
                <div className="space-y-3">
                  {newClasses.map((cls) => (
                    <ClassCard key={cls.id} cls={cls as any} />
                  ))}
                </div>
              </div>
            )}

            {/* Popular */}
            {popular && popular.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-base font-bold">Popular</h2>
                  <button
                    onClick={() => { setSort("popular"); setSearch(""); setCategorySlug(""); }}
                    className="text-xs text-primary font-medium flex items-center gap-0.5"
                  >
                    See All <ChevronRight size={14} />
                  </button>
                </div>
                <div className="space-y-3">
                  {popular.map((cls) => (
                    <ClassCard key={cls.id} cls={cls as any} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Location Picker Sheet — full map + GPS, identical to onboarding */}
      <Sheet open={showLocationSheet} onOpenChange={(open) => {
        setShowLocationSheet(open);
        if (!open) setPendingLocation(null);
      }}>
        <SheetContent side="bottom" className="rounded-t-2xl flex flex-col" style={{ maxHeight: "92dvh", paddingBottom: "env(safe-area-inset-bottom, 16px)" }}>
          <SheetHeader className="shrink-0 pb-3 border-b border-border">
            <SheetTitle className="flex items-center gap-2">
              <MapPin size={16} className="text-primary" />
              {profile?.seeker_home_address ? "Update Home Location" : "Set Home Location"}
            </SheetTitle>
            <p className="text-xs text-muted-foreground text-left">
              Search, use GPS, or drag the map pin to your home address.
            </p>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-4 space-y-4 min-h-0">
            <MapplsPicker
              value={pendingLocation}
              onChange={setPendingLocation}
              placeholder="Search for your home address"
            />
          </div>
          <div className="shrink-0 pt-3 border-t border-border">
            <Button
              className="w-full h-11 gradient-primary text-white rounded-xl font-semibold"
              disabled={!pendingLocation || updateLocation.isPending}
              onClick={handleSaveLocation}
            >
              {updateLocation.isPending ? "Saving…" : "Save Location"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Radius Sheet */}
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
              <span>2 km</span>
              <span>10 km</span>
              <span>25 km</span>
              <span>50 km</span>
            </div>
            {!hasLocation && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-700">
                Set your home location above to enable distance filtering.
              </div>
            )}
            <div className="flex gap-3">
              {[5, 10, 15, 25].map((r) => (
                <button
                  key={r}
                  onClick={() => setSearchRadius(r)}
                  className={`flex-1 rounded-xl border py-2 text-xs font-semibold transition-all ${
                    searchRadius === r
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  {r} km
                </button>
              ))}
            </div>
            <Button className="w-full" onClick={() => setRadiusSheet(false)}>
              Apply
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Filter Sheet */}
      <Sheet open={filterSheet} onOpenChange={setFilterSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[60vh] overflow-y-auto">
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
            <div className="space-y-2">
              <p className="text-sm font-medium">Sort By</p>
              <div className="flex flex-wrap gap-2">
                {SORT_OPTIONS.map((o) => (
                  <Badge
                    key={o.value}
                    variant={sort === o.value ? "default" : "outline"}
                    className={`cursor-pointer ${sort === o.value ? "bg-primary" : ""}`}
                    onClick={() => setSort(o.value)}
                  >
                    {o.label}
                  </Badge>
                ))}
              </div>
            </div>
            {hasFilters && (
              <button
                onClick={() => { clearFilters(); setFilterSheet(false); }}
                className="w-full text-center text-sm text-destructive font-medium py-2"
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
