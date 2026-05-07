import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/useNotifications";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  Calendar,
  CheckCheck,
  CreditCard,
  GraduationCap,
  Megaphone,
  MessageSquare,
  Star,
  UserCheck,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";

// Icon + colour config per notification type
const TYPE_CONFIG: Record<string, { icon: React.ReactNode; bg: string }> = {
  enrollment_approved: { icon: <UserCheck size={16} />, bg: "bg-green-100 text-green-600" },
  enrollment_rejected: { icon: <AlertTriangle size={16} />, bg: "bg-red-100 text-red-600" },
  payment_confirmed:   { icon: <CreditCard size={16} />, bg: "bg-green-100 text-green-600" },
  payment_disputed:    { icon: <CreditCard size={16} />, bg: "bg-red-100 text-red-600"   },
  payment_due:         { icon: <CreditCard size={16} />, bg: "bg-amber-100 text-amber-600" },
  payment_overdue:     { icon: <CreditCard size={16} />, bg: "bg-red-100 text-red-600"   },
  new_announcement:    { icon: <Megaphone size={16} />, bg: "bg-blue-100 text-blue-600"  },
  new_message:         { icon: <MessageSquare size={16} />, bg: "bg-indigo-100 text-indigo-600" },
  new_review:          { icon: <Star size={16} />, bg: "bg-amber-100 text-amber-600"     },
  class_reminder:      { icon: <Calendar size={16} />, bg: "bg-blue-100 text-blue-600"  },
  waitlist_offered:    { icon: <GraduationCap size={16} />, bg: "bg-green-100 text-green-600" },
  provider_approved:   { icon: <UserCheck size={16} />, bg: "bg-green-100 text-green-600" },
  provider_suspended:  { icon: <AlertTriangle size={16} />, bg: "bg-red-100 text-red-600" },
};

const ROUTE_MAP: Record<string, (id: string) => string> = {
  enrollment: (id) => `/enrollment/${id}`,
  payment:    (id) => `/enrollment/${id}`,
  class:      (id) => `/class/${id}`,
  announcement: () => `/home`,
  chat_conversation: () => `/chat`,
  review:     (id) => `/class/${id}`,
  provider_registration: () => `/provider/dashboard`,
};

// Category tab definitions (maps notification_type prefixes → tab id)
const CATEGORIES = [
  { id: "all",       label: "All"       },
  { id: "reminders", label: "Reminders" },
  { id: "messages",  label: "Messages"  },
  { id: "billing",   label: "Billing"   },
];

function matchesCategory(type: string, cat: string) {
  if (cat === "all") return true;
  if (cat === "reminders") return type === "class_reminder" || type === "enrollment_approved" || type === "enrollment_rejected" || type === "waitlist_offered";
  if (cat === "messages")  return type === "new_message" || type === "new_announcement";
  if (cat === "billing")   return type.startsWith("payment");
  return false;
}

function groupByDate(items: any[]) {
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  const groups: { label: string; items: any[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "This Week", items: [] },
    { label: "Earlier", items: [] },
  ];

  for (const item of items) {
    const d = new Date(item.created_at);
    if (d.toDateString() === today)     groups[0].items.push(item);
    else if (d.toDateString() === yesterday) groups[1].items.push(item);
    else if (d > weekAgo)              groups[2].items.push(item);
    else                               groups[3].items.push(item);
  }
  return groups.filter((g) => g.items.length > 0);
}

const Notifications = () => {
  const { profile, activePersona } = useUser();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("all");

  const { data: notifications, isLoading } = useNotifications(profile?.id);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleTap = async (notification: any) => {
    if (!notification.is_read) markRead.mutate(notification.id);
    const routeFn = notification.ref_type ? ROUTE_MAP[notification.ref_type] : undefined;
    if (routeFn && notification.ref_id) navigate(routeFn(notification.ref_id));
  };

  const handleMarkAllRead = () => {
    if (profile) markAllRead.mutate(profile.id);
  };

  const filtered = (notifications ?? []).filter((n: any) =>
    matchesCategory(n.notification_type ?? "", activeTab)
  );
  const groups = groupByDate(filtered);
  const hasUnread = notifications?.some((n: any) => !n.is_read);

  // Count per tab
  const tabCounts: Record<string, number> = { all: 0, reminders: 0, messages: 0, billing: 0 };
  for (const n of notifications ?? []) {
    if (n.is_read) continue;
    for (const cat of ["all", "reminders", "messages", "billing"]) {
      if (matchesCategory((n as any).notification_type ?? "", cat)) {
        tabCounts[cat] = (tabCounts[cat] ?? 0) + 1;
      }
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(-1)}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
            >
              <ArrowLeft size={20} />
            </button>
            <h1 className="text-base font-bold">Notifications</h1>
          </div>
          {hasUnread && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs gap-1 text-muted-foreground"
              onClick={handleMarkAllRead}
              disabled={markAllRead.isPending}
            >
              <CheckCheck size={14} /> Mark all read
            </Button>
          )}
        </div>

        {/* Category tabs */}
        <div className="flex border-b border-border overflow-x-auto scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveTab(cat.id)}
              className={`flex-shrink-0 flex items-center gap-1.5 px-4 pb-2.5 pt-1 text-xs font-semibold border-b-2 transition-colors -mb-px ${
                activeTab === cat.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground"
              }`}
            >
              {cat.label}
              {tabCounts[cat.id] > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                  activeTab === cat.id ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                }`}>
                  {tabCounts[cat.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-5">
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          groups.map((group) => (
            <div key={group.label} className="space-y-2">
              <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{group.label}</p>
              {group.items.map((notification: any) => {
                const cfg = TYPE_CONFIG[notification.notification_type ?? ""] ?? {
                  icon: <Bell size={16} />,
                  bg: "bg-muted text-muted-foreground",
                };
                return (
                  <button
                    key={notification.id}
                    onClick={() => handleTap(notification)}
                    className={`w-full flex gap-3 rounded-2xl border p-4 text-left transition-colors active:scale-[0.99] ${
                      notification.is_read
                        ? "border-border bg-card"
                        : "border-primary/20 bg-primary/5"
                    }`}
                  >
                    <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${cfg.bg}`}>
                      {cfg.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-tight ${!notification.is_read ? "font-semibold" : ""}`}>
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      {notification.body && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
                          {notification.body}
                        </p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1.5">
                        {new Date(notification.created_at).toLocaleString("en-IN", {
                          hour: "numeric", minute: "2-digit", hour12: true,
                        })}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Bell size={28} className="text-primary/40" />
            </div>
            <p className="text-sm font-semibold">All caught up!</p>
            <p className="text-xs text-muted-foreground max-w-[200px]">
              You'll see updates about your classes, payments, and messages here.
            </p>
          </div>
        )}
      </div>

      <BottomNav persona={activePersona === "provider" ? "provider" : "seeker"} />
    </div>
  );
};

export default Notifications;
