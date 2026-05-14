import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CheckCircle2, Clock, Loader2, MessageSquare, Sparkles } from "lucide-react";
import {
  useMySupportRequests,
  type SupportRequestRow,
} from "@/hooks/useSupportRequests";

type Props = {
  userId: string | undefined;
};

const SupportRequestList = React.forwardRef<HTMLDivElement, Props>(
  ({ userId }, ref) => {
    const { data, isLoading, isError, refetch } = useMySupportRequests(userId);

    if (isLoading) {
      return (
        <div ref={ref} className="flex items-center justify-center py-6 text-sm text-muted-foreground">
          <Loader2 size={14} className="mr-2 animate-spin" /> Loading…
        </div>
      );
    }
    if (isError) {
      return (
        <div ref={ref} className="space-y-2 py-4 text-center">
          <p className="text-sm text-destructive">Couldn't load your requests.</p>
          <button
            onClick={() => refetch()}
            className="text-xs font-medium text-primary underline"
          >
            Retry
          </button>
        </div>
      );
    }
    if (!data || data.length === 0) {
      return (
        <div ref={ref} className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-5 text-center">
          <p className="text-xs text-muted-foreground">
            You haven't raised any requests yet.
          </p>
        </div>
      );
    }

    return (
      <div ref={ref} className="space-y-2">
        {data.map((row) => (
          <SupportRequestItem key={row.id} row={row} />
        ))}
      </div>
    );
  },
);

SupportRequestList.displayName = "SupportRequestList";

export default SupportRequestList;

// ─────────────────────────────────────────────────────────────────────────────

const SupportRequestItem: React.FC<{ row: SupportRequestRow }> = ({ row }) => {
  const isResolved = row.status === "resolved";
  const isRec = row.type === "recommendation";

  return (
    <Card className="p-3 space-y-1.5">
      <div className="flex items-start gap-2">
        <div
          className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg ${
            isRec ? "bg-amber-500/10 text-amber-600" : "bg-primary/10 text-primary"
          }`}
        >
          {isRec ? <Sparkles size={13} /> : <MessageSquare size={13} />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-semibold">{row.subject}</p>
            <Badge
              variant={isResolved ? "outline" : "secondary"}
              className={`shrink-0 text-[10px] ${
                isResolved
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : ""
              }`}
            >
              {isResolved ? (
                <>
                  <CheckCircle2 size={10} className="mr-1" /> Resolved
                </>
              ) : (
                <>
                  <Clock size={10} className="mr-1" /> Open
                </>
              )}
            </Badge>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {row.body}
          </p>
          {row.attachments && row.attachments.length > 0 && (
            <p className="mt-1 text-[10px] text-muted-foreground">
              {row.attachments.length} attachment
              {row.attachments.length > 1 ? "s" : ""}
            </p>
          )}
        </div>
      </div>

      {isResolved && row.resolution_comment && (
        <div className="ml-9 rounded-md bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-900">
          <span className="font-semibold">Admin: </span>
          {row.resolution_comment}
        </div>
      )}

      <p className="ml-9 text-[10px] text-muted-foreground">
        Submitted {new Date(row.created_at).toLocaleString()}
        {isResolved && row.resolved_at && (
          <> · Resolved {new Date(row.resolved_at).toLocaleString()}</>
        )}
      </p>
    </Card>
  );
};
