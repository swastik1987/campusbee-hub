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
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import MapplsPicker from "@/components/location/MapplsPicker";
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
  Bell,
  Navigation2,
  Star,
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
  const { data: unreadCount } = useUnreadNotificationCount(profile?.id);

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
  const [searchRadius, setSearchRadius] = useState(10);
  const [radiusSheet, setRadiusSheet] = useState(false);

  const { data: allCategories } = useCategories();
  const parentCategories = allCategories?.filter((c) => !c.parent_id) ?? [];

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

  const searchCategoryIds = (() => {
    if (!debouncedSearch || !allCategories) return undefined;
    const term = debouncedSearch.toLowerCase();
    const matching = allCategories.filter((c) => c.name.toLowerCase().includes(term));
    return matching.length > 0 ? matching.map((c) => c.id) : undefined;
  })();

  const combinedCategoryIds = (() => {
    if (selectedCategoryIds && searchCategoryIds) {
      return selectedCategoryIds.filter((id) => searchCategoryIds.includes(id));
    }
    return selectedCategoryIds;
  })();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const isSearching = !!debouncedSearch;

  const { data: classes, isLoading } = useExploreClasses({
    apartmentId: undefined,
    search: debouncedSearch || undefined,
    categoryIds: combinedCategoryIds,
    sort,
    limit: 50,
  });

  const { data: catMatchClasses } = useExploreClasses({
    apartmentId: undefined,
    categoryIds: searchCategoryIds,
    sort,
    limit: 50,
  });

  const { data: allAptClasses } = useExploreClasses({
    apartmentId: undefined,
    categoryIds: selectedCategoryIds,
    sort,
    limit: 100,
  });

  const seekerLat = profile?.seeker_home_lat ?? null;
  const seekerLng = profile?.seeker_home_lng ?? null;
  const hasLocation = seekerLat != null && seekerLng != null;

  const computeDistance = (cls: any): number | null => {
    if (!hasLocation || !cls.location_lat || !cls.location_lng) return null;
    return haversineKm({ lat: seekerLat!, lng: seekerLng! }, { lat: cls.location_lat, lng: cls.location_lng });
  };

  const withinRadius = (cls: any): boolean => {
    if (!hasLocation || !cls.location_lat || !cls.location_lng) return true;
    const dist = haversineKm({ lat: seekerLat!, lng: seekerLng! }, { lat: cls.location_lat, lng: cls.location_lng });
    if (cls.is_home_based) return dist <= (cls.home_radius_km ?? 5);
    return dist <= searchRadius;
  };

  const rawDisplayClasses = (() => {
    if (!isSearching) return classes;
    const map = new Map<string, any>();
    (classes ?? []).forEach((c) => map.set(c.id, c));
    (catMatchClasses ?? []).forEach((c) => map.set(c.id, c));
    if (allAptClasses && debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      allAptClasses.forEach((c: any) => {
        const sp = c.service_providers;
        const providerName = sp?.business_name || sp?.users?.full_name || "";
        if (providerName.toLowerCase().includes(term)) map.set(c.id, c);
      });
    }
    return Array.from(map.values());
  })();

  const displayClasses = useMemo(() => {
    if (!rawDisplayClasses) return rawDisplayClasses;
    return (rawDisplayClasses as any[])
      .filter(withinRadius)
      .map((cls: any) => ({ ...cls, distanceKm: computeDistance(cls) }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawDisplayClasses, seekerLat, seekerLng, searchRadius]);

  const { data: featuredListings } = useActiveFeaturedListings(undefined);
  const { data: newClasses } = useNewClasses();
  const { data: popular } = usePopularClasses();
  const { data: incomingInvites } = useIncomingInvites(profile?.id, profile?.email ?? null, profile?.mobile_number ?? null);
  const pendingInviteCount = incomingInvites?.length ?? 0;

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

  // Short location label
  const locationChipLabel = profile?.seeker_home_address
    ? (profile.seeker_home_address.split(",")[0]?.trim() ?? profile.seeker_home_address).slice(0, 22)
    : "Set location";

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Inline header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <h1 className="text-xl font-bold">Explore</h1>
          <button
            onClick={() => navigate("/notifications")}
            className="relative flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
          >
            <Bell size={20} className="text-muted-foreground" />
            {unreadCount && unreadCount > 0 ? (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </button>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        {/* Incoming invite banner */}
        {pendingInviteCount > 0 && (
          <button
            onClick={() => navigate("/family")}
            className="flex w-full items-center gap-3 rounded-xl bg-primary/10 p-3.5 text-left hover:bg-primary/15"
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

        {/* Location chip bar */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center gap-1.5 min-w-0">
            <MapPin size={13} className="text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground leading-none">NEAR</p>
              <p className="text-xs font-semibold truncate">{locationChipLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setRadiusSheet(true)}
              className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary"
            >
              <Navigation2 size={11} />
              {searchRadius} km
            </button>
            <button
              onClick={() => setShowLocationSheet(true)}
              className="flex items-center gap-1 rounded-full border border-border px-3 py-1 text-xs font-semibold text-foreground"
            >
              <Pencil size={11} />
              Edit
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Dance, swimming, math..."
              className="h-11 pl-9 pr-8 rounded-xl"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1">
                <X size={14} className="text-muted-foreground" />
              </button>
            )}
          </div>
          <button
            onClick={() => setFilterSheet(true)}
            className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-border"
          >
            <SlidersHorizontal size={18} />
            {hasFilters && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
            )}
          </button>
        </div>

        {/* Category pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          <button
            onClick={() => setCategorySlug("")}
            className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors shrink-0 ${
              !categorySlug
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            All
          </button>
          {parentCategories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setCategorySlug(categorySlug === cat.slug ? "" : cat.slug)}
              className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors shrink-0 ${
                categorySlug === cat.slug
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Featured card (if not searching and featured exists) */}
        {!isSearching && featuredListings && featuredListings.length > 0 && (
          <button
            onClick={() => navigate(`/class/${featuredListings[0].class_id}`)}
            className="w-full rounded-2xl overflow-hidden relative active:scale-[0.98] transition-transform text-left"
          >
            <div className="relative h-36">
              {(featuredListings[0].classes as any)?.cover_image_url ? (
                <img
                  src={(featuredListings[0].classes as any).cover_image_url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="h-full w-full bg-gradient-to-br from-primary/60 to-primary" />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
              <div className="absolute top-3 left-3">
                <span className="rounded-full bg-amber-400 px-2.5 py-0.5 text-[10px] font-bold text-black uppercase tracking-wide">
                  ★ Featured
                </span>
              </div>
              <div className="absolute bottom-3 left-3 right-3">
                <p className="text-base font-bold text-white leading-tight truncate">
                  {(featuredListings[0].classes as any)?.title}
                </p>
                {(featuredListings[0].classes as any)?.service_providers?.business_name && (
                  <p className="text-xs text-white/80 mt-0.5">
                    {(featuredListings[0].classes as any).service_providers.business_name}
                  </p>
                )}
              </div>
            </div>
          </button>
        )}

        {/* Results count + sort */}
        {!isSearching && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground font-medium">
              {isLoading ? "Loading..." : `${filteredClasses?.length ?? 0} classes within ${searchRadius} km`}
            </p>
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-28 h-8 text-xs rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Search results */}
        {isSearching && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {isLoading ? "Searching..." : `${displayClasses?.length ?? 0} results`}
              </p>
              <Select value={sort} onValueChange={setSort}>
                <SelectTrigger className="w-28 h-8 text-xs rounded-lg">
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

        {/* Discovery (when not searching) */}
        {!isSearching && (
          <>
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
                  <button onClick={() => setRadiusSheet(true)} className="text-xs text-primary font-medium">
                    Increase radius
                  </button>
                )}
              </div>
            )}

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
                  {newClasses.map((cls) => <ClassCard key={cls.id} cls={cls as any} />)}
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
                  {popular.map((cls) => <ClassCard key={cls.id} cls={cls as any} />)}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Location Picker Sheet */}
      <Sheet open={showLocationSheet} onOpenChange={(open) => {
        setShowLocationSheet(open);
        if (!open) setPendingLocation(null);
      }}>
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-4">
            <SheetTitle>{profile?.seeker_home_address ? "Update Location" : "Set Your Location"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <MapplsPicker value={pendingLocation} onChange={setPendingLocation} showMap={false} />
            <Button
              className="w-full"
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
              min={2} max={50} step={1}
              value={[searchRadius]}
              onValueChange={([v]) => setSearchRadius(v)}
              className="w-full"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>2 km</span><span>10 km</span><span>25 km</span><span>50 km</span>
            </div>
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
            <Button className="w-full" onClick={() => setRadiusSheet(false)}>Apply</Button>
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
                  <button
                    key={cat.id}
                    onClick={() => setCategorySlug(categorySlug === cat.slug ? "" : cat.slug)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                      categorySlug === cat.slug
                        ? "bg-primary text-white border-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">Sort By</p>
              <div className="flex flex-wrap gap-2">
                {SORT_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setSort(o.value)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-colors ${
                      sort === o.value
                        ? "bg-primary text-white border-primary"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {o.label}
                  </button>
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
