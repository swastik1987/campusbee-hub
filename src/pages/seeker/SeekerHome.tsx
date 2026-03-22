import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
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
} from "lucide-react";

const CATEGORY_ICONS: Record<string, typeof Trophy> = {
  Trophy,
  Swords,
  Music,
  Palette,
  GraduationCap,
  Guitar,
  Heart,
  Globe,
};

const SeekerHome = () => {
  const navigate = useNavigate();
  const { currentApartment } = useUser();

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

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-6">
        {/* Search bar */}
        <div
          className="relative cursor-pointer"
          onClick={() => navigate("/explore")}
        >
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
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
                const IconComponent =
                  CATEGORY_ICONS[cat.icon_name ?? ""] ?? BookOpen;
                return (
                  <Card
                    key={cat.id}
                    className="flex cursor-pointer flex-col items-center justify-center gap-2 p-4 transition-all hover:shadow-md active:scale-[0.97]"
                    onClick={() =>
                      navigate(`/explore?category=${cat.slug}`)
                    }
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <IconComponent size={22} className="text-primary" />
                    </div>
                    <span className="text-xs font-semibold text-center">
                      {cat.name}
                    </span>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Featured classes empty state */}
        <div>
          <h2 className="mb-3 text-base font-bold">Featured Classes</h2>
          <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-muted-foreground/20 p-8 text-center">
            <BookOpen size={32} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              Classes will appear here once providers add them
            </p>
            <p className="text-xs text-muted-foreground">
              {currentApartment
                ? `in ${currentApartment.name}`
                : "Select an apartment to see classes"}
            </p>
          </div>
        </div>
      </div>

      <BottomNav persona="seeker" />
    </div>
  );
};

export default SeekerHome;
