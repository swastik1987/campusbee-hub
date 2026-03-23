import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "@/hooks/useNotifications";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  CheckCheck,
  CreditCard,
  GraduationCap,
  MessageSquare,
  Megaphone,
  Star,
  UserCheck,
  Calendar,
  AlertTriangle,
} from "lucide-react";

const ICON_MAP: Record<string, React.ReactNode> = {
  enrollment_approved: <UserCheck size={16} className="text-green-600" />,
  enrollment_rejected: <AlertTriangle size={16} className="text-red-600" />,
  payment_confirmed: <CreditCard size={16} className="text-green-600" />,
  payment_disputed: <CreditCard size={16} className="text-red-600" />,
  payment_due: <CreditCard size={16} className="text-amber-600" />,
  payment_overdue: <CreditCard size={16} className="text-red-600" />,
  new_announcement: <Megaphone size={16} className="text-blue-600" />,
  new_message: <MessageSquare size={16} className="text-indigo-600" />,
  new_review: <Star size={16} className="text-amber-500" />,
  class_reminder: <Calendar size={16} className="text-blue-600" />,
  waitlist_offered: <GraduationCap size={16} className="text-green-600" />,
  provider_approved: <UserCheck size={16} className="text-green-600" />,
  provider_suspended: <AlertTriangle size={16} className="text-red-600" />,
};

const ROUTE_MAP: Record<string, (id: string) => string> = {
  enrollment: (id) => `/enrollment/${id}`,
  payment: (id) => `/enrollment/${id}`,
  class: (id) => `/class/${id}`,
  announcement: () => `/home`,
  chat_conversation: () => `/chat`,
  review: (id) => `/class/${id}`,
  provider_registration: () => `/provider/dashboard`,
};

function groupByDate(items: { created_at: string }[]) {
  const now = new Date();
  const today = now.toDateString();
  const yesterday = new Date(now.getTime() - 86400000).toDateString();
  const weekAgo = new Date(now.getTime() - 7 * 86400000);

  const groups: { label: string; items: typeof items }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "This Week", items: [] },
    { label: "Earlier", items: [] },
  ];

  for (const item of items) {
    const d = new Date(item.created_at);
    if (d.toDateString() === today) groups[0].items.push(item);
    else if (d.toDateString() === yesterday) groups[1].items.push(item);
    else if (d > weekAgo) groups[2].items.push(item);
    else groups[3].items.push(item);
  }

  return groups.filter((g) => g.items.length > 0);
}

const Notifications = () => {
  const { profile, activePersona } = useUser();
  const navigate = useNavigate();

  const { data: notifications, isLoading } = useNotifications(profile?.id);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const handleTap = async (notification: NonNullable<typeof notifications>[number]) => {
    if (!notification.is_read) {
      markRead.mutate(notification.id);
    }
    // Navigate to reference
    const routeFn = notification.reference_type ? ROUTE_MAP[notification.reference_type] : undefined;
    if (routeFn && notification.reference_id) {
      navigate(routeFn(notification.reference_id));
    }
  };

  const handleMarkAllRead = () => {
    if (profile) markAllRead.mutate(profile.id);
  };

  const groups = notifications ? groupByDate(notifications) : [];
  const hasUnread = notifications?.some((n) => !n.is_read);

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header showPersonaSwitcher={false} />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Bell size={18} /> Notifications
          </h2>
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

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : notifications && notifications.length > 0 ? (
          groups.map((group) => (
            <div key={group.label} className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground pt-1">{group.label}</p>
              {group.items.map((notification: any) => (
                <Card
                  key={notification.id}
                  className={`p-3 cursor-pointer transition-colors ${
                    notification.is_read ? "bg-card" : "bg-primary/5 border-primary/20"
                  }`}
                  onClick={() => handleTap(notification)}
                >
                  <div className="flex gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                      {ICON_MAP[notification.notification_type] ?? <Bell size={16} className="text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={`text-sm leading-tight ${notification.is_read ? "" : "font-semibold"}`}>
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notification.body}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(notification.created_at).toLocaleString("en-IN", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })}
                      </p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ))
        ) : (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Bell size={24} className="text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No notifications yet</p>
            <p className="text-xs text-muted-foreground">You'll see updates about your classes, payments, and more here</p>
          </div>
        )}
      </div>

      <BottomNav persona={activePersona === "provider" ? "provider" : activePersona === "apartment_admin" ? "admin" : "seeker"} />
    </div>
  );
};

export default Notifications;
