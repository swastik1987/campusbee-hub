import { useState, useMemo } from "react";
import {
  usePlatformProviders,
  useVerifyProvider,
  useSuspendProvider,
  useReinstateProvider,
} from "@/hooks/usePlatformAdmin";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  BadgeCheck,
  Ban,
  Crown,
  Loader2,
  RotateCcw,
  Search,
  Users,
} from "lucide-react";
import { toast } from "sonner";

type FilterTab = "all" | "active" | "suspended" | "premium";

const FILTER_TABS: { label: string; value: FilterTab }[] = [
  { label: "All", value: "all" },
  { label: "Active", value: "active" },
  { label: "Suspended", value: "suspended" },
  { label: "Premium", value: "premium" },
];

const PlatformProviders = () => {
  const [activeTab, setActiveTab] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [suspendState, setSuspendState] = useState<{ id: string; name: string } | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  const apiFilters = useMemo(() => {
    if (activeTab === "suspended") return { status: "suspended" };
    if (activeTab === "active") return { status: "active" };
    if (activeTab === "premium") return { tier: "premium" };
    return {};
  }, [activeTab]);

  const { data: providers, isLoading, error, refetch } = usePlatformProviders(apiFilters);
  const verify = useVerifyProvider();
  const suspend = useSuspendProvider();
  const reinstate = useReinstateProvider();

  // Client-side search
  const filtered = useMemo(() => {
    if (!providers) return [];
    if (!search.trim()) return providers;
    const q = search.toLowerCase();
    return (providers as any[]).filter(
      (p) =>
        p.business_name?.toLowerCase().includes(q) ||
        p.users?.full_name?.toLowerCase().includes(q) ||
        p.users?.email?.toLowerCase().includes(q)
    );
  }, [providers, search]);

  const handleVerify = async (providerId: string, current: boolean) => {
    try {
      await verify.mutateAsync({ providerId, isVerified: !current });
      toast.success(current ? "Verification removed" : "Instructor verified");
    } catch {
      toast.error("Failed to update verification");
    }
  };

  const handleSuspend = async () => {
    if (!suspendState || !suspendReason.trim()) return;
    try {
      await suspend.mutateAsync({ providerId: suspendState.id, reason: suspendReason.trim() });
      toast.success(`${suspendState.name} has been suspended`);
      setSuspendState(null);
      setSuspendReason("");
    } catch {
      toast.error("Failed to suspend provider");
    }
  };

  const handleReinstate = async (providerId: string, name: string) => {
    try {
      await reinstate.mutateAsync(providerId);
      toast.success(`${name} has been reinstated`);
    } catch {
      toast.error("Failed to reinstate provider");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold">Instructors Directory</h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Manage provider verification, subscription tiers, and account status
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeTab === tab.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by business, owner, or email…"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground">Failed to load instructors</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center py-16 gap-3">
          <Users size={44} className="text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No instructors found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(filtered as any[]).map((provider) => {
            const user = provider.users;
            const isSuspended = !!provider.suspended_at;
            const isPremium = provider.subscription_tier === "premium";
            return (
              <Card
                key={provider.id}
                className={`p-4 space-y-3 transition-colors ${
                  isSuspended ? "border-red-200 bg-red-50/30" : ""
                }`}
              >
                {/* Provider identity */}
                <div className="flex items-start gap-3">
                  <Avatar className="h-11 w-11 shrink-0">
                    <AvatarImage src={user?.avatar_url} />
                    <AvatarFallback className="bg-indigo-100 text-indigo-700 font-bold text-sm">
                      {provider.business_name?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-semibold">{provider.business_name}</p>
                      {provider.is_verified && (
                        <Badge className="bg-blue-100 text-blue-700 border-0 text-[10px] gap-0.5 h-4 px-1.5">
                          <BadgeCheck size={10} />
                          Verified
                        </Badge>
                      )}
                      {isPremium && (
                        <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px] gap-0.5 h-4 px-1.5">
                          <Crown size={10} />
                          Premium
                        </Badge>
                      )}
                      {isSuspended && (
                        <Badge className="bg-red-100 text-red-700 border-0 text-[10px] gap-0.5 h-4 px-1.5">
                          <Ban size={10} />
                          Suspended
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {user?.full_name}
                      {user?.email && ` · ${user.email}`}
                    </p>
                    <p className="text-[10px] text-muted-foreground capitalize mt-0.5">
                      {provider.provider_type} · Joined{" "}
                      {new Date(provider.created_at).toLocaleDateString("en-IN", {
                        month: "short",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </div>

                {/* Suspension reason */}
                {isSuspended && provider.suspension_reason && (
                  <div className="rounded-lg bg-red-100/60 px-3 py-2">
                    <p className="text-[10px] font-medium text-red-700">Suspension reason</p>
                    <p className="text-xs text-red-600">{provider.suspension_reason}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  <Button
                    size="sm"
                    variant="outline"
                    className={`gap-1.5 text-xs ${
                      provider.is_verified
                        ? "text-muted-foreground hover:text-foreground"
                        : "text-blue-700 border-blue-200 hover:bg-blue-50"
                    }`}
                    onClick={() => handleVerify(provider.id, provider.is_verified)}
                    disabled={verify.isPending}
                  >
                    <BadgeCheck size={13} />
                    {provider.is_verified ? "Remove Verify" : "Verify"}
                  </Button>

                  {isSuspended ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs text-green-700 border-green-200 hover:bg-green-50"
                      onClick={() => handleReinstate(provider.id, provider.business_name)}
                      disabled={reinstate.isPending}
                    >
                      <RotateCcw size={13} />
                      Reinstate
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 text-xs text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => {
                        setSuspendState({ id: provider.id, name: provider.business_name });
                        setSuspendReason("");
                      }}
                    >
                      <Ban size={13} />
                      Suspend
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Suspend sheet */}
      <Sheet
        open={!!suspendState}
        onOpenChange={(open) => { if (!open) { setSuspendState(null); setSuspendReason(""); } }}
      >
        <SheetContent side="bottom" className="rounded-t-2xl pb-8">
          <SheetHeader className="mb-5">
            <SheetTitle className="flex items-center gap-2">
              <Ban size={18} className="text-destructive" />
              Suspend {suspendState?.name}
            </SheetTitle>
          </SheetHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                Reason <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={suspendReason}
                onChange={(e) => setSuspendReason(e.target.value)}
                placeholder="Reason for suspension (shown to the provider)…"
                rows={3}
                className="resize-none"
              />
            </div>
            <Button
              className="w-full h-11 bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-2"
              onClick={handleSuspend}
              disabled={!suspendReason.trim() || suspend.isPending}
            >
              {suspend.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Ban size={16} />
              )}
              Confirm Suspension
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default PlatformProviders;
