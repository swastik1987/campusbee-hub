import React from "react";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, XCircle, AlertCircle } from "lucide-react";
import type { ModerationStatus } from "@/hooks/useModeration";

interface ModerationStatusBadgeProps {
  status: ModerationStatus | string | null | undefined;
  /** Show the icon alongside the label. Default: true. */
  showIcon?: boolean;
  /** Badge size variant. Default: "sm". */
  size?: "sm" | "md";
}

const CONFIG: Record<string, {
  label: string;
  className: string;
  Icon: React.ElementType;
}> = {
  approved:  { label: "Approved",  className: "bg-green-100 text-green-700 border-0",  Icon: CheckCircle2 },
  in_review: { label: "In Review", className: "bg-amber-100 text-amber-700 border-0",  Icon: Clock        },
  rejected:  { label: "Rejected",  className: "bg-red-100 text-red-700 border-0",      Icon: XCircle      },
  pending:   { label: "Pending",   className: "bg-gray-100 text-gray-500 border-0",    Icon: AlertCircle  },
};

const ModerationStatusBadge = React.forwardRef<
  HTMLDivElement,
  ModerationStatusBadgeProps
>(({ status, showIcon = true, size = "sm" }, ref) => {
  const cfg = CONFIG[status ?? "pending"] ?? CONFIG.pending;
  const { label, className, Icon } = cfg;
  const iconSize = size === "sm" ? 10 : 12;
  const textClass = size === "sm" ? "text-[10px] px-1.5 py-0.5" : "text-xs px-2 py-1";

  return (
    <Badge
      ref={ref}
      className={`inline-flex items-center gap-1 ${className} ${textClass}`}
    >
      {showIcon && <Icon size={iconSize} />}
      {label}
    </Badge>
  );
});

ModerationStatusBadge.displayName = "ModerationStatusBadge";

export default ModerationStatusBadge;
