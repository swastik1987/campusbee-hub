import * as React from "react";
import LegalDrawer from "./LegalDrawer";
import type { LegalDocType } from "@/hooks/useLegalDocuments";

type Props = {
  /** Optional inline color for the link buttons (matches role theming on /auth). */
  linkColor?: string;
  /** Optional className on the wrapper paragraph. */
  className?: string;
};

const LegalLinks = React.forwardRef<HTMLDivElement, Props>(
  ({ linkColor, className }, ref) => {
    const [openType, setOpenType] = React.useState<LegalDocType | null>(null);

    const linkStyle: React.CSSProperties = {
      color: linkColor ?? "inherit",
      fontWeight: 600,
      cursor: "pointer",
      textDecoration: "underline",
      textUnderlineOffset: 2,
      background: "transparent",
      border: "none",
      padding: 0,
      font: "inherit",
    };

    return (
      <div ref={ref} className={className}>
        <p
          style={{
            fontSize: 11,
            textAlign: "center",
            lineHeight: 1.5,
            margin: 0,
            color: "inherit",
          }}
        >
          By continuing you agree to our{" "}
          <button
            type="button"
            onClick={() => setOpenType("terms")}
            style={linkStyle}
          >
            Terms &amp; Conditions
          </button>
          {" and "}
          <button
            type="button"
            onClick={() => setOpenType("privacy")}
            style={linkStyle}
          >
            Privacy Policy
          </button>
          .
        </p>

        <LegalDrawer
          docType="terms"
          open={openType === "terms"}
          onOpenChange={(v) => setOpenType(v ? "terms" : null)}
        />
        <LegalDrawer
          docType="privacy"
          open={openType === "privacy"}
          onOpenChange={(v) => setOpenType(v ? "privacy" : null)}
        />
      </div>
    );
  },
);

LegalLinks.displayName = "LegalLinks";

export default LegalLinks;
