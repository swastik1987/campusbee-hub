import * as React from "react";
import {
  Card,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import {
  getSupportAttachmentUrl,
  useAllSupportRequests,
  useResolveSupportRequest,
  type SupportRequestRow,
  type SupportStatus,
  type SupportType,
} from "@/hooks/useSupportRequests";

const PlatformSupport = () => {
  const [statusFilter, setStatusFilter] = React.useState<SupportStatus | "all">("open");
  const [typeFilter,   setTypeFilter]   = React.useState<SupportType   | "all">("all");
  const [selected, setSelected] = React.useState<SupportRequestRow | null>(null);

  const { data, isLoading, isError, refetch } = useAllSupportRequests({
    status: statusFilter,
    type:   typeFilter,
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Support &amp; Recommendations</h1>
        <p className="text-sm text-muted-foreground">
          User-submitted support tickets and product recommendations.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as SupportStatus | "all")}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="open">Open</SelectItem>
              <SelectItem value="resolved">Resolved</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Type</Label>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as SupportType | "all")}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="support">Support requests</SelectItem>
              <SelectItem value="recommendation">Recommendations</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          <Loader2 size={14} className="mr-2 animate-spin" /> Loading…
        </div>
      ) : isError ? (
        <div className="flex h-32 flex-col items-center justify-center gap-2">
          <p className="text-sm text-destructive">Failed to load requests.</p>
          <Button size="sm" variant="outline" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      ) : !data || data.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No requests match the current filters.
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Type</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead className="hidden md:table-cell">From</TableHead>
                <TableHead className="hidden md:table-cell">Submitted</TableHead>
                <TableHead className="text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(row)}
                >
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {row.type === "recommendation" ? (
                        <Sparkles size={10} className="mr-1" />
                      ) : (
                        <MessageSquare size={10} className="mr-1" />
                      )}
                      {row.type === "recommendation" ? "Idea" : "Support"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[260px] truncate font-medium">
                    {row.subject}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground">
                    {row.user?.full_name || row.user?.email || "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(row.created_at).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    {row.status === "resolved" ? (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 size={11} /> Resolved
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700">
                        <Clock size={11} /> Open
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Detail / resolve sheet */}
      <SupportDetailSheet
        request={selected}
        onClose={() => setSelected(null)}
      />
    </div>
  );
};

export default PlatformSupport;

// ─────────────────────────────────────────────────────────────────────────────

type DetailProps = {
  request: SupportRequestRow | null;
  onClose: () => void;
};

const SupportDetailSheet: React.FC<DetailProps> = ({ request, onClose }) => {
  const resolve = useResolveSupportRequest();
  const [comment, setComment] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    setComment("");
  }, [request?.id]);

  if (!request) return null;
  const isResolved = request.status === "resolved";

  const handleResolve = async () => {
    setSubmitting(true);
    try {
      await resolve.mutateAsync({
        requestId: request.id,
        comment: comment.trim() || undefined,
      });
      toast.success("Marked as resolved");
      onClose();
    } catch (err) {
      console.error("[support] resolve:", err);
      toast.error(err instanceof Error ? err.message : "Failed to resolve");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={!!request} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col"
      >
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <SheetTitle className="text-left">{request.subject}</SheetTitle>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">
              {request.type === "recommendation" ? "Recommendation" : "Support"}
            </Badge>
            {isResolved ? (
              <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                <CheckCircle2 size={11} /> Resolved
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-semibold text-amber-700">
                <Clock size={11} /> Open
              </span>
            )}
            <span>·</span>
            <span>
              {request.user?.full_name ||
                request.user?.email ||
                request.user_id.slice(0, 8)}
            </span>
            <span>·</span>
            <span>{new Date(request.created_at).toLocaleString()}</span>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Details
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed">{request.body}</p>
          </div>

          {request.attachments && request.attachments.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                Attachments ({request.attachments.length})
              </p>
              <div className="space-y-2">
                {request.attachments.map((att) => (
                  <AttachmentRow key={att.id} attachment={att} />
                ))}
              </div>
            </div>
          )}

          {isResolved ? (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
                Resolution
              </p>
              {request.resolution_comment ? (
                <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                  {request.resolution_comment}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">No comment.</p>
              )}
              {request.resolved_at && (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Resolved {new Date(request.resolved_at).toLocaleString()}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="sr-comment" className="text-sm">
                Resolution comment{" "}
                <span className="text-[10px] text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="sr-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder="Optional note shown to the user when they're notified."
                className="resize-none rounded-xl"
              />
              <p className="text-right text-[10px] text-muted-foreground">
                {comment.length}/1000
              </p>
            </div>
          )}
        </div>

        {!isResolved && (
          <SheetFooter className="border-t px-5 py-3">
            <Button
              className="w-full"
              onClick={handleResolve}
              disabled={submitting}
            >
              {submitting ? (
                <>
                  <Loader2 size={14} className="mr-1.5 animate-spin" />
                  Marking resolved…
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} className="mr-1.5" /> Mark resolved
                </>
              )}
            </Button>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
};

const AttachmentRow: React.FC<{
  attachment: {
    id: string;
    file_path: string;
    file_name: string;
    mime_type: string;
    size_bytes: number;
  };
}> = ({ attachment }) => {
  const [url, setUrl] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    setLoading(true);
    getSupportAttachmentUrl(attachment.file_path).then((u) => {
      if (!mounted) return;
      setUrl(u);
      setLoading(false);
    });
    return () => {
      mounted = false;
    };
  }, [attachment.file_path]);

  const isImage = attachment.mime_type.startsWith("image/");

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2">
      {isImage ? (
        url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="block h-14 w-14 overflow-hidden rounded-md border bg-background"
          >
            <img
              src={url}
              alt={attachment.file_name}
              className="h-full w-full object-cover"
            />
          </a>
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-md bg-muted">
            <ImageIcon size={16} className="text-muted-foreground" />
          </div>
        )
      ) : (
        <div className="flex h-14 w-14 items-center justify-center rounded-md bg-muted">
          <FileText size={18} className="text-muted-foreground" />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{attachment.file_name}</p>
        <p className="text-[11px] text-muted-foreground">
          {(attachment.size_bytes / 1024).toFixed(1)} KB · {attachment.mime_type}
        </p>
      </div>
      {url && !loading && (
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-8 items-center gap-1 rounded-md border px-2 text-xs font-medium hover:bg-accent"
        >
          <Download size={12} /> Open
        </a>
      )}
    </div>
  );
};
