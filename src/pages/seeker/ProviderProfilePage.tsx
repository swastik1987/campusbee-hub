import { useParams, useNavigate } from "react-router-dom";
import { useProviderProfile, useProviderClasses as useProviderPublicClasses, useProviderTrainers } from "@/hooks/useSeeker";
import { useUser } from "@/contexts/UserContext";
import ClassCard from "@/components/shared/ClassCard";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, CheckCircle2, MessageCircle, Star } from "lucide-react";

const ProviderProfilePage = () => {
  const { providerId } = useParams();
  const navigate = useNavigate();
  const { currentApartment } = useUser();

  const { data: provider, isLoading } = useProviderProfile(providerId);
  const { data: classes } = useProviderPublicClasses(providerId, currentApartment?.id);
  const { data: trainers } = useProviderTrainers(providerId);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
          <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
          <Skeleton className="h-6 w-40" />
        </header>
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
        <button onClick={() => navigate(-1)} className="p-1"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-bold truncate">{provider.business_name || user?.full_name}</h1>
      </header>

      <div className="mx-auto w-full max-w-lg px-4 py-6 space-y-6">
        {/* Profile header */}
        <div className="flex items-center gap-4">
          <Avatar className="h-20 w-20 border-2 border-border">
            <AvatarImage src={user?.avatar_url} />
            <AvatarFallback className="text-xl bg-provider/10 text-provider">
              {user?.full_name?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-1.5">
              <h2 className="text-lg font-bold">{provider.business_name || user?.full_name}</h2>
              {provider.is_verified && <CheckCircle2 size={16} className="text-blue-500" />}
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              {provider.provider_type === "academy" && (
                <Badge variant="secondary" className="text-xs">Academy</Badge>
              )}
              {provider.experience_years && (
                <span className="text-xs text-muted-foreground">{provider.experience_years} yrs experience</span>
              )}
            </div>
          </div>
        </div>

        {/* Bio */}
        {provider.bio && (
          <div>
            <h3 className="text-sm font-bold mb-1">About</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{provider.bio}</p>
          </div>
        )}

        {/* Qualifications */}
        {provider.qualifications && (
          <div>
            <h3 className="text-sm font-bold mb-1">Qualifications</h3>
            <p className="text-sm text-muted-foreground">{provider.qualifications}</p>
          </div>
        )}

        {/* Specializations */}
        {provider.specializations && provider.specializations.length > 0 && (
          <div>
            <h3 className="text-sm font-bold mb-1.5">Specializations</h3>
            <div className="flex flex-wrap gap-1.5">
              {provider.specializations.map((s: string) => (
                <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
              ))}
            </div>
          </div>
        )}

        {/* Contact */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate(`/chat?with=${provider.user_id}`)}
          >
            <MessageCircle size={16} className="mr-1" /> Chat
          </Button>
          {provider.whatsapp_number && (
            <Button variant="outline" className="flex-1" onClick={handleWhatsApp}>
              WhatsApp
            </Button>
          )}
        </div>

        {/* Trainers (academy) */}
        {trainers && trainers.length > 0 && (
          <div>
            <h3 className="text-sm font-bold mb-3">Our Team</h3>
            <div className="space-y-2">
              {trainers.map((t) => (
                <Card key={t.id} className="flex items-center gap-3 p-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={t.photo_url ?? undefined} />
                    <AvatarFallback className="bg-provider/10 text-provider text-xs">{t.name[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{t.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.experience_years ? `${t.experience_years} yrs` : ""}
                      {t.specializations && t.specializations.length > 0 &&
                        ` · ${t.specializations.slice(0, 2).join(", ")}`
                      }
                    </p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Classes */}
        {classes && classes.length > 0 && (
          <div>
            <h3 className="text-sm font-bold mb-3">Classes by this Provider</h3>
            <div className="space-y-3">
              {classes.map((cls) => (
                <ClassCard key={cls.id} cls={cls as any} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProviderProfilePage;
