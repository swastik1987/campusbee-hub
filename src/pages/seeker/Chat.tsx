import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  useChatConversations,
  useChatMessages,
  useSendMessage,
  useGetOrCreateConversation,
} from "@/hooks/useEngagement";
import BottomNav from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, GraduationCap, MessageCircle, Send, Users } from "lucide-react";

const QUICK_REPLIES = [
  "Is trial available?",
  "What's the batch timing?",
  "How many kids per batch?",
  "What's the fee structure?",
];

const Chat = () => {
  const [params] = useSearchParams();
  const { profile, activePersona } = useUser();
  const userId = profile?.id;

  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: conversations, isLoading: convsLoading } = useChatConversations(userId);
  const { data: messages } = useChatMessages(activeConversationId ?? undefined);
  const sendMessage = useSendMessage();
  const getOrCreate = useGetOrCreateConversation();

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

  const handleSend = async (text?: string) => {
    const msg = (text ?? messageText).trim();
    if (!msg || !activeConversationId || !userId) return;
    setMessageText("");
    try {
      await sendMessage.mutateAsync({
        conversationId: activeConversationId,
        senderId: userId,
        messageText: msg,
      });
    } catch {
      if (!text) setMessageText(msg);
    }
  };

  const getOtherUser = (conv: any) => {
    if (!userId) return null;
    if (conv.participant_1 !== undefined) {
      return conv.participant_1 === userId ? conv.user2 : conv.user1;
    }
    return null;
  };

  const RoleBadge = ({ user }: { user: any }) =>
    user?.is_provider ? (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-indigo-100 px-1.5 py-0 text-[9px] font-bold text-indigo-700">
        <GraduationCap size={8} /> Provider
      </span>
    ) : (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0 text-[9px] font-bold text-primary">
        <Users size={8} /> Seeker
      </span>
    );

  // ── Conversation detail view ─────────────────────────────────────────────────
  if (activeConversationId) {
    const activeConv = conversations?.find((c) => c.id === activeConversationId);
    const other = activeConv ? getOtherUser(activeConv) : null;
    const hasMessages = (messages?.length ?? 0) > 0;

    return (
      <div className="flex min-h-screen flex-col bg-background">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-border bg-card">
          <div className="mx-auto flex h-14 max-w-lg items-center gap-3 px-4">
            <button
              onClick={() => setActiveConversationId(null)}
              className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-accent"
            >
              <ArrowLeft size={20} />
            </button>
            <Avatar className="h-9 w-9">
              <AvatarImage src={other?.avatar_url} />
              <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                {other?.full_name?.[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold truncate">{other?.full_name ?? "Chat"}</p>
                {other && <RoleBadge user={other} />}
              </div>
            </div>
          </div>
        </header>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2 pb-36">
          {!hasMessages && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageCircle size={24} className="text-primary/50" />
              </div>
              <p className="text-sm font-semibold">Start the conversation</p>
              <p className="text-xs text-muted-foreground">Ask about timing, fees, or book a trial!</p>
            </div>
          )}
          {messages?.map((msg) => {
            const isMine = msg.sender_id === userId;
            return (
              <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 ${
                    isMine
                      ? "gradient-primary text-white rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.body}</p>
                  <p className={`text-[9px] mt-0.5 ${isMine ? "text-white/60" : "text-muted-foreground"}`}>
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

        {/* Quick replies (only when no messages yet) */}
        {!hasMessages && (
          <div className="fixed bottom-[72px] left-0 right-0 z-20 px-4 pb-2">
            <div className="mx-auto max-w-lg flex gap-2 overflow-x-auto scrollbar-hide">
              {QUICK_REPLIES.map((qr) => (
                <button
                  key={qr}
                  onClick={() => handleSend(qr)}
                  className="flex-shrink-0 rounded-full border border-primary/40 bg-card px-3 py-1.5 text-xs font-medium text-primary"
                >
                  {qr}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input bar */}
        <div className="fixed bottom-0 left-0 right-0 z-20 border-t border-border bg-card px-4 py-3">
          <div className="mx-auto max-w-lg flex gap-2">
            <Input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), handleSend())}
              placeholder="Type a message…"
              className="h-11 rounded-full bg-muted border-0 focus-visible:ring-1"
            />
            <Button
              onClick={() => handleSend()}
              disabled={!messageText.trim() || sendMessage.isPending}
              className="h-11 w-11 rounded-full gradient-primary p-0 flex-shrink-0"
            >
              <Send size={16} className="text-white" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Conversation list view ───────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          <h1 className="text-base font-bold">Messages</h1>
        </div>
      </header>

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-3">
        {convsLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : conversations && conversations.length > 0 ? (
          <div className="space-y-1">
            {conversations.map((conv, idx) => {
              const other = getOtherUser(conv);
              const isUnread = false; // Could wire unread count here
              return (
                <button
                  key={conv.id}
                  onClick={() => setActiveConversationId(conv.id)}
                  className="w-full flex items-center gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-accent active:bg-accent/80"
                >
                  <div className="relative flex-shrink-0">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={other?.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {other?.full_name?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    {isUnread && (
                      <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-primary border-2 border-card" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="text-sm font-semibold truncate">{other?.full_name ?? "Chat"}</p>
                        {other && <RoleBadge user={other} />}
                      </div>
                      {conv.last_message_at && (
                        <span className="text-[10px] text-muted-foreground flex-shrink-0">
                          {new Date(conv.last_message_at).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short",
                          })}
                        </span>
                      )}
                    </div>
                    {conv.last_message_preview ? (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.last_message_preview}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground italic mt-0.5">Start a conversation</p>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-16 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <MessageCircle size={28} className="text-primary/50" />
            </div>
            <p className="text-sm font-semibold">No messages yet</p>
            <p className="text-xs text-muted-foreground max-w-[200px]">
              Start a conversation from a class or provider page
            </p>
          </div>
        )}
      </div>

      <BottomNav persona={activePersona === "provider" ? "provider" : "seeker"} />
    </div>
  );
};

export default Chat;
