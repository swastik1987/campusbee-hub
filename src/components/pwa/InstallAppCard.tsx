import * as React from "react";
import { Share, SquarePlus, Smartphone, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

/**
 * "Install the app" entry point. On Chromium (Android) it fires the native
 * install prompt; on iOS Safari (which has no install API) it opens a sheet
 * with Share → Add to Home Screen instructions. Renders nothing when already
 * installed or when the browser offers neither path.
 */
const InstallAppCard = React.forwardRef<HTMLDivElement>((_props, ref) => {
  const { canPrompt, showIosInstructions, promptInstall } = useInstallPrompt();
  const [iosSheetOpen, setIosSheetOpen] = React.useState(false);

  if (!canPrompt && !showIosInstructions) return null;

  return (
    <>
      <Card
        ref={ref}
        role="button"
        tabIndex={0}
        onClick={() => (canPrompt ? promptInstall() : setIosSheetOpen(true))}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (canPrompt) promptInstall();
            else setIosSheetOpen(true);
          }
        }}
        className="flex cursor-pointer items-center gap-3 p-4 transition-colors hover:bg-accent/50"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <Smartphone size={20} className="text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Install the CampusBee app</p>
          <p className="text-xs text-muted-foreground">
            Faster access from your home screen — no app store needed
          </p>
        </div>
        <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
      </Card>

      {/* iOS: no install prompt exists; walk the user through it */}
      <Sheet open={iosSheetOpen} onOpenChange={setIosSheetOpen}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl"
          style={{ paddingBottom: "max(32px, env(safe-area-inset-bottom, 32px))" }}
        >
          <SheetHeader className="mb-4">
            <SheetTitle>Add CampusBee to your Home Screen</SheetTitle>
          </SheetHeader>
          <ol className="space-y-4">
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">1</span>
              <p className="text-sm">
                Tap the <Share size={15} className="mx-0.5 inline text-primary" aria-label="Share" />{" "}
                <span className="font-semibold">Share</span> button in Safari's toolbar
              </p>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">2</span>
              <p className="text-sm">
                Scroll down and tap{" "}
                <SquarePlus size={15} className="mx-0.5 inline text-primary" aria-label="Add" />{" "}
                <span className="font-semibold">Add to Home Screen</span>
              </p>
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">3</span>
              <p className="text-sm">
                Tap <span className="font-semibold">Add</span> — CampusBee will open like a regular app
              </p>
            </li>
          </ol>
        </SheetContent>
      </Sheet>
    </>
  );
});

InstallAppCard.displayName = "InstallAppCard";

export default InstallAppCard;
