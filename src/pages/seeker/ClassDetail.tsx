import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useSeekerClassDetail, useClassReviews } from "@/hooks/useSeeker";
import { useSeekerProviderCertifications } from "@/hooks/useCertifications";
import CertificationGallery from "@/components/shared/CertificationGallery";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  CheckCircle2,
  Clock,
  Heart,
  MapPin,
  MessageCircle,
  Share2,
  Star,
  Users,
} from "lucide-react";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const FEE_LABELS: Record<string, string> = {
  per_session: "/session",
  monthly: "/month",
  quarterly: "/quarter",
  for_duration: " total",
  one_time: " one-time",
};

const ClassDetail = () => {
  const { classId } = useParams();
  const navigate = useNavigate();
  const { profile } = useUser();
  const { data: cls, isLoading } = useSeekerClassDetail(classId);
  const { data: reviews } = useClassReviews(classId);
  const providerId = cls ? (cls as any).service_providers?.id : undefined;
  const { data: providerCerts } = useSeekerProviderCertifications(providerId);

  const [showFullDesc, setShowFullDesc] = useState(false);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [saved, setSaved] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Skeleton className="h-64 w-full" />
        <div className="p-4 space-y-4">
          <Skeleton className="h-5 w-32 rounded-full" />
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!cls) return null;

  const provider = (cls as any).service_providers;
  const providerUser = provider?.users;
  const activeBatches = (cls.batches ?? []).filter((b: any) => b.status === "active" || b.status === "full");
  const lowestFee = activeBatches.length > 0
    ? Math.min(...activeBatches.map((b: any) => b.fee_amount))
    : null;
  const lowestBatch = activeBatches.find((b: any) => b.fee_amount === lowestFee);
  const gallery = [cls.cover_image_url, ...(cls.gallery_urls ?? [])].filter(Boolean) as string[];

  // Info grid data from first active batch
  const firstBatch = activeBatches[0] as any;
  const firstSchedules = firstBatch?.batch_schedules ?? [];
  const scheduleDays = firstSchedules.map((s: any) => DAY_NAMES[s.day_of_week]).join(", ");
  const scheduleTime = firstSchedules[0]
    ? `${firstSchedules[0].start_time.slice(0, 5)}–${firstSchedules[0].end_time.slice(0, 5)}`
    : null;

  const handleShare = () => {
    const text = `Check out ${cls.title} on CampusBee!`;
    if (navigator.share) {
      navigator.share({ title: cls.title, text });
    } else {
      const waUrl = `https://wa.me/?text=${encodeURIComponent(text + " " + window.location.href)}`;
      window.open(waUrl, "_blank");
    }
  };

  const handleWhatsApp = () => {
    if (!provider?.whatsapp_number) return;
    const msg = encodeURIComponent(`Hi, I'm interested in "${cls.title}" class.`);
    window.open(`https://wa.me/${provider.whatsapp_number}?text=${msg}`, "_blank");
  };

  const categoryName = (cls.class_categories as any)?.name ?? "";
  const ageMin = (cls as any).age_min;
  const ageMax = (cls as any).age_max;
  const agesLabel = ageMin != null
    ? ageMax != null
      ? `Ages ${ageMin}–${ageMax}`
      : `Ages ${ageMin}+`
    : null;
  const distanceKm = (cls as any).distanceKm as number | undefined;

  return (
    <div className="flex min-h-screen flex-col bg-background pb-24">
      {/* Hero image — full bleed with overlay controls */}
      <div className="relative">
        {gallery.length > 0 ? (
          <img
            src={gallery[galleryIdx]}
            alt=""
            className="w-full h-64 object-cover"
          />
        ) : (
          <div className="w-full h-64 bg-primary/10 flex items-center justify-center">
            <BookOpen size={40} className="text-primary/30" />
          </div>
        )}

        {/* Top overlay buttons */}
        <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-4 pt-12 pb-4"
          style={{ background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 100%)" }}>
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSaved((s) => !s)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm"
            >
              <Heart
                size={18}
                className={saved ? "fill-red-400 text-red-400" : "text-white"}
              />
            </button>
            <button
              onClick={handleShare}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm"
            >
              <Share2 size={18} className="text-white" />
            </button>
          </div>
        </div>

        {/* Gallery dots */}
        {gallery.length > 1 && (
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {gallery.map((_, i) => (
              <button
                key={i}
                onClick={() => setGalleryIdx(i)}
                className={`h-1.5 rounded-full transition-all ${i === galleryIdx ? "w-4 bg-white" : "w-1.5 bg-white/50"}`}
              />
            ))}
          </div>
        )}
      </div>

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-5">
        {/* Breadcrumb + badges */}
        <div className="space-y-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            class {categoryName ? `· ${categoryName}` : ""}
          </p>

          <div className="flex flex-wrap gap-2">
            {cls.trial_available && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-semibold text-green-700">
                ✓ FREE TRIAL
              </span>
            )}
            {agesLabel && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
                {agesLabel}
              </span>
            )}
            {cls.class_type && (
              <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground capitalize">
                {cls.class_type.replace("_", " ")}
              </span>
            )}
          </div>
        </div>

        {/* Title + rating + distance */}
        <div className="space-y-1.5">
          <h1 className="text-xl font-bold leading-snug">{cls.title}</h1>
          <div className="flex items-center gap-3">
            {(cls.rating_count ?? 0) > 0 && (
              <div className="flex items-center gap-1">
                <Star size={14} className="text-amber-500 fill-amber-500" />
                <span className="text-sm font-semibold">{cls.total_rating}</span>
                <span className="text-xs text-muted-foreground">({cls.rating_count})</span>
              </div>
            )}
            {distanceKm != null && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin size={12} />
                <span>{distanceKm.toFixed(1)} km away</span>
              </div>
            )}
          </div>
        </div>

        {/* Provider row */}
        <div className="flex items-center gap-3 py-3 border-t border-b border-border">
          <Avatar
            className="h-11 w-11 cursor-pointer"
            onClick={() => navigate(`/provider-profile/${provider?.id}`)}
          >
            <AvatarImage src={providerUser?.avatar_url} />
            <AvatarFallback className="bg-primary/10 text-primary text-sm">
              {(provider?.business_name || providerUser?.full_name)?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p
                className="text-sm font-semibold truncate cursor-pointer"
                onClick={() => navigate(`/provider-profile/${provider?.id}`)}
              >
                {provider?.business_name || providerUser?.full_name}
              </p>
              {provider?.is_verified && (
                <CheckCircle2 size={13} className="text-primary flex-shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
              {provider?.provider_type === "academy" && (
                <span className="capitalize">Academy</span>
              )}
              {provider?.experience_years && (
                <span>{provider.experience_years} yrs exp</span>
              )}
            </div>
          </div>
          <button
            onClick={() => navigate(`/provider-profile/${provider?.id}`)}
            className="text-xs font-semibold text-primary flex-shrink-0"
          >
            View →
          </button>
        </div>

        {/* Info grid (2×2) */}
        {(scheduleDays || scheduleTime || firstBatch?.max_batch_size || firstBatch?.skill_level) && (
          <div className="grid grid-cols-2 gap-3">
            {scheduleDays && (
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Schedule</p>
                <div className="flex items-center gap-1.5">
                  <Calendar size={13} className="text-primary flex-shrink-0" />
                  <p className="text-xs font-semibold">{scheduleDays}</p>
                </div>
              </div>
            )}
            {scheduleTime && (
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Duration</p>
                <div className="flex items-center gap-1.5">
                  <Clock size={13} className="text-primary flex-shrink-0" />
                  <p className="text-xs font-semibold">{scheduleTime}</p>
                </div>
              </div>
            )}
            {firstBatch?.max_batch_size && (
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Class Size</p>
                <div className="flex items-center gap-1.5">
                  <Users size={13} className="text-primary flex-shrink-0" />
                  <p className="text-xs font-semibold">Max {firstBatch.max_batch_size}</p>
                </div>
              </div>
            )}
            {firstBatch?.skill_level && (
              <div className="rounded-xl bg-muted/50 p-3">
                <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Skill Level</p>
                <div className="flex items-center gap-1.5">
                  <Star size={13} className="text-primary flex-shrink-0" />
                  <p className="text-xs font-semibold capitalize">{firstBatch.skill_level.replace("_", " ")}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* About this class */}
        {(cls.description || cls.short_description) && (
          <div>
            <h2 className="text-base font-bold mb-2">About this class</h2>
            <p className={`text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed ${!showFullDesc && "line-clamp-4"}`}>
              {cls.description || cls.short_description}
            </p>
            {(cls.description?.length ?? 0) > 200 && (
              <button
                onClick={() => setShowFullDesc(!showFullDesc)}
                className="text-xs text-primary font-semibold mt-1"
              >
                {showFullDesc ? "Show less" : "Read more"}
              </button>
            )}
          </div>
        )}

        {/* Venue + What to bring */}
        {(cls.venue_details || cls.what_to_bring) && (
          <div className="rounded-xl border border-border p-4 space-y-3">
            {cls.venue_details && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                  <MapPin size={14} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold">Venue</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{cls.venue_details}</p>
                </div>
              </div>
            )}
            {cls.what_to_bring && (
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 flex-shrink-0">
                  <BookOpen size={14} className="text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold">What to Bring</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{cls.what_to_bring}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Trainers (academy) */}
        {provider?.provider_type === "academy" && cls.batches?.some((b: any) => b.trainers) && (
          <div>
            <h2 className="text-base font-bold mb-3">Meet the Trainers</h2>
            <div className="flex gap-4 overflow-x-auto pb-1 scrollbar-hide">
              {Array.from(
                new Map(
                  cls.batches
                    ?.filter((b: any) => b.trainers?.name)
                    .map((b: any) => [b.trainers.id, b.trainers])
                ).values()
              ).map((t: any) => (
                <div key={t.id} className="flex flex-col items-center gap-1.5 w-16 flex-shrink-0">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={t.photo_url} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">{t.name[0]}</AvatarFallback>
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

        {/* Available Batches */}
        <div>
          <h2 className="text-base font-bold mb-3">Available Batches</h2>
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

                return (
                  <div key={batch.id} className="rounded-2xl border border-border bg-card p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-semibold text-sm">{batch.batch_name}</h3>
                        {batch.skill_level && (
                          <span className="text-[10px] font-semibold capitalize text-muted-foreground">
                            {batch.skill_level.replace("_", " ")}
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-base text-primary">
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

                    {scheduleSummary && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar size={12} />
                          <span>{scheduleSummary}</span>
                        </div>
                        {timeSummary && (
                          <div className="flex items-center gap-1">
                            <Clock size={12} />
                            <span>{timeSummary}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {batch.trainers?.name && (
                      <p className="text-xs text-muted-foreground">Trainer: {batch.trainers.name}</p>
                    )}

                    {(() => {
                      const today = new Date().toISOString().split("T")[0];
                      const startDate = batch.start_date;
                      const endDate = batch.end_date;
                      const isFuture = startDate && startDate > today;
                      return (startDate || endDate) ? (
                        <div className="flex flex-wrap items-center gap-x-2 text-xs">
                          {isFuture ? (
                            <span className="text-primary font-medium">
                              Starting {new Date(startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
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
                      ) : null;
                    })()}

                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1 text-xs">
                        <Users size={12} className="text-muted-foreground" />
                        {isFull ? (
                          <span className="text-amber-600 font-medium">Full</span>
                        ) : slotsLeft <= 5 ? (
                          <span className="text-green-600 font-medium">{slotsLeft} spots left</span>
                        ) : (
                          <span className="text-muted-foreground">{slotsLeft} spots left</span>
                        )}
                      </div>
                      <Button
                        size="sm"
                        onClick={() => navigate(`/enroll/${batch.id}`)}
                        className={`text-xs px-4 ${isFull
                          ? "bg-amber-500 hover:bg-amber-600 text-white"
                          : "gradient-primary text-white"
                        }`}
                      >
                        {isFull ? "Join Waitlist" : "Enroll Now"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border py-8 text-center">
              <Calendar size={24} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No active batches right now</p>
            </div>
          )}
        </div>

        {/* Add-ons */}
        {cls.class_addons && (cls.class_addons as any[]).length > 0 && (
          <div>
            <h2 className="text-base font-bold mb-3">Add-ons</h2>
            <div className="space-y-2">
              {(cls.class_addons as any[]).map((addon) => (
                <div key={addon.id} className="flex items-center justify-between rounded-xl border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">{addon.name}</p>
                    {addon.description && (
                      <p className="text-xs text-muted-foreground">{addon.description}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-primary">₹{addon.fee_amount}</p>
                    {addon.is_mandatory && (
                      <span className="text-[10px] font-semibold text-destructive">Required</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">Reviews</h2>
            {(cls.rating_count ?? 0) > 0 && (
              <div className="flex items-center gap-1">
                <Star size={14} className="text-amber-500 fill-amber-500" />
                <span className="text-sm font-bold">{cls.total_rating}</span>
                <span className="text-xs text-muted-foreground">({cls.rating_count})</span>
              </div>
            )}
          </div>
          {reviews && reviews.length > 0 ? (
            <div className="space-y-4">
              {reviews.slice(0, 5).map((review: any) => (
                <div key={review.id} className="border-b border-border pb-4 last:border-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={review.users?.avatar_url} />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {review.users?.full_name?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-xs font-semibold">{review.users?.full_name}</p>
                    </div>
                    <div className="flex gap-0.5">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star
                          key={i}
                          size={11}
                          className={i < review.rating ? "text-amber-500 fill-amber-500" : "text-border fill-border"}
                        />
                      ))}
                    </div>
                  </div>
                  {review.review_text && (
                    <p className="text-xs text-muted-foreground leading-relaxed">{review.review_text}</p>
                  )}
                  {review.is_verified && (
                    <span className="inline-flex items-center gap-1 mt-1.5 text-[10px] font-semibold text-green-600">
                      <CheckCircle2 size={10} /> Verified Enrollment
                    </span>
                  )}
                  {review.provider_reply && (
                    <div className="mt-2 ml-4 p-2.5 rounded-xl bg-muted text-xs">
                      <p className="font-semibold text-[10px] mb-0.5 text-primary">Provider Reply</p>
                      <p className="text-muted-foreground">{review.provider_reply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border py-8 text-center">
              <Star size={20} className="mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">No reviews yet</p>
            </div>
          )}
        </div>

        {/* WhatsApp button */}
        {provider?.whatsapp_number && (
          <Button
            variant="outline"
            className="w-full rounded-xl h-11 text-sm font-medium gap-2"
            onClick={handleWhatsApp}
          >
            <MessageCircle size={16} />
            Chat on WhatsApp
          </Button>
        )}
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card px-4 py-3">
        <div className="mx-auto max-w-lg flex items-center gap-3">
          {cls.trial_available && (
            <Button
              variant="outline"
              className="flex-1 rounded-xl h-12 font-semibold border-primary text-primary"
              onClick={() => {
                if (activeBatches[0]) navigate(`/enroll/${activeBatches[0].id}`);
              }}
            >
              Book trial
            </Button>
          )}
          {activeBatches.length > 0 && lowestFee !== null ? (
            <Button
              className="flex-1 gradient-primary text-white rounded-xl h-12 font-semibold"
              onClick={() => navigate(`/enroll/${activeBatches[0].id}`)}
            >
              Enroll now →
            </Button>
          ) : (
            <Button
              variant="outline"
              className="flex-1 rounded-xl h-12 font-semibold"
              onClick={() => navigate(`/chat?with=${provider?.user_id}`)}
            >
              <MessageCircle size={16} className="mr-2" /> Message
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClassDetail;
