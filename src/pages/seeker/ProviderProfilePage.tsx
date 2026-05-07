import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProviderProfile, useProviderClasses as useProviderPublicClasses, useProviderTrainers } from "@/hooks/useSeeker";
import { useSeekerProviderCertifications, useSeekerTrainerCertifications } from "@/hooks/useCertifications";
import ClassCard from "@/components/shared/ClassCard";
import CertificationGallery from "@/components/shared/CertificationGallery";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle2, MessageCircle, Share2, Star, Users } from "lucide-react";

const TrainerCard = React.forwardRef<
  HTMLDivElement,
  { trainer: any; providerId: string }
>(({ trainer }, ref) => {
  const { data: certs } = useSeekerTrainerCertifications(trainer.id);
  return (
    <div ref={ref} className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={trainer.photo_url ?? undefined} />
          <AvatarFallback className="bg-primary/10 text-primary text-sm">{trainer.name[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold">{trainer.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {trainer.experience_years ? `${trainer.experience_years} yrs` : ""}
            {trainer.specializations?.length > 0 &&
              ` · ${trainer.specializations.slice(0, 2).join(", ")}`}
          </p>
        </div>
      </div>
      {certs && certs.length > 0 && (
        <CertificationGallery certs={certs} layout="scroll" />
      )}
    </div>
  );
});
TrainerCard.displayName = "TrainerCard";

type Tab = "classes" | "about" | "team";

const ProviderProfilePage = () => {
  const { providerId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("classes");

  const { data: provider, isLoading } = useProviderProfile(providerId);
  const { data: classes } = useProviderPublicClasses(providerId);
  const { data: trainers } = useProviderTrainers(providerId);
  const { data: providerCerts } = useSeekerProviderCertifications(providerId);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <div className="gradient-primary h-48" />
        <div className="px-4 -mt-10 space-y-4">
          <Skeleton className="h-20 w-20 rounded-full" />
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-20 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!provider) return null;

  const user = provider.users as any;
  const classCount = classes?.length ?? 0;

  const handleWhatsApp = () => {
    if (!provider.whatsapp_number) return;
    window.open(`https://wa.me/${provider.whatsapp_number}`, "_blank");
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: provider.business_name || user?.full_name, url: window.location.href });
    }
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "classes", label: `Classes${classCount > 0 ? ` (${classCount})` : ""}` },
    { id: "about", label: "About" },
    ...(trainers && trainers.length > 0 ? [{ id: "team" as Tab, label: "Team" }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background pb-8">
      {/* Hero */}
      <div className="relative gradient-primary pb-16 pt-12 px-4">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20"
          >
            <ArrowLeft size={18} className="text-white" />
          </button>
          <button
            onClick={handleShare}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20"
          >
            <Share2 size={18} className="text-white" />
          </button>
        </div>
      </div>

      {/* Profile card overlapping hero */}
      <div className="mx-auto w-full max-w-lg px-4 -mt-12">
        <div className="rounded-2xl bg-card border border-border p-4 shadow-sm">
          <div className="flex items-end gap-4">
            <Avatar className="h-20 w-20 border-4 border-card shadow-md flex-shrink-0">
              <AvatarImage src={user?.avatar_url} />
              <AvatarFallback className="text-2xl bg-primary/10 text-primary font-bold">
                {(provider.business_name || user?.full_name)?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0 pb-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-base font-bold leading-snug">
                  {provider.business_name || user?.full_name}
                </h1>
                {provider.is_verified && (
                  <CheckCircle2 size={15} className="text-primary flex-shrink-0" />
                )}
              </div>
              {provider.is_verified && (
                <span className="inline-flex items-center gap-1 mt-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
                  Verified Provider
                </span>
              )}
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {provider.provider_type === "academy" && (
                  <span className="text-[11px] font-semibold text-muted-foreground capitalize">Academy</span>
                )}
                {provider.experience_years && (
                  <span className="text-[11px] text-muted-foreground">{provider.experience_years} yrs exp</span>
                )}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-border">
            <div className="text-center">
              <p className="text-base font-bold text-primary">{classCount}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Classes</p>
            </div>
            <div className="text-center border-x border-border">
              <p className="text-base font-bold text-primary">{trainers?.length ?? 0}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Trainers</p>
            </div>
            <div className="text-center">
              <p className="text-base font-bold text-primary">{provider.experience_years ?? "—"}</p>
              <p className="text-[10px] text-muted-foreground font-medium">Yrs Exp</p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 mt-3">
            <Button
              className="flex-1 gradient-primary text-white rounded-xl h-10 text-sm font-semibold gap-1.5"
              onClick={() => navigate(`/chat?with=${provider.user_id}`)}
            >
              <MessageCircle size={15} /> Chat
            </Button>
            {provider.whatsapp_number && (
              <Button
                variant="outline"
                className="flex-1 rounded-xl h-10 text-sm font-semibold"
                onClick={handleWhatsApp}
              >
                WhatsApp
              </Button>
            )}
          </div>
        </div>

        {/* Specializations */}
        {provider.specializations && provider.specializations.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {provider.specializations.map((s: string) => (
              <span
                key={s}
                className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary"
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-0 mt-5 border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 pb-2 text-sm font-semibold transition-colors border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="mt-4 space-y-4">
          {activeTab === "classes" && (
            <>
              {classes && classes.length > 0 ? (
                <div className="space-y-3">
                  {classes.map((cls) => (
                    <ClassCard key={cls.id} cls={cls as any} />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-border py-10 text-center">
                  <p className="text-sm text-muted-foreground">No classes listed yet</p>
                </div>
              )}
            </>
          )}

          {activeTab === "about" && (
            <div className="space-y-4">
              {provider.bio && (
                <div>
                  <h3 className="text-sm font-bold mb-1.5">About</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{provider.bio}</p>
                </div>
              )}
              {provider.qualifications && (
                <div>
                  <h3 className="text-sm font-bold mb-1.5">Qualifications</h3>
                  <p className="text-sm text-muted-foreground">{provider.qualifications}</p>
                </div>
              )}
              {providerCerts && providerCerts.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold mb-2">Certifications</h3>
                  <CertificationGallery certs={providerCerts} layout="scroll" />
                </div>
              )}
              {!provider.bio && !provider.qualifications && (
                <div className="rounded-2xl border border-dashed border-border py-10 text-center">
                  <p className="text-sm text-muted-foreground">No info added yet</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "team" && trainers && trainers.length > 0 && (
            <div className="space-y-3">
              {trainers.map((t) => (
                <TrainerCard key={t.id} trainer={t} providerId={provider.id} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProviderProfilePage;
