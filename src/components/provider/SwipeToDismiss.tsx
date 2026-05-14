import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SwipeToDismissProps {
  onDismiss: () => void;
  /** Px the user must drag past for the card to commit to dismissal. */
  threshold?: number;
  /** When true, drag handlers + the X button are disabled. */
  locked?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Card wrapper that supports left/right swipe-to-dismiss (pointer events)
 * and renders an X button when not locked. Animates out on commit, then
 * fires onDismiss. Pure CSS — no framer-motion dependency.
 */
const SwipeToDismiss = React.forwardRef<HTMLDivElement, SwipeToDismissProps>(
  ({ onDismiss, threshold = 80, locked = false, className, children }, ref) => {
    const cardRef = React.useRef<HTMLDivElement | null>(null);
    const startXRef = React.useRef<number | null>(null);
    const startTimeRef = React.useRef<number>(0);
    const [drag, setDrag] = React.useState(0);
    const [animatingOut, setAnimatingOut] = React.useState<null | "left" | "right">(null);

    const commit = (direction: "left" | "right") => {
      setAnimatingOut(direction);
      // Wait for transform transition to finish before unmounting
      window.setTimeout(onDismiss, 220);
    };

    const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (locked) return;
      // Only primary button
      if (e.button !== 0 && e.pointerType === "mouse") return;
      startXRef.current = e.clientX;
      startTimeRef.current = Date.now();
      cardRef.current?.setPointerCapture(e.pointerId);
    };

    const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (locked || startXRef.current === null) return;
      setDrag(e.clientX - startXRef.current);
    };

    const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      if (locked || startXRef.current === null) return;
      const dx = e.clientX - startXRef.current;
      const dt = Date.now() - startTimeRef.current;
      cardRef.current?.releasePointerCapture(e.pointerId);
      startXRef.current = null;

      const velocity = Math.abs(dx) / Math.max(dt, 1); // px/ms
      const shouldDismiss = Math.abs(dx) > threshold || velocity > 0.6;

      if (shouldDismiss) {
        commit(dx < 0 ? "left" : "right");
      } else {
        setDrag(0);
      }
    };

    const onPointerCancel = () => {
      startXRef.current = null;
      setDrag(0);
    };

    const translate = animatingOut
      ? animatingOut === "left"
        ? "-120%"
        : "120%"
      : `${drag}px`;
    const opacity = animatingOut
      ? 0
      : Math.max(1 - Math.abs(drag) / 240, 0.3);
    const rotate = animatingOut ? 0 : drag * 0.03;

    return (
      <div className="relative" ref={ref}>
        {/* Behind-card dismiss hint */}
        {!locked && Math.abs(drag) > 16 && (
          <div
            className={cn(
              "absolute inset-0 flex items-center rounded-xl px-4 text-xs font-semibold text-muted-foreground",
              drag < 0 ? "justify-end" : "justify-start",
            )}
          >
            <span className="rounded-full bg-muted px-2 py-0.5">Dismiss</span>
          </div>
        )}

        <div
          ref={cardRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          style={{
            transform: `translateX(${translate}) rotate(${rotate}deg)`,
            opacity,
            transition:
              startXRef.current === null
                ? "transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 220ms"
                : "none",
            touchAction: locked ? undefined : "pan-y",
          }}
          className={cn("relative", !locked && "cursor-grab active:cursor-grabbing", className)}
        >
          {children}
          {!locked && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                commit("right");
              }}
              className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Dismiss"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>
    );
  },
);

SwipeToDismiss.displayName = "SwipeToDismiss";

export default SwipeToDismiss;
