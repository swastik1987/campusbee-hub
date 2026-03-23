import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

const ErrorState = ({
  message = "Something went wrong",
  onRetry,
}: ErrorStateProps) => (
  <div className="flex flex-col items-center gap-3 py-12 text-center">
    <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
      <AlertTriangle size={24} className="text-destructive" />
    </div>
    <p className="text-sm font-medium text-foreground">{message}</p>
    <p className="text-xs text-muted-foreground">Please try again</p>
    {onRetry && (
      <Button size="sm" variant="outline" onClick={onRetry} className="mt-1">
        Retry
      </Button>
    )}
  </div>
);

export default ErrorState;
