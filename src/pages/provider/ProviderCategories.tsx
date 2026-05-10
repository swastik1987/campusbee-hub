/**
 * ProviderCategories — /provider/categories
 *
 * Standalone page for providers to:
 * - View all their category/sub-category requests with status
 * - Accept or Decline an admin re-tag suggestion
 * - Submit a new request via the CategoryRequestSheet
 *
 * Also reachable from CreateClass via "+ Request new category" shortcut.
 */

import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  useMyCategoryRequests,
  useRespondToRetag,
} from "@/hooks/useCategoryRequests";
import CategoryRequestSheet from "@/components/provider/CategoryRequestSheet";
import { ICON_MAP } from "@/components/provider/IconPicker";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Check,
  Clock,
  FolderPlus,
  FolderTree,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";

// ── Status display config ─────────────────────────────────────────────────────

const STATUS_CFG: Record<
  string,
  { label: string; classes: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Under Review",
    classes: "border-amber-300 text-amber-700 bg-amber-50",
    icon: <Clock size={10} />,
  },
  approved: {
    label: "Approved",
    classes: "border-green-300 text-green-700 bg-green-50",
    icon: <Check size={10} />,
  },
  rejected: {
    label: "Declined",
    classes: "border-red-300 text-red-700 bg-red-50",
    icon: <X size={10} />,
  },
  retag_pending: {
    label: "Action Required",
    classes: "border-blue-300 text-blue-700 bg-blue-50",
    icon: <FolderTree size={10} />,
  },
  retag_declined: {
    label: "Re-tag Declined",
    classes: "border-slate-300 text-slate-700 bg-slate-50",
    icon: <X size={10} />,
  },
};

// ── Component ─────────────────────────────────────────────────────────────────

const ProviderCategories = () => {
  const navigate = useNavigate();
  const { providerProfile } = useUser();

  const { data: requests, isLoading } = useMyCategoryRequests(
    providerProfile?.id
  );
  const respondToRetag = useRespondToRetag();

  const [showSheet, setShowSheet] = React.useState(false);
  const [respondingId, setRespondingId] = React.useState<string | null>(null);

  const handleRespond = async (requestId: string, accepted: boolean) => {
    setRespondingId(requestId);
    try {
      await respondToRetag.mutateAsync({ requestId, accepted });
      toast.success(
        accepted
          ? "Accepted — you can now use that category for your classes."
          : "Declined. You can submit a new request if needed."
      );
    } catch {
      toast.error("Failed to respond. Please try again.");
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background pb-24">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-bold">My Category Requests</h1>
        </div>
        <Button
          size="sm"
          className="gap-1.5 bg-provider hover:bg-provider/90 text-white"
          onClick={() => setShowSheet(true)}
        >
          <Plus size={14} /> New Request
        </Button>
      </header>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-3">
        {isLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))
        ) : !requests || requests.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-provider/10">
              <FolderPlus size={28} className="text-provider" />
            </div>
            <p className="font-semibold text-base">No requests yet</p>
            <p className="text-sm text-muted-foreground max-w-xs">
              Don't see the right category for your class? Request a new one —
              our team will review it shortly.
            </p>
            <Button
              className="mt-2 gap-2 bg-provider hover:bg-provider/90 text-white"
              onClick={() => setShowSheet(true)}
            >
              <Plus size={15} /> Request a Category
            </Button>
          </div>
        ) : (
          requests.map((req: any) => {
            const cfg = STATUS_CFG[req.status] ?? STATUS_CFG.pending;
            const ReqIcon = req.requested_icon
              ? ICON_MAP[req.requested_icon]
              : null;
            const RetagIcon =
              req.retag_cat?.icon ? ICON_MAP[req.retag_cat.icon] : null;
            const isResponding = respondingId === req.id;

            return (
              <Card key={req.id} className="p-4 space-y-3">
                {/* Top row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {ReqIcon && (
                      <ReqIcon size={18} className="text-provider shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-sm truncate">
                        {req.requested_name}
                      </p>
                      {req.request_type === "new_subcategory" &&
                        req.parent_cat?.name && (
                          <p className="text-[11px] text-muted-foreground">
                            Under: {req.parent_cat.name}
                          </p>
                        )}
                      {req.request_type === "new_category" && (
                        <p className="text-[11px] text-muted-foreground">
                          New top-level category
                        </p>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] shrink-0 flex items-center gap-1 ${cfg.classes}`}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </Badge>
                </div>

                {/* Requested sub-categories */}
                {req.requested_subcategories?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      Requested sub-categories
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {req.requested_subcategories.map((s: string, i: number) => (
                        <span
                          key={i}
                          className="bg-provider/10 text-provider rounded-lg px-2 py-0.5 text-[11px] font-medium"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                {req.description && (
                  <p className="text-xs text-muted-foreground">
                    {req.description}
                  </p>
                )}

                {/* Rejection reason */}
                {req.status === "rejected" && req.admin_notes && (
                  <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                    <p className="text-xs text-red-700">
                      <span className="font-semibold">Reason: </span>
                      {req.admin_notes}
                    </p>
                    <p className="text-[10px] text-red-600 mt-1">
                      You can submit a new request with a different name or
                      description.
                    </p>
                  </div>
                )}

                {/* Approved */}
                {req.status === "approved" && (
                  <div className="rounded-lg border border-green-200 bg-green-50 px-3 py-2">
                    <p className="text-xs text-green-700 font-medium">
                      ✓ Approved! Select this category when creating a new class.
                    </p>
                  </div>
                )}

                {/* Re-tag pending — Accept / Decline */}
                {req.status === "retag_pending" && req.retag_cat && (
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 space-y-2">
                    <p className="text-xs font-semibold text-blue-800">
                      Admin suggests using an existing category instead:
                    </p>
                    <div className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 border border-blue-100">
                      {RetagIcon && (
                        <RetagIcon size={16} className="text-provider shrink-0" />
                      )}
                      <div>
                        <p className="text-xs font-semibold">
                          {req.retag_cat.name}
                        </p>
                        {req.admin_notes && (
                          <p className="text-[10px] text-muted-foreground">
                            {req.admin_notes}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50"
                        disabled={isResponding}
                        onClick={() => handleRespond(req.id, false)}
                      >
                        {isResponding ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <X size={12} />
                        )}
                        Decline
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
                        disabled={isResponding}
                        onClick={() => handleRespond(req.id, true)}
                      >
                        {isResponding ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <Check size={12} />
                        )}
                        Accept
                      </Button>
                    </div>
                  </div>
                )}

                {/* Re-tag declined */}
                {req.status === "retag_declined" && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                    <p className="text-xs text-slate-600">
                      You declined the admin's suggestion. Submit a new request
                      with a clearer name if you still need this category.
                    </p>
                  </div>
                )}

                {/* Date */}
                <p className="text-[10px] text-muted-foreground">
                  Submitted{" "}
                  {new Date(req.requested_at).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </Card>
            );
          })
        )}
      </div>

      {/* Category request sheet */}
      {providerProfile && (
        <CategoryRequestSheet
          open={showSheet}
          onOpenChange={setShowSheet}
          providerId={providerProfile.id}
          onSubmitted={() => {
            // List auto-refreshes via query invalidation; no further action needed
          }}
        />
      )}

      <BottomNav persona="provider" />
    </div>
  );
};

export default ProviderCategories;
