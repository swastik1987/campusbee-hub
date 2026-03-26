import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useExploreClasses, useNewClasses, usePopularClasses } from "@/hooks/useSeeker";
import { useActiveFeaturedListings } from "@/hooks/useFeatured";
import { useIncomingInvites } from "@/hooks/useFamilyLinking";
import { useCategories } from "@/hooks/useClasses";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Header from "@/components/layout/Header";
import ClassCard from "@/components/shared/ClassCard";
import BottomNav from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
  BookOpen,
  ChevronRight,
  Users,
} from "lucide-react";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Top Rated" },
  { value: "popular", label: "Most Popular" },
];

const CATEGORY_ICONS: Record<string, typeof Trophy> = {
  Trophy, Swords, Music, Palette, GraduationCap, Guitar, Heart, Globe,
};

const Explore = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { profile, currentApartment } = useUser();
  const aptId = currentApartment?.id;

  const [search, setSearch] = useState(params.get("search") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [categorySlug, setCategorySlug] = useState(params.get("category") ?? "");
  const [sort, setSort] = useState(params.get("sort") ?? "newest");
  const [filterSheet, setFilterSheet] = useState(false);

  const { data: allCategories } = useCategories();
  const parentCategories = allCategories?.filter((c) => !c.parent_category_id) ?? [];

  // Resolve selected parent category to include all its subcategory IDs
  const selectedCategoryIds = (() => {
    if (!categorySlug || !allCategories) return undefined;
    const parent = allCategories.find((c) => c.slug === categorySlug && !c.parent_category_id);
    if (parent) {
      const childIds = allCategories
        .filter((c) => c.parent_category_id === parent.id)
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
    apartmentId: aptId,
    search: debouncedSearch || undefined,
    categoryIds: combinedCategoryIds,
    sort,
    limit: 50,
  });

  // Secondary query when searching: also fetch by matching category names (without text search filter)
  const { data: catMatchClasses } = useExploreClasses({
    apartmentId: aptId,
    categoryIds: searchCategoryIds,
    sort,
    limit: 50,
  });

  // When searching, also fetch all classes (no text filter) so we can client-side match provider names
  const { data: allAptClasses } = useExploreClasses({
    apartmentId: isSearching ? aptId : undefined,
    categoryIds: selectedCategoryIds,
    sort,
    limit: 100,
  });

  // Merge and deduplicate search results
  const displayClasses = (() => {
    if (!isSearching) return classes;
    const map = new Map<string, any>();
    // 1. Title/description matches from server
    (classes ?? []).forEach((c) => map.set(c.id, c));
    // 2. Category name matches
    (catMatchClasses ?? []).forEach((c) => map.set(c.id, c));
    // 3. Provider name matches (client-side)
    if (allAptClasses && debouncedSearch) {
      const term = debouncedSearch.toLowerCase();
      allAptClasses.forEach((c: any) => {
        const par = c.provider_apartment_registrations;
        const sp = par?.service_providers;
        const providerName = sp?.business_name || sp?.users?.full_name || "";
        if (providerName.toLowerCase().includes(term)) {
          map.set(c.id, c);
        }
      });
    }
    return Array.from(map.values());
  })();

  // Discovery data (only fetched when not actively searching)
  const { data: featuredListings } = useActiveFeaturedListings(aptId);
  const { data: newClasses } = useNewClasses(aptId);
  const { data: popular } = usePopularClasses(aptId);
  const { data: incomingInvites } = useIncomingInvites(profile?.id, profile?.email ?? null, profile?.mobile_number ?? null);
  const pendingInviteCount = incomingInvites?.length ?? 0;

  const { data: categories, isLoading: catLoading } = useQuery({
    queryKey: ["categories-parent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_categories")
        .select("id, name, slug, icon_name, display_order")
        .is("parent_category_id", null)
        .eq("is_active", true)
        .order("display_order");
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

  const clearFilters = () => {
    setCategorySlug("");
    setSearch("");
    setSort("newest");
  };

  const hasFilters = !!categorySlug || !!debouncedSearch;

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
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

        {/* Featured Classes Banner Carousel */}
        {!isSearching && featuredListings && featuredListings.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-base font-bold">Featured Classes</h2>
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
                    <div className="relative aspect-[3/1] overflow-hidden rounded-xl">
                      <img src={listing.banner_image_url} alt="" className="h-full w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-2 left-3 right-3">
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
                    <div key={i} className={`h-1.5 rounded-full transition-all ${i === currentSlide ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"}`} />
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
                  {isLoading ? "Loading..." : `${classes?.length ?? 0} classes available`}
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
              ) : classes && classes.length > 0 ? (
                <div className="space-y-3">
                  {classes.map((cls) => (
                    <ClassCard key={cls.id} cls={cls as any} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 py-8 text-center">
                  <Search size={28} className="text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No classes available yet</p>
                </div>
              )}
            </div>

            {/* Category grid */}
            <div>
              <h2 className="mb-3 text-base font-bold">Browse Categories</h2>
              {catLoading ? (
                <div className="grid grid-cols-2 gap-3">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 rounded-xl" />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {categories?.map((cat) => {
                    const IconComponent = CATEGORY_ICONS[cat.icon_name ?? ""] ?? BookOpen;
                    const isActive = categorySlug === cat.slug;
                    return (
                      <Card
                        key={cat.id}
                        className={`flex cursor-pointer flex-col items-center justify-center gap-2 p-4 transition-all hover:shadow-md active:scale-[0.97] ${isActive ? "ring-2 ring-primary bg-primary/5" : ""}`}
                        onClick={() => setCategorySlug(isActive ? "" : cat.slug)}
                      >
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${isActive ? "bg-primary/20" : "bg-primary/10"}`}>
                          <IconComponent size={22} className="text-primary" />
                        </div>
                        <span className="text-xs font-semibold text-center">{cat.name}</span>
                      </Card>
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
                  <h2 className="text-base font-bold">
                    Popular{currentApartment ? ` in ${currentApartment.name}` : ""}
                  </h2>
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
