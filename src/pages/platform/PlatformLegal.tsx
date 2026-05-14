import * as React from "react";
import DOMPurify from "dompurify";
import mammoth from "mammoth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Loader2,
  ScrollText,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import {
  useActiveLegalDocument,
  useLegalVersionHistory,
  usePublishLegalDocument,
  uploadLegalDocFile,
  type LegalDocType,
} from "@/hooks/useLegalDocuments";

const SECTIONS: { type: LegalDocType; label: string; icon: typeof FileText }[] = [
  { type: "terms",   label: "Terms & Conditions", icon: ScrollText },
  { type: "privacy", label: "Privacy Policy",     icon: ShieldCheck },
];

const PlatformLegal = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Legal Documents</h1>
        <p className="text-sm text-muted-foreground">
          Upload new versions of the Terms &amp; Conditions and Privacy Policy.
          Files are immutable — old versions are preserved for audit.
        </p>
      </div>

      {SECTIONS.map((s) => (
        <LegalSection key={s.type} docType={s.type} label={s.label} Icon={s.icon} />
      ))}
    </div>
  );
};

export default PlatformLegal;

// ─────────────────────────────────────────────────────────────────────────────

type SectionProps = {
  docType: LegalDocType;
  label: string;
  Icon: typeof FileText;
};

const LegalSection: React.FC<SectionProps> = ({ docType, label, Icon }) => {
  const { data: active, isLoading } = useActiveLegalDocument(docType);
  const { data: history, isLoading: historyLoading } =
    useLegalVersionHistory(docType);
  const publish = usePublishLegalDocument();

  const [file, setFile] = React.useState<File | null>(null);
  const [title, setTitle] = React.useState("");
  const [html, setHtml] = React.useState<string>("");
  const [converting, setConverting] = React.useState(false);
  const [previewOpen, setPreviewOpen] = React.useState(false);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".docx")) {
      toast.error("Only .docx files are supported");
      e.target.value = "";
      return;
    }
    setFile(f);
    setTitle(f.name.replace(/\.docx$/i, ""));
    setConverting(true);
    setWarnings([]);
    setHtml("");
    try {
      const buf = await f.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer: buf });
      const sanitized = DOMPurify.sanitize(result.value, {
        USE_PROFILES: { html: true },
      });
      setHtml(sanitized);
      setWarnings(result.messages.map((m) => m.message));
    } catch (err) {
      console.error("[PlatformLegal] mammoth:", err);
      toast.error("Failed to read .docx — please try a different file");
      setFile(null);
    } finally {
      setConverting(false);
    }
  };

  const reset = () => {
    setFile(null);
    setTitle("");
    setHtml("");
    setWarnings([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handlePublish = async () => {
    if (!file || !html || !title.trim()) return;
    setSubmitting(true);
    try {
      // We don't know the version number until after the RPC; upload with a
      // placeholder timestamp so we still get a unique path. The RPC stores
      // the returned path; this is best-effort for audit, the rendered HTML
      // is the source of truth.
      let filePath: string | null = null;
      try {
        const nextVersion = (history?.[0]?.version ?? 0) + 1;
        filePath = await uploadLegalDocFile(docType, nextVersion, file);
      } catch (err) {
        console.warn("[PlatformLegal] file upload failed:", err);
        toast.warning(
          "Original file upload failed — publishing the rendered version only",
        );
      }

      await publish.mutateAsync({
        docType,
        title: title.trim(),
        html,
        filePath,
      });
      toast.success(`${label} published`);
      setPreviewOpen(false);
      reset();
    } catch (err) {
      console.error("[PlatformLegal] publish:", err);
      toast.error(
        err instanceof Error ? err.message : "Failed to publish version",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="p-5 space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Icon size={20} />
          </div>
          <div>
            <h2 className="text-base font-semibold">{label}</h2>
            <p className="text-xs text-muted-foreground">
              {isLoading
                ? "Loading current version…"
                : active
                  ? `Active version v${active.version} — ${active.title}`
                  : "No version published yet"}
            </p>
          </div>
        </div>
        {active && <Badge variant="outline">v{active.version}</Badge>}
      </div>

      {/* Upload */}
      <div className="space-y-3 rounded-xl border border-dashed border-border bg-muted/30 p-4">
        <div className="space-y-1.5">
          <Label htmlFor={`file-${docType}`} className="text-sm">
            Upload new .docx version
          </Label>
          <Input
            ref={fileInputRef}
            id={`file-${docType}`}
            type="file"
            accept=".docx"
            onChange={onFile}
            disabled={converting || submitting}
          />
          <p className="text-[11px] text-muted-foreground">
            Only .docx (Word 2007+) files are supported. Formatting is preserved
            on a best-effort basis.
          </p>
        </div>

        {converting && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 size={14} className="animate-spin" />
            Converting document…
          </div>
        )}

        {file && html && !converting && (
          <div className="space-y-2">
            <div className="space-y-1.5">
              <Label htmlFor={`title-${docType}`} className="text-sm">
                Title shown to users
              </Label>
              <Input
                id={`title-${docType}`}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={label}
                maxLength={120}
              />
            </div>

            {warnings.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle size={12} />
                  Conversion warnings ({warnings.length})
                </div>
                <ul className="ml-4 list-disc">
                  {warnings.slice(0, 4).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                  {warnings.length > 4 && (
                    <li>…and {warnings.length - 4} more</li>
                  )}
                </ul>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setPreviewOpen(true)}
              >
                Preview
              </Button>
              <Button
                size="sm"
                onClick={handlePublish}
                disabled={submitting || !title.trim()}
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                    Publishing…
                  </>
                ) : (
                  <>
                    <Upload size={14} className="mr-1.5" /> Publish as new version
                  </>
                )}
              </Button>
              <Button size="sm" variant="ghost" onClick={reset} disabled={submitting}>
                Discard
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* History */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Version history</h3>
        {historyLoading ? (
          <div className="flex h-16 items-center justify-center text-sm text-muted-foreground">
            <Loader2 size={14} className="mr-2 animate-spin" /> Loading history…
          </div>
        ) : !history || history.length === 0 ? (
          <p className="text-sm text-muted-foreground">No versions yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Version</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Uploaded</TableHead>
                  <TableHead>By</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-mono">v{row.version}</TableCell>
                    <TableCell className="max-w-[240px] truncate">
                      {row.title}
                    </TableCell>
                    <TableCell className="whitespace-nowrap">
                      {new Date(row.uploaded_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {row.uploader?.full_name ||
                        row.uploader?.email ||
                        "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.is_active ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                          <CheckCircle2 size={12} /> Active
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          Archived
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Preview — {title || label}</DialogTitle>
          </DialogHeader>
          <div
            className="prose prose-slate max-w-none text-sm max-h-[60vh] overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPreviewOpen(false)}>
              Close
            </Button>
            <Button onClick={handlePublish} disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 size={14} className="mr-1.5 animate-spin" />
                  Publishing…
                </>
              ) : (
                "Publish as new version"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};
