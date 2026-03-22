import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useExploreClasses } from "@/hooks/useSeeker";
import { useCategories } from "@/hooks/useClasses";
import ClassCard from "@/components/shared/ClassCard";
import BottomNav from "@/components/BottomNav";
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
import { ArrowLeft, Filter, Search, SlidersHorizontal, X } from "lucide-react";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest" },
  { value: "rating", label: "Top Rated" },
  { value: "popular", label: "Most Popular" },
];

const Explore = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { currentApartment } = useUser();

  const [search, setSearch] = useState(params.get("search") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(search);
  const [categorySlug, setCategorySlug] = useState(params.get("category") ?? "");
  const [sort, setSort] = useState(params.get("sort") ?? "newest");
  const [filterSheet, setFilterSheet] = useState(false);

  const { data: allCategories } = useCategories();
  const parentCategories = allCategories?.filter((c) => !c.parent_category_id) ?? [];

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data: classes, isLoading } = useExploreClasses({
    apartmentId: currentApartment?.id,
    search: debouncedSearch || undefined,
    categorySlug: categorySlug || undefined,
    sort,
    limit: 30,
  });

  const clearFilters = () => {
    setCategorySlug("");
    setSearch("");
    setSort("newest");
  };

  const hasFilters = !!categorySlug || !!debouncedSearch;

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-card px-4 py-3 space-y-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft size={20} />
          </button>
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search classes..."
              className="h-10 pl-9 pr-8 rounded-lg"
              autoFocus
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
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
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
      </header>

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-3">
        {/* Sort */}
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {isLoading ? "Searching..." : `${classes?.length ?? 0} classes found`}
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

        {/* Results */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
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
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <Search size={32} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No classes found matching your filters</p>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-primary font-medium">
                Clear all filters
              </button>
            )}
          </div>
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
