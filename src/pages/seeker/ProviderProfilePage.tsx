import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProviderProfile, useProviderClasses as useProviderPublicClasses, useProviderTrainers } from "@/hooks/useSeeker";
import { useSeekerProviderCertifications, useSeekerTrainerCertifications } from "@/hooks/useCertifications";
import ClassCard from "@/components/shared/ClassCard";
import CertificationGallery from "@/components/shared/CertificationGallery";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BookOpen, CheckCircle2, Image, MessageCircle, Share2, Star } from "lucide-react";

// ── TrainerCard with inline certifications ─────────────────────────────────────

const TrainerCard = React.forwardRef<
  HTMLDivElement,
  { trainer: any; providerId: string }
>(({ trainer }, ref) => {
  const { data: certs } = useSeekerTrainerCertifications(trainer.id);
  return (
    <Card ref={ref} className="p-3 space-y-2">
      <div className="flex items-center gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={trainer.photo_url ?? undefined} />
          <AvatarFallback className="bg-provider/10 text-provider text-xs">{trainer.name[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="text-sm font-semibold">{trainer.name}</p>
          <p className="text-xs text-muted-foreground">
            {trainer.experience_years ? `${trainer.experience_years} yrs` : ""}
            {trainer.specializations && trainer.specializations.length > 0 &&
              ` · ${trainer.specializations.slice(0, 2).join(", ")}`
            }
          </p>
        </div>
      </div>
      {certs && certs.length > 0 && (
        <CertificationGallery certs={certs} layout="scroll" />
      )}
    </Card>
  );
});
TrainerCard.displayName = "TrainerCard";

// ── Main page ──────────────────────────────────────────────────────────────────

const ProviderProfilePage = () => {
  const { providerId } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"classes" | "about" | "reviews" | "photos">("classes");

  const { data: provider, isLoading } = useProviderProfile(providerId);
  const { data: classes } = useProviderPublicClasses(providerId);
  const { data: trainers } = useProviderTrainers(providerId);
  const { data: providerCerts } = useSeekerProviderCertifications(providerId);

  if (isLoading) {
    return (
      <div className="seeker-theme flex min-h-screen flex-col bg-background">
        <Skeleton className="h-40 w-full" />
        <div className="p-6 space-y-4">
          <Skeleton className="h-20 w-20 rounded-full -mt-10" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!provider) return null;

  const user = provider.users as any;

  const handleWhatsApp = () => {
    if (!provider.whatsapp_number) return;
    window.open(`https://wa.me/${provider.whatsapp_number}`, "_blank");
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: provider.business_name || user?.full_name });
    }
  };

  const TABS = [
    { key: "classes", label: "Classes" },
    { key: "about", label: "About" },
    { key: "reviews", label: "Reviews" },
    { key: "photos", label: "Photos" },
  ] as const;

  return (
    <div className="seeker-theme flex min-h-screen flex-col bg-background pb-6">
      {/* Cover image area */}
      <div className="relative">
        <div
          className="h-40 w-full"
          style={{
            background: user?.avatar_url
              ? `url(${user.avatar_url}) center/cover`
              : "linear-gradient(160deg, oklch(0.78 0.18 250) 0%, oklch(0.62 0.20 250) 100%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        {/* Overlay action buttons */}
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

      {/* Identity card — overlaps cover with negative margin */}
      <div className="mx-auto w-full max-w-lg px-4">
        <div className="-mt-12 relative z-10 flex items-end gap-4">
          <Avatar className="h-20 w-20 border-4 border-background shadow-lg flex-shrink-0">
            <AvatarImage src={user?.avatar_url} />
            <AvatarFallback className="text-xl" style={{ background: "linear-gradient(135deg, oklch(0.78 0.18 250), oklch(0.62 0.20 250))", color: "white" }}>
              {user?.full_name?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="pb-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <h2 className="text-base font-bold">{provider.business_name || user?.full_name}</h2>
              {provider.is_verified && <CheckCircle2 size={14} className="text-blue-500 shrink-0" />}
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              {provider.provider_type === "academy" && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">Academy</Badge>
              )}
              {provider.experience_years && (
                <span className="text-xs text-muted-foreground">{provider.experience_years} yrs</span>
              )}
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => navigate(`/chat?with=${provider.user_id}`)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border-2 border-primary py-2.5 text-sm font-semibold text-primary transition-all active:scale-95"
          >
            <MessageCircle size={15} /> Chat
          </button>
          {provider.whatsapp_number && (
            <button
              onClick={handleWhatsApp}
              className="flex-1 flex items-center justify-center rounded-xl py-2.5 text-sm font-semibold text-white transition-all active:scale-95"
              style={{ background: "#25D366" }}
            >
              WhatsApp
            </button>
          )}
        </div>

        {/* Tab strip */}
        <div className="flex gap-0 mt-5 border-b border-border">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="flex-1 pb-2.5 text-xs font-semibold transition-all"
              style={tab === t.key ? {
                borderBottom: "2.5px solid oklch(0.62 0.20 250)",
                color: "oklch(0.50 0.20 250)",
              } : {
                color: "hsl(var(--muted-foreground))",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Classes tab */}
        {tab === "classes" && (
          <div className="mt-4 space-y-3">
            {classes && classes.length > 0 ? (
              classes.map((cls) => (
                <ClassCard key={cls.id} cls={cls as any} />
              ))
            ) : (
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <BookOpen size={32} className="text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No classes available</p>
              </div>
            )}
          </div>
        )}

        {/* About tab */}
        {tab === "about" && (
          <div className="mt-4 space-y-5">
            {provider.bio && (
              <div>
                <h3 className="text-sm font-bold mb-1.5">About</h3>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{provider.bio}</p>
              </div>
            )}
            {provider.qualifications && (
              <div>
                <h3 className="text-sm font-bold mb-1.5">Qualifications</h3>
                <p className="text-sm text-muted-foreground">{provider.qualifications}</p>
              </div>
            )}
            {provider.specializations && provider.specializations.length > 0 && (
              <div>
                <h3 className="text-sm font-bold mb-2">Specializations</h3>
                <div className="flex flex-wrap gap-1.5">
                  {provider.specializations.map((s: string) => (
                    <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                  ))}
                </div>
              </div>
            )}
            {providerCerts && providerCerts.length > 0 && (
              <CertificationGallery certs={providerCerts} layout="scroll" />
            )}
            {trainers && trainers.length > 0 && (
              <div>
                <h3 className="text-sm font-bold mb-3">Our Team</h3>
                <div className="space-y-2">
                  {trainers.map((t) => (
                    <TrainerCard key={t.id} trainer={t} providerId={provider.id} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Reviews tab — empty state stub */}
        {tab === "reviews" && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: "oklch(0.94 0.04 250)" }}>
              <Star size={26} style={{ color: "oklch(0.62 0.20 250)" }} />
            </div>
            <p className="text-sm text-muted-foreground">No reviews yet</p>
          </div>
        )}

        {/* Photos tab — empty state stub */}
        {tab === "photos" && (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ backgroundColor: "oklch(0.94 0.04 250)" }}>
              <Image size={26} style={{ color: "oklch(0.62 0.20 250)" }} />
            </div>
            <p className="text-sm text-muted-foreground">No photos yet</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderProfilePage;
