import React from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import { Button } from "@/components/ui/button";
import { Crown } from "lucide-react";

interface PremiumGateProps {
  children: React.ReactNode;
  /** Custom fallback — if omitted, renders a blurred-preview + upgrade CTA overlay */
  fallback?: React.ReactNode;
  /** Feature name shown in the default CTA overlay */
  featureName?: string;
  /** Description shown under the feature name */
  featureDescription?: string;
}

const PremiumGate = React.forwardRef<HTMLDivElement, PremiumGateProps>(
  ({ children, fallback, featureName, featureDescription }, ref) => {
    const { isPremium } = useUser();
    const navigate = useNavigate();

    if (isPremium) {
      return <>{children}</>;
    }

    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div ref={ref} className="relative overflow-hidden rounded-xl">
        {/* Blurred preview */}
        <div className="pointer-events-none select-none blur-[3px] opacity-50 saturate-50">
          {children}
        </div>

        {/* Overlay CTA */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-background/70 backdrop-blur-[2px] px-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <Crown size={22} className="text-amber-600" />
          </div>
          <div className="text-center">
            <p className="text-sm font-semibold">
              {featureName ? `${featureName}` : "Premium Feature"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {featureDescription ?? "Upgrade your plan to unlock this feature"}
            </p>
          </div>
          <Button
            size="sm"
            className="gap-1.5 bg-amber-500 hover:bg-amber-600 text-white"
            onClick={() => navigate("/provider/subscription")}
          >
            <Crown size={14} />
            Upgrade to Premium
          </Button>
        </div>
      </div>
    );
  }
);

PremiumGate.displayName = "PremiumGate";

export default PremiumGate;
