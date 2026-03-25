import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useNewClasses, usePopularClasses } from "@/hooks/useSeeker";
import { useActiveFeaturedListings } from "@/hooks/useFeatured";
import { useIncomingInvites } from "@/hooks/useFamilyLinking";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import ClassCard from "@/components/shared/ClassCard";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  BookOpen,
  ChevronRight,
  Users,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, typeof Trophy> = {
  Trophy, Swords, Music, Palette, GraduationCap, Guitar, Heart, Globe,
};

const SeekerHome = () => {
  const navigate = useNavigate();
  const { profile, currentApartment } = useUser();
  const aptId = currentApartment?.id;
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

  const { data: featuredListings } = useActiveFeaturedListings(aptId);
  const { data: newClasses, isLoading: newLoading } = useNewClasses(aptId);
  const { data: popular, isLoading: popularLoading } = usePopularClasses(aptId);

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

  // Track manual scrolling
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

        {/* Search bar */}
        <div className="relative cursor-pointer" onClick={() => navigate("/explore")}>
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search classes, sports, activities..."
            className="h-12 pl-10 rounded-xl cursor-pointer"
            readOnly
          />
        </div>

        {/* Featured Classes Banner Carousel */}
        {featuredListings && featuredListings.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-base font-bold">Featured Classes</h2>
            <div className="relative">
              <div
                ref={carouselRef}
                className="flex overflow-x-auto scroll-snap-x-mandatory scrollbar-hide gap-0"
                style={{ scrollSnapType: "x mandatory" }}
              >
                {featuredListings.map((listing) => (
                  <div
                    key={listing.id}
                    className="w-full flex-shrink-0 scroll-snap-start cursor-pointer"
                    style={{ scrollSnapAlign: "start" }}
                    onClick={() => navigate(`/class/${listing.class_id}`)}
                  >
                    <div className="relative aspect-[3/1] overflow-hidden rounded-xl mx-1">
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
              {/* Dot indicators */}
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
                return (
                  <Card
                    key={cat.id}
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 p-4 transition-all hover:shadow-md active:scale-[0.97]"
                    onClick={() => navigate(`/explore?category=${cat.slug}`)}
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
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
                onClick={() => navigate("/explore?sort=newest")}
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
                onClick={() => navigate("/explore?sort=popular")}
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
      </div>

      <BottomNav persona="seeker" />
    </div>
  );
};

export default SeekerHome;
