import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  useChatConversations,
  useChatMessages,
  useSendMessage,
  useGetOrCreateConversation,
  useMarkConversationRead,
  useUnreadCountsByConversation,
} from "@/hooks/useEngagement";
import Header from "@/components/layout/Header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, GraduationCap, MessageCircle, Pencil, Send, Users } from "lucide-react";

const Chat = () => {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { profile, activePersona } = useUser();
  const userId = profile?.id;

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading: convsLoading } = useChatConversations(userId);
  const { data: messages } = useChatMessages(activeConversationId ?? undefined);
  const { data: unreadByConv } = useUnreadCountsByConversation(userId);
  const sendMessage = useSendMessage();
  const getOrCreate = useGetOrCreateConversation();
  const markRead = useMarkConversationRead();

  // Handle deep link ?with=userId
  useEffect(() => {
    const withUser = params.get("with");
    if (withUser && userId && withUser !== userId) {
      getOrCreate.mutateAsync({ userId, otherUserId: withUser }).then((convId) => {
        setActiveConversationId(convId);
      });
    }
  }, [params, userId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark conversation as read on open + whenever new unread messages arrive
  // while the thread is the active view.
  useEffect(() => {
    if (!activeConversationId || !userId) return;
    const hasUnread = (messages ?? []).some(
      (m) => m.sender_id !== userId && !m.is_read,
    );
    if (hasUnread) {
      markRead.mutate(activeConversationId);
    }
    // markRead is a stable mutation object; intentionally not in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, messages, userId]);

  const handleSend = async () => {
    if (!messageText.trim() || !activeConversationId || !userId) return;
    const text = messageText.trim();
    setMessageText("");
    try {
      await sendMessage.mutateAsync({
        conversationId: activeConversationId,
        senderId: userId,
        messageText: text,
      });
    } catch {
      setMessageText(text);
    }
  };

  const getOtherUser = (conv: any) => {
    if (!userId) return null;
    // v1 schema: participant_1 / participant_2 + user1 / user2
    if (conv.participant_1 !== undefined) {
      return conv.participant_1 === userId ? conv.user2 : conv.user1;
    }
    // v2 schema: participant_ids array
    return null;
  };

  const RoleBadge = ({ user }: { user: any }) => {
    if (user?.is_provider) {
      return (
        <Badge className="text-[9px] border-0 bg-indigo-100 text-indigo-700 gap-0.5 px-1.5 py-0">
          <GraduationCap size={9} /> Instructor
        </Badge>
      );
    }
    return (
      <Badge className="text-[9px] border-0 bg-primary/10 text-primary gap-0.5 px-1.5 py-0">
        <Users size={9} /> Learner
      </Badge>
    );
  };

  // Conversation detail view
  if (activeConversationId) {
    const activeConv = conversations?.find((c) => c.id === activeConversationId);
    const other = activeConv ? getOtherUser(activeConv) : null;

    return (
      <div className="seeker-theme flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-40 flex items-center gap-3 border-b border-border bg-card px-4 py-3">
          <button onClick={() => setActiveConversationId(null)} className="p-1">
            <ArrowLeft size={20} />
          </button>
          <Avatar className="h-9 w-9">
            <AvatarImage src={other?.avatar_url} />
            <AvatarFallback className="text-xs bg-muted">
              {other?.full_name?.[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold truncate">{other?.full_name ?? "Chat"}</h1>
              {other && <RoleBadge user={other} />}
            </div>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {messages?.map((msg) => {
            const isMine = msg.sender_id === userId;
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                    isMine ? "text-white rounded-br-sm" : "bg-muted rounded-bl-sm"
                  }`}
                  style={isMine ? { background: "linear-gradient(135deg, oklch(0.78 0.18 250), oklch(0.62 0.20 250))" } : undefined}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                  <p className={`text-[9px] mt-0.5 ${isMine ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                    {new Date(msg.created_at).toLocaleTimeString("en-IN", {
                      hour: "2-digit", minute: "2-digit",
                    })}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="sticky bottom-0 border-t border-border bg-card p-3">
          <div className="mx-auto max-w-lg flex gap-2">
            <Input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
              placeholder="Type a message..."
              className="h-10 rounded-full"
            />
            <Button
              onClick={handleSend}
              disabled={!messageText.trim() || sendMessage.isPending}
              className="h-10 w-10 rounded-full bg-primary p-0"
            >
              <Send size={16} />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Conversation list view
  return (
    <div className="seeker-theme flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Messages</h2>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-full transition-all active:scale-95"
            style={{ backgroundColor: "oklch(0.94 0.04 250)" }}
            onClick={() => navigate("/explore")}
            title="Find providers to message"
          >
            <Pencil size={15} style={{ color: "oklch(0.55 0.20 250)" }} />
          </button>
        </div>

        {convsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : conversations && conversations.length > 0 ? (
          <div className="space-y-1">
            {conversations.map((conv) => {
              const other = getOtherUser(conv);
              const unread = unreadByConv?.get(conv.id) ?? 0;
              return (
                <div
                  key={conv.id}
                  className={`flex items-center gap-3 rounded-xl p-3 cursor-pointer transition-colors active:bg-accent/80 ${
                    unread > 0 ? "bg-primary/[0.04] hover:bg-primary/[0.08]" : "hover:bg-accent"
                  }`}
                  onClick={() => setActiveConversationId(conv.id)}
                >
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={other?.avatar_url} />
                    <AvatarFallback className="bg-muted">
                      {other?.full_name?.[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className={`text-sm truncate ${unread > 0 ? "font-bold" : "font-semibold"}`}>
                            {other?.full_name}
                          </p>
                          {other && <RoleBadge user={other} />}
                        </div>
                      </div>
                      {conv.last_message_at && (
                        <span className={`text-[10px] flex-shrink-0 ml-2 ${unread > 0 ? "font-semibold text-primary" : "text-muted-foreground"}`}>
                          {new Date(conv.last_message_at).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short",
                          })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      {conv.last_message_preview ? (
                        <p className={`text-xs truncate ${unread > 0 ? "text-foreground/80 font-medium" : "text-muted-foreground"}`}>
                          {conv.last_message_preview}
                        </p>
                      ) : (
                        <span />
                      )}
                      {unread > 0 && (
                        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground flex-shrink-0">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <MessageCircle size={28} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No conversations yet</p>
            <p className="text-xs text-muted-foreground">
              Start a chat from a class or provider page
            </p>
          </div>
        )}
      </div>

    </div>
  );
};

export default Chat;
