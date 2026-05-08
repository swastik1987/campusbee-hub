import * as React from "react";
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import AuthDrawer from "@/components/AuthDrawer";
import { useSeekerClassDetail, useClassReviews } from "@/hooks/useSeeker";
import { useSeekerProviderCertifications } from "@/hooks/useCertifications";
import CertificationGallery from "@/components/shared/CertificationGallery";
import { useUpcomingDemoSessions, useBookDemoSession } from "@/hooks/useDemoSessions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  MapPin,
  MessageCircle,
  Navigation,
  Share2,
  Star,
  Users,
} from "lucide-react";
import { haversineKm, formatDistance } from "@/hooks/useLocation";
import { toast } from "sonner";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FEE_LABELS: Record<string, string> = {
  per_session: "/session",
  monthly: "/month",
  quarterly: "/quarter",
  for_duration: " total",
  one_time: " one-time",
};

const ClassDetail = React.forwardRef<HTMLDivElement, Record<string, never>>((_props, ref) => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { session, profile, familyMembers } = useUser();
  const { data: cls, isLoading, isError } = useSeekerClassDetail(classId);
  const { data: reviews } = useClassReviews(classId);
  const providerId = cls ? (cls as any).service_providers?.id : undefined;

  // Distance from seeker home — computed client-side via haversine
  const distanceKm = React.useMemo(() => {
    if (!cls) return null;
    const clsLat = (cls as any).location_lat as number | null | undefined;
    const clsLng = (cls as any).location_lng as number | null | undefined;
    const seekerLat = profile?.seeker_home_lat;
    const seekerLng = profile?.seeker_home_lng;
    if (clsLat == null || clsLng == null || seekerLat == null || seekerLng == null) return null;
    return haversineKm({ lat: seekerLat, lng: seekerLng }, { lat: clsLat, lng: clsLng });
  }, [cls, profile]);

  const { data: providerCerts } = useSeekerProviderCertifications(providerId);

  // Batch & trial selection state
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [wantsTrial, setWantsTrial] = useState(false);
  const [showTrialSheet, setShowTrialSheet] = useState(false);
  const [selectedDemoId, setSelectedDemoId] = useState<string | null>(null);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);

  // Misc UI state
  const [showFullDesc, setShowFullDesc] = useState(false);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [loginOpen, setLoginOpen] = useState(false);
  const [loginMessage, setLoginMessage] = useState<string | undefined>(undefined);

  // Demo sessions for this class
  const { data: demoSessions } = useUpcomingDemoSessions(classId);
  const { mutateAsync: bookDemo, isPending: bookingDemo } = useBookDemoSession();

  /** Gate an action behind authentication. Opens AuthDrawer if not logged in. */
  const requireAuth = (fn: () => void, message?: string) => {
    if (!session) {
      setLoginMessage(message);
      setLoginOpen(true);
    } else {
      fn();
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
          <Skeleton className="h-6 w-40" />
        </header>
        <Skeleton className="h-48 w-full" />
        <div className="p-4 space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (isError || (!isLoading && !cls)) {
    return (
      <div ref={ref} className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <BookOpen size={40} className="text-muted-foreground" />
        <div>
          <p className="font-semibold">Class not available</p>
          <p className="text-sm text-muted-foreground mt-1">
            This class may have been removed or is no longer publicly available.
          </p>
        </div>
        <button
          onClick={() => navigate("/")}
          className="rounded-xl px-5 py-2.5 text-sm font-bold text-white"
          style={{ background: "linear-gradient(135deg, oklch(0.78 0.18 250), oklch(0.62 0.20 250))" }}
        >
          Go Home
        </button>
      </div>
    );
  }

  if (!cls) return null;

  const provider = (cls as any).service_providers;
  const providerUser = provider?.users;
  const activeBatches = (cls.batches ?? []).filter((b: any) => b.status === "active" || b.status === "full");
  const gallery = [cls.cover_image_url, ...(cls.gallery_urls ?? [])].filter(Boolean) as string[];

  // Derive selected batch details
  const selectedBatch = activeBatches.find((b: any) => b.id === selectedBatchId) as any | undefined;
  const selectedBatchFull = selectedBatch
    ? (selectedBatch.status === "full" || (selectedBatch.max_batch_size - (selectedBatch.current_enrollment_count ?? 0)) <= 0)
    : false;

  const handleShare = () => {
    const text = `Check out ${cls.title} on CampusBee!`;
    if (navigator.share) {
      navigator.share({ title: cls.title, text });
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + window.location.href)}`, "_blank");
    }
  };

  const handleWhatsApp = () => {
    if (!provider?.whatsapp_number) return;
    const msg = encodeURIComponent(`Hi, I'm interested in "${cls.title}" class.`);
    window.open(`https://wa.me/${provider.whatsapp_number}?text=${msg}`, "_blank");
  };

  const handleGetDirections = () => {
    const clsLat = (cls as any).location_lat as number | null | undefined;
    const clsLng = (cls as any).location_lng as number | null | undefined;
    let url: string;
    if (clsLat != null && clsLng != null) {
      url = `https://www.google.com/maps/dir/?api=1&destination=${clsLat},${clsLng}`;
    } else if (cls.address) {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cls.address)}`;
    } else {
      return;
    }
    window.open(url, "_blank");
  };

  const handleEnrollNow = () => {
    if (!selectedBatchId) return;
    requireAuth(
      () => navigate(`/enroll/${selectedBatchId}`),
      selectedBatchFull ? "Log in to join the waitlist" : "Log in to enroll in this class"
    );
  };

  const handleBookTrialClick = () => {
    requireAuth(() => {
      if (!demoSessions?.length) {
        toast.info("No trial sessions scheduled yet. Contact the provider to arrange one.");
        return;
      }
      setShowTrialSheet(true);
    }, "Log in to book a trial class");
  };

  const handleConfirmDemo = async () => {
    if (!selectedDemoId || !selectedMemberId || !profile) return;
    try {
      await bookDemo({
        demoSessionId: selectedDemoId,
        familyMemberId: selectedMemberId,
        registeredBy: profile.id,
      });
      toast.success("Trial class booked! Check your notifications for confirmation.");
      setShowTrialSheet(false);
      setSelectedDemoId(null);
      setSelectedMemberId(null);
    } catch (err: any) {
      toast.error(err?.message || "Failed to book trial. Please try again.");
    }
  };

  const activeFamilyMembers = familyMembers.filter((m) => m.is_active);

  return (
    <div ref={ref} className="seeker-theme flex min-h-screen flex-col bg-background pb-28">
      {/* Hero / Gallery */}
      <div className="relative">
        {gallery.length > 0 ? (
          <>
            <img src={gallery[galleryIdx]} alt="" className="w-full h-56 object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/30" />
            {gallery.length > 1 && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {gallery.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setGalleryIdx(i)}
                    className={`h-1.5 rounded-full transition-all ${i === galleryIdx ? "w-5 bg-white" : "w-1.5 bg-white/50"}`}
                  />
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="flex h-44 items-center justify-center" style={{ background: "linear-gradient(135deg, oklch(0.78 0.18 250) 0%, oklch(0.62 0.20 250) 100%)" }}>
            <BookOpen size={40} className="text-white/60" />
          </div>
        )}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <button
            onClick={handleShare}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 backdrop-blur-sm"
          >
            <Share2 size={16} className="text-white" />
          </button>
        </div>
      </div>

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-5">
        {/* Title + meta */}
        <div>
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-bold leading-tight flex-1">{cls.title}</h2>
            {distanceKm != null && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0 mt-1 bg-muted px-2 py-0.5 rounded-full">
                <MapPin size={11} />
                {formatDistance(distanceKm)}
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 mt-1.5">
            {cls.class_categories && (
              <Badge variant="outline" className="text-xs">{(cls.class_categories as any).name}</Badge>
            )}
            <Badge variant="secondary" className="text-xs capitalize">
              {cls.class_type?.replace("_", " ")}
            </Badge>
          </div>
          {(cls.rating_count ?? 0) > 0 && (
            <div className="flex items-center gap-1.5 mt-2">
              <Star size={16} className="text-amber-500 fill-amber-500" />
              <span className="font-semibold">{cls.total_rating}</span>
              <span className="text-sm text-muted-foreground">({cls.rating_count} reviews)</span>
            </div>
          )}
          {cls.short_description && (
            <p className="text-sm text-muted-foreground mt-2">{cls.short_description}</p>
          )}
        </div>

        {/* 2×2 info grid */}
        {(cls.age_group_min || cls.age_group_max || cls.skill_level || cls.address) && (
          <div className="grid grid-cols-2 gap-2">
            {(cls.age_group_min || cls.age_group_max) && (
              <div className="flex items-center gap-2 rounded-xl p-3" style={{ backgroundColor: "oklch(0.96 0.04 250)" }}>
                <Users size={15} style={{ color: "oklch(0.55 0.20 250)" }} />
                <div>
                  <p className="text-[10px] text-muted-foreground">Age Group</p>
                  <p className="text-xs font-semibold">
                    {cls.age_group_min && cls.age_group_max
                      ? `${cls.age_group_min}–${cls.age_group_max} yrs`
                      : cls.age_group_min ? `${cls.age_group_min}+ yrs` : `Up to ${cls.age_group_max} yrs`}
                  </p>
                </div>
              </div>
            )}
            {cls.skill_level && (
              <div className="flex items-center gap-2 rounded-xl p-3" style={{ backgroundColor: "oklch(0.96 0.04 250)" }}>
                <Star size={15} style={{ color: "oklch(0.55 0.20 250)" }} />
                <div>
                  <p className="text-[10px] text-muted-foreground">Level</p>
                  <p className="text-xs font-semibold capitalize">
                    {(Array.isArray(cls.skill_level) ? cls.skill_level.join(", ") : String(cls.skill_level)).replace("_", " ")}
                  </p>
                </div>
              </div>
            )}
            {cls.address && (
              <div className="col-span-2 flex items-start gap-2 rounded-xl p-3" style={{ backgroundColor: "oklch(0.96 0.04 250)" }}>
                <MapPin size={15} className="mt-0.5 flex-shrink-0" style={{ color: "oklch(0.55 0.20 250)" }} />
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground">Location</p>
                  <p className="text-xs font-semibold line-clamp-2">{cls.address}</p>
                </div>
                {((cls as any).location_lat != null || cls.address) && (
                  <button
                    onClick={handleGetDirections}
                    className="flex items-center gap-1 shrink-0 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white transition-all active:scale-95"
                    style={{ background: "linear-gradient(135deg, oklch(0.78 0.18 250), oklch(0.62 0.20 250))" }}
                  >
                    <Navigation size={11} />
                    Directions
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Provider card */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 cursor-pointer" onClick={() => navigate(`/provider-profile/${provider?.id}`)}>
              <AvatarImage src={providerUser?.avatar_url} />
              <AvatarFallback className="bg-provider/10 text-provider">
                {providerUser?.full_name?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p
                  className="font-semibold text-sm truncate cursor-pointer"
                  onClick={() => navigate(`/provider-profile/${provider?.id}`)}
                >
                  {provider?.business_name || providerUser?.full_name}
                </p>
                {provider?.is_verified && (
                  <CheckCircle2 size={14} className="text-blue-500 flex-shrink-0" />
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {provider?.provider_type === "academy" && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0">Academy</Badge>
                )}
                {provider?.experience_years && <span>{provider.experience_years} yrs exp</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs"
              onClick={() => requireAuth(
                () => navigate(`/chat?with=${provider?.user_id}`),
                "Log in to chat with the provider"
              )}
            >
              <MessageCircle size={14} className="mr-1" /> Chat
            </Button>
            {provider?.whatsapp_number && (
              <Button size="sm" variant="outline" className="flex-1 text-xs" onClick={handleWhatsApp}>
                WhatsApp
              </Button>
            )}
          </div>
        </Card>

        {/* Trainers (academy) */}
        {provider?.provider_type === "academy" && cls.batches?.some((b: any) => b.trainers) && (
          <div>
            <h3 className="text-sm font-bold mb-2">Meet the Trainers</h3>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {Array.from(
                new Map(
                  cls.batches
                    ?.filter((b: any) => b.trainers?.name)
                    .map((b: any) => [b.trainers.id, b.trainers])
                ).values()
              ).map((t: any) => (
                <div key={t.id} className="flex flex-col items-center gap-1 w-16 flex-shrink-0">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={t.photo_url} />
                    <AvatarFallback className="bg-provider/10 text-provider text-xs">{t.name[0]}</AvatarFallback>
                  </Avatar>
                  <p className="text-[10px] font-medium text-center truncate w-full">{t.name}</p>
                  {t.specializations?.[0] && (
                    <p className="text-[9px] text-muted-foreground truncate w-full text-center">{t.specializations[0]}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Provider Certifications */}
        {providerCerts && providerCerts.length > 0 && (
          <CertificationGallery certs={providerCerts} layout="scroll" />
        )}

        {/* Full description */}
        {cls.description && (
          <div>
            <h3 className="text-sm font-bold mb-1">About This Class</h3>
            <p className={`text-sm text-muted-foreground whitespace-pre-wrap ${!showFullDesc && "line-clamp-4"}`}>
              {cls.description}
            </p>
            {cls.description.length > 200 && (
              <button onClick={() => setShowFullDesc(!showFullDesc)} className="text-xs text-primary font-medium mt-1">
                {showFullDesc ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        )}

        {/* Venue + What to bring */}
        {(cls.venue_details || cls.what_to_bring) && (
          <div className="space-y-2">
            {cls.venue_details && (
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium">Venue</p>
                  <p className="text-xs text-muted-foreground">{cls.venue_details}</p>
                </div>
              </div>
            )}
            {cls.what_to_bring && (
              <div className="flex items-start gap-2">
                <BookOpen size={14} className="text-muted-foreground mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-medium">What to Bring</p>
                  <p className="text-xs text-muted-foreground">{cls.what_to_bring}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Available Batches — radio-button selection ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">Available Batches</h3>
            {activeBatches.length > 0 && !selectedBatchId && (
              <span className="text-[11px] text-muted-foreground">Select one to enroll</span>
            )}
          </div>
          {activeBatches.length > 0 ? (
            <div className="space-y-3">
              {activeBatches.map((batch: any) => {
                const schedules = batch.batch_schedules ?? [];
                const scheduleSummary = schedules.map((s: any) => DAY_NAMES[s.day_of_week]).join(", ");
                const timeSummary = schedules[0]
                  ? `${schedules[0].start_time.slice(0, 5)}–${schedules[0].end_time.slice(0, 5)}`
                  : "";
                const slotsLeft = batch.max_batch_size - (batch.current_enrollment_count ?? 0);
                const isFull = batch.status === "full" || slotsLeft <= 0;
                const isSelected = selectedBatchId === batch.id;

                return (
                  <button
                    key={batch.id}
                    onClick={() => setSelectedBatchId(isSelected ? null : batch.id)}
                    className="w-full text-left"
                  >
                    <Card
                      className={`p-4 space-y-2 border-2 transition-all ${
                        isSelected
                          ? "border-primary shadow-md"
                          : "border-border hover:border-primary/40"
                      }`}
                    >
                      {/* Radio indicator + name + fee */}
                      <div className="flex items-start gap-3">
                        {/* Radio dot */}
                        <div className="mt-0.5 shrink-0">
                          {isSelected ? (
                            <div className="h-4 w-4 rounded-full border-2 border-primary flex items-center justify-center">
                              <div className="h-2 w-2 rounded-full bg-primary" />
                            </div>
                          ) : (
                            <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/40" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm">{batch.batch_name}</h4>
                          {batch.skill_level && (
                            <Badge variant="secondary" className="text-[10px] capitalize mt-0.5">
                              {batch.skill_level.replace("_", " ")}
                            </Badge>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-sm">
                            ₹{batch.fee_amount}
                            <span className="text-xs font-normal text-muted-foreground">
                              {FEE_LABELS[batch.fee_frequency] ?? ""}
                            </span>
                          </p>
                          {batch.registration_fee > 0 && (
                            <p className="text-[10px] text-muted-foreground">
                              + ₹{batch.registration_fee} reg.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Schedule */}
                      {scheduleSummary && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground pl-7">
                          <Calendar size={12} />
                          <span>{scheduleSummary}</span>
                          <span>·</span>
                          <Clock size={12} />
                          <span>{timeSummary}</span>
                        </div>
                      )}

                      {batch.trainers?.name && (
                        <p className="text-xs text-muted-foreground pl-7">Trainer: {batch.trainers.name}</p>
                      )}

                      {/* Dates */}
                      {(() => {
                        const today = new Date().toISOString().split("T")[0];
                        const startDate = batch.start_date;
                        const endDate = batch.end_date;
                        const isFuture = startDate && startDate > today;
                        return (
                          (startDate || endDate) && (
                            <div className="flex flex-wrap items-center gap-x-2 text-xs pl-7">
                              {isFuture ? (
                                <span className="text-blue-600 font-medium">
                                  Starting {new Date(startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                </span>
                              ) : startDate ? (
                                <span className="text-green-600 font-medium">Live now</span>
                              ) : null}
                              {endDate && (
                                <span className="text-muted-foreground">
                                  · Ends {new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                                </span>
                              )}
                            </div>
                          )
                        );
                      })()}

                      {/* Slots */}
                      <div className="flex items-center gap-1 text-xs pl-7">
                        <Users size={12} className="text-muted-foreground" />
                        {isFull ? (
                          <span className="text-amber-600 font-medium">Full — Waitlist open</span>
                        ) : slotsLeft <= 5 ? (
                          <span className="text-green-600 font-medium">{slotsLeft} spots left</span>
                        ) : (
                          <span className="text-muted-foreground">{slotsLeft} spots available</span>
                        )}
                      </div>
                    </Card>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-6">
              <Calendar size={24} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No active batches right now</p>
            </div>
          )}
        </div>

        {/* Add-ons */}
        {cls.class_addons && (cls.class_addons as any[]).length > 0 && (
          <div>
            <h3 className="text-sm font-bold mb-2">Add-ons</h3>
            <div className="space-y-2">
              {(cls.class_addons as any[]).map((addon) => (
                <div key={addon.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">{addon.name}</p>
                    {addon.description && <p className="text-xs text-muted-foreground">{addon.description}</p>}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">₹{addon.fee_amount}</p>
                    {addon.is_mandatory && (
                      <Badge variant="destructive" className="text-[9px]">Required</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Trial — checkbox opt-in ── */}
        {cls.trial_available && (
          <button
            onClick={() => setWantsTrial(!wantsTrial)}
            className="w-full text-left"
          >
            <Card className={`p-4 border-2 transition-all ${wantsTrial ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
              <div className="flex items-center gap-3">
                {/* Checkbox indicator */}
                <div className={`h-5 w-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  wantsTrial ? "border-primary bg-primary" : "border-muted-foreground/40"
                }`}>
                  {wantsTrial && (
                    <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                      <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">I'd like a Trial Class</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {cls.trial_fee && cls.trial_fee > 0 ? `₹${cls.trial_fee}` : "Free"} · Try before you commit
                  </p>
                </div>
              </div>
            </Card>
          </button>
        )}

        {/* Reviews */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold">Reviews</h3>
            {(cls.rating_count ?? 0) > 0 && (
              <div className="flex items-center gap-1">
                <Star size={14} className="text-amber-500 fill-amber-500" />
                <span className="text-sm font-bold">{cls.total_rating}</span>
                <span className="text-xs text-muted-foreground">({cls.rating_count})</span>
              </div>
            )}
          </div>
          {reviews && reviews.length > 0 ? (
            <div className="space-y-3">
              {reviews.slice(0, 5).map((review: any) => (
                <div key={review.id} className="border-b border-border pb-3 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={review.users?.avatar_url} />
                      <AvatarFallback className="text-[10px]">
                        {review.users?.full_name?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium">{review.users?.full_name}</span>
                    <div className="flex gap-0.5 ml-auto">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={10}
                          className={i < review.rating ? "text-amber-500 fill-amber-500" : "text-gray-200"}
                        />
                      ))}
                    </div>
                  </div>
                  {review.review_text && (
                    <p className="text-xs text-muted-foreground">{review.review_text}</p>
                  )}
                  {review.is_verified && (
                    <Badge variant="secondary" className="text-[9px] mt-1">Verified Enrollment</Badge>
                  )}
                  {review.provider_reply && (
                    <div className="mt-2 ml-4 p-2 rounded-lg bg-muted text-xs">
                      <p className="font-medium text-[10px] mb-0.5">Provider Reply</p>
                      <p className="text-muted-foreground">{review.provider_reply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No reviews yet</p>
          )}
        </div>
      </div>

      {/* Auth drawer */}
      <AuthDrawer open={loginOpen} onOpenChange={setLoginOpen} message={loginMessage} />

      {/* ── Sticky bottom CTA bar ── */}
      {activeBatches.length > 0 && (
        <div className="seeker-theme fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card/95 backdrop-blur-sm safe-bottom">
          <div className="mx-auto max-w-lg px-3 py-3 flex items-center gap-2">
            {/* Left: selection summary */}
            <div className="flex-1 min-w-0">
              {selectedBatch ? (
                <>
                  <p className="text-[10px] text-muted-foreground truncate">{selectedBatch.batch_name}</p>
                  <p className="font-bold text-sm">
                    ₹{selectedBatch.fee_amount}
                    <span className="text-xs font-normal text-muted-foreground">
                      {FEE_LABELS[selectedBatch.fee_frequency] ?? ""}
                    </span>
                  </p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground leading-tight">Select a batch<br />above to continue</p>
              )}
            </div>

            {/* Book Trial — only when checkbox is checked */}
            {cls.trial_available && wantsTrial && (
              <button
                onClick={handleBookTrialClick}
                className="rounded-xl border-2 border-primary px-3 py-2.5 text-xs font-bold text-primary transition-all active:scale-95 whitespace-nowrap"
              >
                Book Trial
              </button>
            )}

            {/* Enroll Now — only when batch is selected */}
            <button
              onClick={handleEnrollNow}
              disabled={!selectedBatchId}
              className={`rounded-xl px-4 py-2.5 text-sm font-bold text-white transition-all whitespace-nowrap ${
                selectedBatchId
                  ? "active:scale-95"
                  : "opacity-40 cursor-not-allowed"
              }`}
              style={{
                background: selectedBatchId
                  ? selectedBatchFull
                    ? "#F59E0B"
                    : "linear-gradient(135deg, oklch(0.78 0.18 250), oklch(0.62 0.20 250))"
                  : "oklch(0.60 0.0 0)",
              }}
            >
              {selectedBatchFull ? "Join Waitlist" : "Enroll Now"}
            </button>
          </div>
        </div>
      )}

      {/* ── Trial Booking Sheet ── */}
      <Sheet open={showTrialSheet} onOpenChange={(o) => { setShowTrialSheet(o); if (!o) { setSelectedDemoId(null); setSelectedMemberId(null); } }}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-base">Book a Trial Class</SheetTitle>
            <p className="text-xs text-muted-foreground">{cls.title}</p>
          </SheetHeader>

          {/* Demo session list */}
          <div className="mb-5">
            <p className="text-sm font-semibold mb-2">Choose a session</p>
            {demoSessions && demoSessions.length > 0 ? (
              <div className="space-y-2">
                {demoSessions.map((demo: any) => {
                  const isChosen = selectedDemoId === demo.id;
                  const spotsLeft = demo.max_participants - (demo.current_count ?? 0);
                  return (
                    <button
                      key={demo.id}
                      onClick={() => setSelectedDemoId(isChosen ? null : demo.id)}
                      className="w-full text-left"
                    >
                      <div className={`flex items-center gap-3 rounded-xl border-2 p-3 transition-all ${
                        isChosen ? "border-primary bg-primary/5" : "border-border"
                      }`}>
                        <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isChosen ? "border-primary" : "border-muted-foreground/40"
                        }`}>
                          {isChosen && <div className="h-2 w-2 rounded-full bg-primary" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold">
                            {new Date(demo.session_date).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {demo.start_time?.slice(0, 5)} – {demo.end_time?.slice(0, 5)}
                            {spotsLeft <= 3 && spotsLeft > 0 && (
                              <span className="ml-2 text-amber-600 font-medium">{spotsLeft} spots left</span>
                            )}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold">
                            {demo.fee > 0 ? `₹${demo.fee}` : "Free"}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No trial sessions scheduled yet.</p>
            )}
          </div>

          {/* Family member selector */}
          {demoSessions && demoSessions.length > 0 && (
            <div className="mb-5">
              <p className="text-sm font-semibold mb-2">Who is this for?</p>
              {activeFamilyMembers.length > 0 ? (
                <div className="space-y-2">
                  {activeFamilyMembers.map((member) => {
                    const isChosen = selectedMemberId === member.id;
                    return (
                      <button
                        key={member.id}
                        onClick={() => setSelectedMemberId(isChosen ? null : member.id)}
                        className="w-full text-left"
                      >
                        <div className={`flex items-center gap-3 rounded-xl border-2 p-3 transition-all ${
                          isChosen ? "border-primary bg-primary/5" : "border-border"
                        }`}>
                          <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            isChosen ? "border-primary" : "border-muted-foreground/40"
                          }`}>
                            {isChosen && <div className="h-2 w-2 rounded-full bg-primary" />}
                          </div>
                          <div>
                            <p className="text-sm font-semibold">{member.full_name}</p>
                            {member.relationship && (
                              <p className="text-xs text-muted-foreground capitalize">{member.relationship}</p>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-4 text-center">
                  <p className="text-sm text-muted-foreground">No family members added yet.</p>
                  <button
                    onClick={() => { setShowTrialSheet(false); navigate("/family"); }}
                    className="text-xs text-primary font-semibold mt-1"
                  >
                    Add a family member →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Confirm button */}
          <Button
            className="w-full"
            disabled={!selectedDemoId || !selectedMemberId || bookingDemo}
            onClick={handleConfirmDemo}
          >
            {bookingDemo ? "Booking…" : "Confirm Trial Booking"}
          </Button>
        </SheetContent>
      </Sheet>
    </div>
  );
});

ClassDetail.displayName = "ClassDetail";

export default ClassDetail;
