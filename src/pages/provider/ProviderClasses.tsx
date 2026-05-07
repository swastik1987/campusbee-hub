import * as React from "react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { useProviderClasses, useUpdateClassStatus, useDeleteClass } from "@/hooks/useClasses";
import ModerationStatusBadge from "@/components/moderation/ModerationStatusBadge";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Archive, BookOpen, Link2, Loader2, Pause, Play, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";

const STATUS_FILTERS = ["all", "draft", "published", "paused", "archived"];
const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-600",
  published: "bg-green-100 text-green-700",
  paused: "bg-amber-100 text-amber-700",
  archived: "bg-gray-200 text-gray-500",
};
const STATUS_LABELS: Record<string, string> = {
  all: "All",
  draft: "Draft",
  published: "Published",
  paused: "Paused",
  archived: "Archived",
};

const ProviderClasses = React.forwardRef<HTMLDivElement, Record<string, never>>((_props, ref) => {
  const navigate = useNavigate();
  const { providerProfile } = useUser();
  const [statusFilter, setStatusFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const { data: classes, isLoading } = useProviderClasses(providerProfile?.id, statusFilter);
  const updateStatus = useUpdateClassStatus();
  const deleteClass = useDeleteClass();

  const handleCopyLink = (e: React.MouseEvent, classId: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/class/${classId}`;
    navigator.clipboard.writeText(url)
      .then(() => toast.success("Class link copied!"))
      .catch(() => toast.error("Failed to copy link"));
  };

  const handleStatusChange = async (
    e: React.MouseEvent,
    classId: string,
    status: string,
  ) => {
    e.stopPropagation();
    try {
      await updateStatus.mutateAsync({ classId, status });
      const label =
        status === "published" ? "Class published" :
        status === "paused"    ? "Class paused" :
                                  "Class archived";
      toast.success(label);
    } catch {
      toast.error("Failed to update status");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteClass.mutateAsync(deleteTarget);
      toast.success("Draft deleted");
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete class");
    }
  };

  return (
    <div ref={ref} className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        <h2 className="text-lg font-bold">My Classes</h2>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === f
                  ? "bg-provider text-white"
                  : "bg-muted text-muted-foreground hover:bg-accent"
              }`}
            >
              {STATUS_LABELS[f] ?? f}
            </button>
          ))}
        </div>

        {/* Class list */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : classes && classes.length > 0 ? (
          <div className="space-y-3">
            {classes.map((cls) => (
              <Card
                key={cls.id}
                className="flex gap-3 p-3 cursor-pointer transition-all hover:shadow-md active:scale-[0.99]"
                onClick={() => navigate(`/provider/classes/${cls.id}`)}
              >
                {cls.cover_image_url ? (
                  <img
                    src={cls.cover_image_url}
                    alt=""
                    className="h-20 w-20 rounded-lg object-cover flex-shrink-0"
                  />
                ) : (
                  <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-muted flex-shrink-0">
                    <BookOpen size={24} className="text-muted-foreground" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  {/* Title row — status badge + delete icon for drafts */}
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold truncate">{cls.title}</h3>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge className={`text-[10px] ${STATUS_COLORS[cls.status ?? "draft"]} border-0`}>
                        {STATUS_LABELS[cls.status ?? "draft"] ?? cls.status}
                      </Badge>
                      {cls.status === "draft" && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteTarget(cls.id); }}
                          className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-red-50 transition-colors"
                          title="Delete draft"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Category + address */}
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(cls.class_categories as any)?.name}
                    {(cls as any).address && ` · ${(cls as any).address.split(",")[0]}`}
                  </p>

                  {/* Moderation badge + rating */}
                  <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                    <ModerationStatusBadge
                      status={(cls as any).moderation_status}
                      showIcon={true}
                      size="sm"
                    />
                    {(cls.rating_count ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Star size={12} className="text-amber-500 fill-amber-500" />
                        {cls.total_rating}
                      </span>
                    )}
                  </div>

                  {/* Quick status actions for published / paused */}
                  {(cls.status === "published" || cls.status === "paused") && (
                    <div
                      className="mt-2 flex gap-1.5 flex-wrap"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {cls.status === "published" && (
                        <button
                          onClick={(e) => handleStatusChange(e, cls.id, "paused")}
                          disabled={updateStatus.isPending}
                          className="flex items-center gap-1 rounded-md bg-amber-50 border border-amber-200 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100 transition-colors disabled:opacity-50"
                        >
                          <Pause size={10} /> Pause
                        </button>
                      )}
                      {cls.status === "paused" && (
                        <button
                          onClick={(e) => handleStatusChange(e, cls.id, "published")}
                          disabled={updateStatus.isPending}
                          className="flex items-center gap-1 rounded-md bg-green-50 border border-green-200 px-2 py-0.5 text-[11px] font-medium text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                        >
                          <Play size={10} /> Publish
                        </button>
                      )}
                      <button
                        onClick={(e) => handleStatusChange(e, cls.id, "archived")}
                        disabled={updateStatus.isPending}
                        className="flex items-center gap-1 rounded-md bg-gray-100 border border-gray-200 px-2 py-0.5 text-[11px] font-medium text-gray-600 hover:bg-gray-200 transition-colors disabled:opacity-50"
                      >
                        <Archive size={10} /> Archive
                      </button>
                      {/* Copy shareable link */}
                      <button
                        onClick={(e) => handleCopyLink(e, cls.id)}
                        className="flex items-center gap-1 rounded-md bg-blue-50 border border-blue-200 px-2 py-0.5 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                        title="Copy shareable link"
                      >
                        <Link2 size={10} /> Copy Link
                      </button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
              <BookOpen size={28} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No classes yet</p>
            <Button
              onClick={() => navigate("/provider/classes/new")}
              className="bg-provider hover:bg-provider/90 text-white rounded-xl"
            >
              <Plus size={16} className="mr-1" />
              Add Your First Class
            </Button>
          </div>
        )}
      </div>

      {/* FAB */}
      {classes && classes.length > 0 && (
        <div className="fixed bottom-20 right-4 z-30">
          <Button
            onClick={() => navigate("/provider/classes/new")}
            className="h-12 w-12 rounded-full bg-provider hover:bg-provider/90 text-white shadow-lg"
          >
            <Plus size={24} />
          </Button>
        </div>
      )}

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the draft class and all its batches. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteClass.isPending}
            >
              {deleteClass.isPending ? <Loader2 size={14} className="animate-spin" /> : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <BottomNav persona="provider" />
    </div>
  );
});

ProviderClasses.displayName = "ProviderClasses";

export default ProviderClasses;
