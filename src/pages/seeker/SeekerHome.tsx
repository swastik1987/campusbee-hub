import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useNewClasses, usePopularClasses } from "@/hooks/useSeeker";
import { useActiveFeaturedListings } from "@/hooks/useFeatured";
import { useIncomingInvites } from "@/hooks/useFamilyLinking";
import { useUnreadNotificationCount } from "@/hooks/useNotifications";
import BottomNav from "@/components/BottomNav";
import ClassCard from "@/components/shared/ClassCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
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
  Bell,
  MapPin,
  Pencil,
} from "lucide-react";

const CATEGORY_ICONS: Record<string, typeof Trophy> = {
  Trophy, Swords, Music, Palette, GraduationCap, Guitar, Heart, Globe,
  Dumbbell, Leaf, Code, Sparkles,
};

const CATEGORY_COLORS: Record<string, string> = {
  Sports: "bg-red-100 text-red-500",
  Music: "bg-purple-100 text-purple-500",
  Dance: "bg-pink-100 text-pink-500",
  Arts: "bg-blue-100 text-blue-500",
  Academics: "bg-indigo-100 text-indigo-500",
  Fitness: "bg-orange-100 text-orange-500",
  Martial: "bg-amber-100 text-amber-600",
  Coding: "bg-cyan-100 text-cyan-600",
  Yoga: "bg-teal-100 text-teal-500",
  Wellness: "bg-green-100 text-green-500",
};

const SeekerHome = () => {
  const navigate = useNavigate();
  const { profile, familyMembers } = useUser();
  const { data: incomingInvites } = useIncomingInvites(
    profile?.id,
    profile?.email ?? null,
    profile?.mobile_number ?? null
  );
  const { data: unreadCount } = useUnreadNotificationCount(profile?.id);
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

  const { data: newClasses, isLoading: newLoading } = useNewClasses();
  const { data: popular, isLoading: popularLoading } = usePopularClasses();

  // Derive first name from profile
  const firstName = profile?.full_name?.split(" ")[0] ?? "";

  // Derive children names for "Picks" section heading
  const children = familyMembers.filter(
    (m) => m.relationship === "child" || m.relationship === "grandchild"
  );
  const picksLabel =
    children.length === 0
      ? "Picks for you"
      : children.length === 1
      ? `Picks for ${children[0].full_name?.split(" ")[0]}`
      : `Picks for ${children
          .slice(0, 2)
          .map((c) => c.full_name?.split(" ")[0])
          .join(" & ")}`;

  // Location label
  const locationLabel = profile?.seeker_home_address
    ? profile.seeker_home_address.split(",").slice(0, 2).join(", ").trim()
    : null;

  const initials = profile?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2) ?? "?";

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Custom header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <button
            onClick={() => navigate("/home")}
            className="flex items-center gap-2"
          >
            <span className="text-base font-extrabold gradient-primary-text">CampusBee</span>
          </button>
          <div className="flex items-center gap-2">
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
            <button
              onClick={() => navigate("/profile")}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold"
            >
              {initials}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg px-4 py-5 space-y-6">
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

        {/* Hero section */}
        <div className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Hi {firstName} 👋
            </p>
            <h1 className="text-2xl font-bold leading-tight text-foreground">
              Find the right class
            </h1>
            <h1 className="text-2xl font-bold leading-tight text-primary">
              near your home.
            </h1>
          </div>

          {/* Location row */}
          <button
            onClick={() => navigate("/explore")}
            className="flex w-full items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-left"
          >
            <MapPin size={14} className="text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground leading-none mb-0.5">
                Home · 5 km radius
              </p>
              <p className="text-xs font-medium truncate">
                {locationLabel ?? "Set your location"}
              </p>
            </div>
            <Pencil size={13} className="text-muted-foreground shrink-0" />
          </button>

          {/* CTA button */}
          <button
            onClick={() => navigate("/explore")}
            className="flex w-full items-center justify-between rounded-2xl bg-primary px-5 py-4 text-white font-semibold active:scale-[0.98] transition-transform"
          >
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20">
                <Heart size={16} className="text-white" />
              </div>
              <span>Explore classes near you</span>
            </div>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* Browse by category */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">Browse by category</h2>
            <button
              onClick={() => navigate("/explore")}
              className="text-xs text-primary font-medium"
            >
              See all
            </button>
          </div>
          {catLoading ? (
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {categories?.slice(0, 8).map((cat) => {
                const IconComponent = CATEGORY_ICONS[cat.icon ?? ""] ?? BookOpen;
                const colorClass = CATEGORY_COLORS[cat.name] ?? "bg-primary/10 text-primary";
                return (
                  <button
                    key={cat.id}
                    onClick={() => navigate(`/explore?category=${cat.slug}`)}
                    className="flex flex-col items-center gap-1.5 p-2 rounded-xl active:scale-[0.96] transition-transform"
                  >
                    <div className={`flex h-12 w-12 items-center justify-center rounded-full ${colorClass}`}>
                      <IconComponent size={22} />
                    </div>
                    <span className="text-[11px] font-medium text-center leading-tight">{cat.name}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Picks for children (horizontal scroll using new classes) */}
        {newClasses && newClasses.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">{picksLabel}</h2>
              <button
                onClick={() => navigate("/explore?sort=newest")}
                className="text-xs text-primary font-medium flex items-center gap-0.5"
              >
                See all <ChevronRight size={14} />
              </button>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
              {newClasses.slice(0, 6).map((cls, idx) => {
                const child = children[idx % Math.max(children.length, 1)];
                const childLabel = child ? child.full_name?.split(" ")[0] : null;
                return (
                  <button
                    key={cls.id}
                    onClick={() => navigate(`/class/${cls.id}`)}
                    className="flex-shrink-0 w-44 rounded-2xl border border-border bg-card overflow-hidden text-left active:scale-[0.97] transition-transform"
                  >
                    {(cls as any).cover_image_url ? (
                      <img
                        src={(cls as any).cover_image_url}
                        alt=""
                        className="h-28 w-full object-cover"
                      />
                    ) : (
                      <div className="h-28 w-full bg-primary/10 flex items-center justify-center">
                        <BookOpen size={24} className="text-primary/40" />
                      </div>
                    )}
                    <div className="p-2.5">
                      {childLabel && (
                        <p className="text-[9px] font-bold uppercase tracking-wider text-primary mb-0.5">
                          {childLabel}
                        </p>
                      )}
                      <p className="text-xs font-semibold line-clamp-2 leading-tight">
                        {(cls as any).title}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {(cls as any).service_providers?.business_name ??
                          (cls as any).service_providers?.users?.full_name ?? ""}
                      </p>
                      {(cls as any).distanceKm != null && (
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          📍 {((cls as any).distanceKm as number).toFixed(1)} km
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
            {newLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {newClasses.slice(0, 4).map((cls) => (
                  <ClassCard key={cls.id} cls={cls as any} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Popular */}
        {popular && popular.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-base font-bold">Popular</h2>
              <button
                onClick={() => navigate("/explore?sort=popular")}
                className="text-xs text-primary font-medium flex items-center gap-0.5"
              >
                See All <ChevronRight size={14} />
              </button>
            </div>
            {popularLoading ? (
              <div className="space-y-3">
                {[1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
              </div>
            ) : (
              <div className="space-y-3">
                {popular.slice(0, 4).map((cls) => (
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
