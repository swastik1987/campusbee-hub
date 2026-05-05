import React, { useRef, useState } from "react";
import {
  useProviderCertifications,
  useTrainerCertifications,
  useAddCertification,
  useDeleteCertification,
  type Certification,
} from "@/hooks/useCertifications";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Award, Clock, ImagePlus, Loader2, ShieldCheck, ShieldX, Trash2, X } from "lucide-react";
import { toast } from "sonner";

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  Certification["moderation_status"],
  { label: string; className: string; icon: React.ReactNode }
> = {
  pending: {
    label: "Under Review",
    className: "bg-amber-50 text-amber-700 border-amber-200",
    icon: <Clock size={10} />,
  },
  in_review: {
    label: "In Review",
    className: "bg-blue-50 text-blue-700 border-blue-200",
    icon: <Clock size={10} />,
  },
  approved: {
    label: "Approved",
    className: "bg-green-50 text-green-700 border-green-200",
    icon: <ShieldCheck size={10} />,
  },
  rejected: {
    label: "Rejected",
    className: "bg-red-50 text-red-700 border-red-200",
    icon: <ShieldX size={10} />,
  },
};

const MAX_CERTS = 5;

// ── Props ──────────────────────────────────────────────────────────────────────

interface CertificationManagerProps {
  ownerType: "provider" | "trainer";
  providerId: string;
  trainerId?: string;
  /** Trainer display name — used in the section header */
  trainerName?: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

const CertificationManager = React.forwardRef<
  HTMLDivElement,
  CertificationManagerProps
>(({ ownerType, providerId, trainerId, trainerName }, ref) => {
  const ownerId = ownerType === "provider" ? providerId : (trainerId ?? "");

  const { data: providerCertsData, isLoading: providerLoading } = useProviderCertifications(
    ownerType === "provider" ? providerId : undefined
  );
  const { data: trainerCertsData, isLoading: trainerLoading } = useTrainerCertifications(
    ownerType === "trainer" ? trainerId : undefined
  );
  const certs = ownerType === "provider" ? providerCertsData : trainerCertsData;
  const isLoading = ownerType === "provider" ? providerLoading : trainerLoading;

  const addCert = useAddCertification();
  const deleteCert = useDeleteCertification();

  // Add sheet state
  const [addOpen, setAddOpen] = useState(false);
  const [certName, setCertName] = useState("");
  const [authority, setAuthority] = useState("");
  const [year, setYear] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Delete confirm state
  const [deleteTarget, setDeleteTarget] = useState<Certification | null>(null);

  const certList = certs ?? [];
  const atMax = certList.length >= MAX_CERTS;

  const resetAdd = () => {
    setCertName("");
    setAuthority("");
    setYear("");
    setPreviewUrl("");
    setSelectedFile(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be under 5 MB");
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleAdd = async () => {
    if (!certName.trim() || !selectedFile) return;
    try {
      await addCert.mutateAsync({
        ownerType,
        providerId: ownerType === "provider" ? providerId : undefined,
        trainerId: ownerType === "trainer" ? trainerId : undefined,
        name: certName,
        issuingAuthority: authority || undefined,
        yearObtained: year ? parseInt(year) : null,
        file: selectedFile,
      });
      toast.success("Certification submitted for review");
      setAddOpen(false);
      resetAdd();
    } catch (err: any) {
      toast.error(err?.message ?? "Upload failed");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteCert.mutateAsync({
        certId: deleteTarget.id,
        imageUrl: deleteTarget.image_url,
        ownerType,
        ownerId,
      });
      toast.success("Certification removed");
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to remove certification");
    }
  };

  const sectionLabel =
    ownerType === "trainer" && trainerName
      ? `${trainerName}'s Certifications`
      : "Certifications / Visual Resume";

  return (
    <div ref={ref} className="space-y-3">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-1.5">
          <Award size={16} className="text-provider" />
          {sectionLabel}
        </h3>
        {!atMax && (
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1 text-xs border-provider/40 text-provider"
            onClick={() => setAddOpen(true)}
          >
            <ImagePlus size={13} /> Add
          </Button>
        )}
      </div>

      {atMax && (
        <p className="text-[10px] text-muted-foreground">
          Maximum {MAX_CERTS} certifications reached.
        </p>
      )}

      {/* Cert list */}
      {isLoading ? (
        <div className="text-xs text-muted-foreground">Loading…</div>
      ) : certList.length === 0 ? (
        <div className="rounded-xl border border-dashed p-4 text-center">
          <Award size={20} className="mx-auto mb-1 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            No certifications yet. Add up to {MAX_CERTS}.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {certList.map((cert) => {
            const cfg = STATUS_CONFIG[cert.moderation_status];
            return (
              <Card key={cert.id} className="overflow-hidden relative group">
                <img
                  src={cert.image_url}
                  alt={cert.name}
                  className="h-28 w-full object-cover"
                />
                <div className="p-2 space-y-0.5">
                  <p className="text-xs font-semibold line-clamp-1">{cert.name}</p>
                  {cert.issuing_authority && (
                    <p className="text-[10px] text-muted-foreground line-clamp-1">
                      {cert.issuing_authority}
                    </p>
                  )}
                  {cert.year_obtained && (
                    <p className="text-[10px] text-muted-foreground">{cert.year_obtained}</p>
                  )}
                  <Badge
                    variant="outline"
                    className={`text-[9px] px-1.5 py-0 flex items-center gap-0.5 w-fit ${cfg.className}`}
                  >
                    {cfg.icon}
                    {cfg.label}
                  </Badge>
                  {cert.moderation_status === "rejected" && cert.moderation_notes && (
                    <p className="text-[9px] text-red-600 leading-tight mt-0.5">
                      {cert.moderation_notes}
                    </p>
                  )}
                </div>
                {/* Delete overlay */}
                <button
                  className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setDeleteTarget(cert)}
                >
                  <X size={12} />
                </button>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Sheet */}
      <Sheet open={addOpen} onOpenChange={(o) => { if (!o) { setAddOpen(false); resetAdd(); } }}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Add Certification</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            {/* Image picker */}
            <div className="space-y-1">
              <Label className="text-xs">Certificate Image *</Label>
              {previewUrl ? (
                <div className="relative w-full h-36">
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="h-36 w-full object-cover rounded-lg"
                  />
                  <button
                    className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                    onClick={() => { setPreviewUrl(""); setSelectedFile(null); }}
                  >
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-provider/50 hover:text-provider transition-colors"
                >
                  <ImagePlus size={24} />
                  <span className="text-xs">Tap to upload (max 5 MB)</span>
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>

            {/* Name */}
            <div className="space-y-1">
              <Label className="text-xs">Certification Name *</Label>
              <Input
                value={certName}
                onChange={(e) => setCertName(e.target.value)}
                placeholder="e.g., Certified Yoga Instructor"
                className="h-10 rounded-lg"
              />
            </div>

            {/* Authority + Year */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Issuing Authority</Label>
                <Input
                  value={authority}
                  onChange={(e) => setAuthority(e.target.value)}
                  placeholder="e.g., Yoga Alliance"
                  className="h-10 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Year Obtained</Label>
                <Input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  placeholder="e.g., 2022"
                  className="h-10 rounded-lg"
                  min={1980}
                  max={new Date().getFullYear()}
                />
              </div>
            </div>

            <p className="text-[10px] text-muted-foreground">
              Images are reviewed before being shown to seekers. This usually
              takes under 24 hours.
            </p>

            <Button
              onClick={handleAdd}
              disabled={!certName.trim() || !selectedFile || addCert.isPending}
              className="w-full rounded-lg"
            >
              {addCert.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "Submit for Review"
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 size={18} /> Remove Certification?
            </AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.name}" will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDelete}
              disabled={deleteCert.isPending}
            >
              {deleteCert.isPending ? <Loader2 size={14} className="animate-spin" /> : "Remove"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});

CertificationManager.displayName = "CertificationManager";

export default CertificationManager;
