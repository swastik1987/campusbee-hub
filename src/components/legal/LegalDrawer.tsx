import * as React from "react";
import DOMPurify from "dompurify";
import { Loader2 } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useActiveLegalDocument, type LegalDocType } from "@/hooks/useLegalDocuments";

type Props = {
  docType: LegalDocType;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const TITLES: Record<LegalDocType, string> = {
  terms: "Terms & Conditions",
  privacy: "Privacy Policy",
};

const LegalDrawer = React.forwardRef<HTMLDivElement, Props>(
  ({ docType, open, onOpenChange }, ref) => {
    const { data, isLoading, isError, refetch } = useActiveLegalDocument(docType);

    const sanitized = React.useMemo(() => {
      if (!data?.html_content) return "";
      return DOMPurify.sanitize(data.html_content, {
        USE_PROFILES: { html: true },
      });
    }, [data?.html_content]);

    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          ref={ref}
          className="h-[88vh] flex flex-col rounded-t-2xl"
        >
          <DrawerHeader className="border-b border-border/50 text-left">
            <DrawerTitle className="text-lg font-bold">
              {data?.title || TITLES[docType]}
            </DrawerTitle>
            {data && (
              <p className="text-xs text-muted-foreground">
                Version {data.version} · Effective{" "}
                {new Date(data.uploaded_at).toLocaleDateString()}
              </p>
            )}
          </DrawerHeader>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {isLoading ? (
              <div className="flex h-40 items-center justify-center text-muted-foreground">
                <Loader2 size={18} className="mr-2 animate-spin" />
                Loading…
              </div>
            ) : isError ? (
              <div className="flex h-40 flex-col items-center justify-center gap-2 text-center">
                <p className="text-sm text-destructive">Failed to load document.</p>
                <button
                  onClick={() => refetch()}
                  className="text-xs font-medium text-primary underline"
                >
                  Retry
                </button>
              </div>
            ) : !data ? (
              <div className="flex h-40 items-center justify-center px-6 text-center text-sm text-muted-foreground">
                {TITLES[docType]} have not been published yet. Please check back
                soon.
              </div>
            ) : (
              <div
                className="prose prose-slate max-w-none text-sm leading-relaxed pb-8"
                dangerouslySetInnerHTML={{ __html: sanitized }}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    );
  },
);

LegalDrawer.displayName = "LegalDrawer";

export default LegalDrawer;
