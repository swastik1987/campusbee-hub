import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useSeekerClassDetail, useClassReviews } from "@/hooks/useSeeker";
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
  Clock,
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

  const [showFullDesc, setShowFullDesc] = useState(false);
  const [galleryIdx, setGalleryIdx] = useState(0);

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

  if (!cls) return null;

  const par = cls.provider_apartment_registrations as any;
  const provider = par?.service_providers;
  const providerUser = provider?.users;
  const apartment = par?.apartment_complexes;
  const activeBatches = (cls.batches ?? []).filter((b: any) => b.status === "active" || b.status === "full");
  const lowestFee = activeBatches.length > 0
    ? Math.min(...activeBatches.map((b: any) => b.fee_amount))
    : null;
  const lowestBatch = activeBatches.find((b: any) => b.fee_amount === lowestFee);
  const gallery = [cls.cover_image_url, ...(cls.gallery_urls ?? [])].filter(Boolean) as string[];

  const handleShare = () => {
    const text = `Check out ${cls.title}${apartment ? ` at ${apartment.name}` : ""} on CampusBee!`;
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

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-bold truncate flex-1">{cls.title}</h1>
        <button onClick={handleShare} className="p-1"><Share2 size={18} /></button>
      </header>

      {/* Cover / Gallery */}
      {gallery.length > 0 ? (
        <div className="relative">
          <img src={gallery[galleryIdx]} alt="" className="w-full h-48 object-cover" />
          {gallery.length > 1 && (
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
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
      ) : (
        <div className="flex h-32 items-center justify-center bg-muted">
          <BookOpen size={32} className="text-muted-foreground" />
        </div>
      )}

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-5">
        {/* Title + meta */}
        <div>
          <h2 className="text-xl font-bold">{cls.title}</h2>
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

        {/* Provider card */}
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12" onClick={() => navigate(`/provider-profile/${provider?.id}`)}>
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
                {provider?.provider_type === "academy" && <Badge variant="secondary" className="text-[9px] px-1 py-0">Academy</Badge>}
                {provider?.experience_years && <span>{provider.experience_years} yrs exp</span>}
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              size="sm"
              variant="outline"
              className="flex-1 text-xs"
              onClick={() => navigate(`/chat?with=${provider?.user_id}`)}
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

        {/* Available Batches */}
        <div>
          <h3 className="text-sm font-bold mb-3">Available Batches</h3>
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
                  <Card key={batch.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-semibold text-sm">{batch.batch_name}</h4>
                        {batch.skill_level && (
                          <Badge variant="secondary" className="text-[10px] capitalize mt-0.5">
                            {batch.skill_level.replace("_", " ")}
                          </Badge>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-sm">
                          ₹{batch.fee_amount}
                          <span className="text-xs font-normal text-muted-foreground">
                            {FEE_LABELS[batch.fee_frequency] ?? ""}
                          </span>
                        </p>
                        {batch.registration_fee > 0 && (
                          <p className="text-[10px] text-muted-foreground">
                            + ₹{batch.registration_fee} reg. fee
                          </p>
                        )}
                      </div>
                    </div>
                    {scheduleSummary && (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Calendar size={12} />
                        <span>{scheduleSummary}</span>
                        <span>·</span>
                        <Clock size={12} />
                        <span>{timeSummary}</span>
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
                      return (
                        (startDate || endDate) && (
                          <div className="flex flex-wrap items-center gap-x-2 text-xs">
                            {isFuture ? (
                              <span className="text-blue-600 font-medium">
                                Starting from {new Date(startDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            ) : startDate ? (
                              <span className="text-green-600 font-medium">Class is live</span>
                            ) : null}
                            {endDate && (
                              <span className="text-muted-foreground">
                                · Ending on {new Date(endDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                              </span>
                            )}
                          </div>
                        )
                      );
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
                        className={isFull
                          ? "bg-amber-500 hover:bg-amber-600 text-white text-xs"
                          : "bg-primary hover:bg-primary/90 text-white text-xs"
                        }
                      >
                        {isFull ? "Join Waitlist" : "Enroll Now"}
                      </Button>
                    </div>
                  </Card>
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

        {/* Trial */}
        {cls.trial_available && (
          <Card className="p-4 border-primary/30 bg-primary/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-sm">Trial Class Available</p>
                <p className="text-xs text-muted-foreground">
                  {cls.trial_fee && cls.trial_fee > 0 ? `₹${cls.trial_fee}` : "Free"} — Try before you enroll
                </p>
              </div>
              <Button size="sm" variant="outline" className="border-primary text-primary">
                Book Trial
              </Button>
            </div>
          </Card>
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

      {/* Sticky bottom CTA */}
      {activeBatches.length > 0 && lowestFee !== null && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-card p-3">
          <div className="mx-auto max-w-lg flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Starting from</p>
              <p className="font-bold">
                ₹{lowestFee}
                <span className="text-xs font-normal text-muted-foreground">
                  {FEE_LABELS[lowestBatch?.fee_frequency ?? ""] ?? ""}
                </span>
              </p>
            </div>
            <Button
              onClick={() => {
                const first = activeBatches[0] as any;
                navigate(`/enroll/${first.id}`);
              }}
              className="bg-primary hover:bg-primary/90 text-white px-6"
            >
              Enroll Now
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClassDetail;
