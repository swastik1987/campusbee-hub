import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useFeaturedClasses, useNewClasses, usePopularClasses } from "@/hooks/useSeeker";
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
} from "lucide-react";

const CATEGORY_ICONS: Record<string, typeof Trophy> = {
  Trophy, Swords, Music, Palette, GraduationCap, Guitar, Heart, Globe,
};

const SeekerHome = () => {
  const navigate = useNavigate();
  const { currentApartment } = useUser();
  const aptId = currentApartment?.id;

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

  const { data: featured, isLoading: featuredLoading } = useFeaturedClasses(aptId);
  const { data: newClasses, isLoading: newLoading } = useNewClasses(aptId);
  const { data: popular, isLoading: popularLoading } = usePopularClasses(aptId);

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-6">
        {/* Search bar */}
        <div className="relative cursor-pointer" onClick={() => navigate("/explore")}>
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search classes, sports, activities..."
            className="h-12 pl-10 rounded-xl cursor-pointer"
            readOnly
          />
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

        {/* Featured classes */}
        <div>
          <h2 className="mb-3 text-base font-bold">Featured Classes</h2>
          {featuredLoading ? (
            <div className="flex gap-3 overflow-x-auto">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-40 w-44 rounded-xl flex-shrink-0" />
              ))}
            </div>
          ) : featured && featured.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {featured.map((cls) => (
                <ClassCard key={cls.id} cls={cls as any} variant="vertical" />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/20 p-8 text-center">
              <BookOpen size={32} className="text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Classes will appear here once providers add them
              </p>
              <p className="text-xs text-muted-foreground">
                {currentApartment ? `in ${currentApartment.name}` : "Select an apartment to see classes"}
              </p>
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
