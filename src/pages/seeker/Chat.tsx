import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  useChatConversations,
  useChatMessages,
  useSendMessage,
  useGetOrCreateConversation,
} from "@/hooks/useEngagement";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, GraduationCap, Home, MessageCircle, Send } from "lucide-react";

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
    return conv.participant_1 === userId ? conv.user2 : conv.user1;
  };

  const getFlatInfo = (user: any): string | null => {
    const fam = user?.families;
    if (!fam) return null;
    const f = Array.isArray(fam) ? fam[0] : fam;
    if (!f) return null;
    const parts: string[] = [];
    if (f.flat_number) parts.push(`Flat ${f.flat_number}`);
    if (f.block_tower) parts.push(f.block_tower);
    return parts.length > 0 ? parts.join(", ") : null;
  };

  const RoleBadge = ({ user }: { user: any }) => {
    if (user?.is_provider) {
      return (
        <Badge className="text-[9px] border-0 bg-indigo-100 text-indigo-700 gap-0.5 px-1.5 py-0">
          <GraduationCap size={9} /> Provider
        </Badge>
      );
    }
    return (
      <Badge className="text-[9px] border-0 bg-primary/10 text-primary gap-0.5 px-1.5 py-0">
        <Home size={9} /> Resident
      </Badge>
    );
  };

  // Conversation detail view
  if (activeConversationId) {
    const activeConv = conversations?.find((c) => c.id === activeConversationId);
    const other = activeConv ? getOtherUser(activeConv) : null;
    const otherFlat = getFlatInfo(other);

    return (
      <div className="flex min-h-screen flex-col bg-background">
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
            {otherFlat && (
              <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                <Home size={9} />
                {otherFlat}
              </p>
            )}
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
                    isMine
                      ? "bg-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted rounded-bl-sm"
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap break-words">{msg.message_text}</p>
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
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        <h2 className="text-lg font-bold">Messages</h2>

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
              const flatInfo = getFlatInfo(other);
              return (
                <div
                  key={conv.id}
                  className="flex items-center gap-3 rounded-xl p-3 cursor-pointer transition-colors hover:bg-accent active:bg-accent/80"
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
                          <p className="text-sm font-semibold truncate">{other?.full_name}</p>
                          {other && <RoleBadge user={other} />}
                        </div>
                        {flatInfo && (
                          <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                            <Home size={9} />
                            {flatInfo}
                          </p>
                        )}
                      </div>
                      {conv.last_message_at && (
                        <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                          {new Date(conv.last_message_at).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short",
                          })}
                        </span>
                      )}
                    </div>
                    {conv.last_message_preview && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.last_message_preview}</p>
                    )}
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

      <BottomNav persona={activePersona === "provider" ? "provider" : "seeker"} />
    </div>
  );
};

export default Chat;
