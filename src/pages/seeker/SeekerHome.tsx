import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useNewClasses, usePopularClasses } from "@/hooks/useSeeker";
import { useActiveFeaturedListings } from "@/hooks/useFeatured";
import { useIncomingInvites } from "@/hooks/useFamilyLinking";
import BottomNav from "@/components/BottomNav";
import ClassCard from "@/components/shared/ClassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Search,
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
  Bell,
  Compass,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, typeof Trophy> = {
  Trophy, Swords, Music, Palette, GraduationCap, Guitar, Heart, Globe,
  Dumbbell, Leaf, Code, Sparkles,
};

// Hue offsets per category slot for icon square tinting
const CATEGORY_HUE_OFFSETS = [250, 260, 240, 270, 245, 255, 235, 265, 248, 258, 242, 252];

const SeekerHome = () => {
  const navigate = useNavigate();
  const { profile } = useUser();
  const { data: incomingInvites } = useIncomingInvites(profile?.id, profile?.email ?? null, profile?.mobile_number ?? null);
  const pendingInviteCount = incomingInvites?.length ?? 0;

  const firstName = profile?.full_name?.split(" ")[0] ?? "there";

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

  const { data: featuredListings } = useActiveFeaturedListings();
  const { data: newClasses, isLoading: newLoading } = useNewClasses();
  const { data: popular, isLoading: popularLoading } = usePopularClasses();

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

  return (
    <div className="seeker-theme flex min-h-screen flex-col bg-background pb-20">

      {/* Hero Section */}
      <div
        className="relative px-4 pt-12 pb-8"
        style={{ background: "linear-gradient(160deg, oklch(0.78 0.18 250) 0%, oklch(0.62 0.20 250) 100%)" }}
      >
        {/* Top row: greeting + notification bell */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-white/80 text-sm font-medium">Good morning,</p>
            <h1 className="text-white text-2xl font-bold leading-tight">
              Hey {firstName}! 👋
            </h1>
          </div>
          <button
            onClick={() => navigate("/notifications")}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white/20 backdrop-blur-sm"
          >
            <Bell size={18} className="text-white" />
            {pendingInviteCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-amber-400 text-[9px] font-bold text-white">
                {pendingInviteCount}
              </span>
            )}
          </button>
        </div>

        {/* Location line */}
        {profile?.seeker_home_address && (
          <div className="flex items-center gap-1.5 mb-5">
            <MapPin size={13} className="text-white/70 shrink-0" />
            <p className="text-white/80 text-xs truncate max-w-[240px]">
              {profile.seeker_home_address.split(",")[0]?.trim() ?? profile.seeker_home_address}
            </p>
          </div>
        )}

        {/* Search bar (tap → Explore) */}
        <button
          onClick={() => navigate("/explore")}
          className="flex w-full items-center gap-3 rounded-2xl bg-white/95 px-4 h-12 shadow-lg"
        >
          <Search size={17} className="text-muted-foreground shrink-0" />
          <span className="text-sm text-muted-foreground">Search classes, sports, activities…</span>
        </button>

        {/* Explore CTA */}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => navigate("/explore")}
            className="flex items-center gap-1.5 rounded-xl bg-white/20 backdrop-blur-sm px-4 py-2 text-sm font-semibold text-white"
          >
            <Compass size={14} />
            Explore nearby
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-6">

        {/* Pending invite banner */}
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
        {featuredListings && featuredListings.length > 0 && (
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
                      <img
                        src={(listing.classes as any)?.cover_image_url ?? ""}
                        alt=""
                        className="h-full w-full object-cover"
                      />
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

        {/* Category grid — 4 columns */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">Browse Categories</h2>
            <button
              onClick={() => navigate("/explore")}
              className="text-xs text-primary font-medium flex items-center gap-0.5"
            >
              All <ChevronRight size={13} />
            </button>
          </div>
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
                const hue = CATEGORY_HUE_OFFSETS[idx % CATEGORY_HUE_OFFSETS.length];
                return (
                  <button
                    key={cat.id}
                    className="flex flex-col items-center justify-center gap-1.5 rounded-2xl py-3 px-1 transition-all active:scale-95"
                    style={{ background: `oklch(0.94 0.06 ${hue})` }}
                    onClick={() => navigate(`/explore?category=${cat.slug}`)}
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{ background: `oklch(0.82 0.12 ${hue})` }}
                    >
                      <IconComponent
                        size={19}
                        style={{ color: `oklch(0.50 0.20 ${hue})` }}
                      />
                    </div>
                    <span className="text-[10px] font-semibold text-center leading-tight" style={{ color: `oklch(0.38 0.16 ${hue})` }}>
                      {cat.name}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* New This Month */}
        {(newLoading || (newClasses && newClasses.length > 0)) && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">New This Month</h2>
              <button
                onClick={() => navigate("/explore?sort=newest")}
                className="text-xs text-primary font-medium flex items-center gap-0.5"
              >
                See All <ChevronRight size={14} />
              </button>
            </div>
            {newLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {newClasses!.map((cls) => (
                  <ClassCard key={cls.id} cls={cls as any} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Popular */}
        {(popularLoading || (popular && popular.length > 0)) && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">Popular Near You</h2>
              <button
                onClick={() => navigate("/explore?sort=popular")}
                className="text-xs text-primary font-medium flex items-center gap-0.5"
              >
                See All <ChevronRight size={14} />
              </button>
            </div>
            {popularLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {popular!.map((cls) => (
                  <ClassCard key={cls.id} cls={cls as any} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <BottomNav persona="seeker" />
    </div>
  );
};

export default SeekerHome;
