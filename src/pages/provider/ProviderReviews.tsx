import { useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { useProviderRegistrations } from "@/hooks/useProvider";
import { useProviderReviews, useReplyToReview } from "@/hooks/useEngagement";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Loader2, MessageSquare, Star, StarOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const ProviderReviews = () => {
  const { providerProfile } = useUser();
  const { data: registrations } = useProviderRegistrations(providerProfile?.id);
  const regIds = registrations?.filter((r) => r.status === "approved").map((r) => r.id) ?? [];

  // Get class IDs for this provider
  const { data: classIds } = useQuery({
    queryKey: ["provider-class-ids", regIds],
    enabled: regIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("classes")
        .select("id")
        .in("provider_registration_id", regIds);
      return data?.map((c) => c.id) ?? [];
    },
  });

  const { data: reviews, isLoading } = useProviderReviews(classIds ?? []);
  const replyMutation = useReplyToReview();

  const [replySheet, setReplySheet] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");

  const handleReply = async () => {
    if (!replySheet || !replyText.trim()) return;
    try {
      await replyMutation.mutateAsync({ reviewId: replySheet, reply: replyText.trim() });
      toast.success("Reply posted");
      setReplySheet(null);
      setReplyText("");
    } catch {
      toast.error("Failed to post reply");
    }
  };

  const renderStars = (rating: number) =>
    Array.from({ length: 5 }, (_, i) =>
      i < rating ? (
        <Star key={i} size={12} className="fill-amber-400 text-amber-400" />
      ) : (
        <Star key={i} size={12} className="text-gray-300" />
      )
    );

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Star size={18} className="text-amber-500" /> Reviews
        </h2>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : reviews && reviews.length > 0 ? (
          <div className="space-y-3">
            {reviews.map((review) => {
              const reviewer = review.users as any;
              const className = (review.classes as any)?.title;

              return (
                <Card key={review.id} className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={reviewer?.avatar_url} />
                      <AvatarFallback className="text-[10px] bg-muted">
                        {reviewer?.full_name?.[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{reviewer?.full_name}</p>
                      <div className="flex items-center gap-1">{renderStars(review.rating)}</div>
                    </div>
                    {review.is_verified && (
                      <Badge variant="secondary" className="text-[10px]">Verified</Badge>
                    )}
                  </div>

                  {className && (
                    <p className="text-xs text-muted-foreground">on {className}</p>
                  )}

                  {review.review_text && (
                    <p className="text-sm text-foreground">{review.review_text}</p>
                  )}

                  <p className="text-[10px] text-muted-foreground">
                    {new Date(review.created_at).toLocaleDateString("en-IN", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>

                  {review.provider_reply ? (
                    <div className="ml-4 pl-3 border-l-2 border-indigo-200 mt-2">
                      <p className="text-xs font-medium text-indigo-700">Your reply</p>
                      <p className="text-xs text-foreground mt-0.5">{review.provider_reply}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {review.provider_replied_at &&
                          new Date(review.provider_replied_at).toLocaleDateString("en-IN", {
                            day: "numeric", month: "short",
                          })}
                      </p>
                    </div>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1 text-xs mt-1"
                      onClick={() => {
                        setReplySheet(review.id);
                        setReplyText("");
                      }}
                    >
                      <MessageSquare size={12} /> Reply
                    </Button>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <StarOff size={28} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No reviews yet</p>
            <p className="text-xs text-muted-foreground">Reviews from students will appear here</p>
          </div>
        )}
      </div>

      {/* Reply Sheet */}
      <Sheet open={!!replySheet} onOpenChange={() => setReplySheet(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader><SheetTitle>Reply to Review</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <Input
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write your response..."
              className="h-10 rounded-lg"
            />
            <Button
              onClick={handleReply}
              disabled={!replyText.trim() || replyMutation.isPending}
              className="w-full rounded-lg"
            >
              {replyMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : "Post Reply"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <BottomNav persona="provider" />
    </div>
  );
};

export default ProviderReviews;
