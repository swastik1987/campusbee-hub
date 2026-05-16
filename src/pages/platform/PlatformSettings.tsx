import { useEffect, useRef, useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import {
  usePlatformSettings,
  useUpdatePlatformSetting,
  useAllSubscriptionPlans,
  useUpdateSubscriptionPlan,
  useAdminPlatformPaymentDetails,
  useUpdatePlatformPaymentDetails,
  useUploadPlatformQr,
} from "@/hooks/usePlatformAdmin";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  CreditCard,
  Crown,
  ImagePlus,
  Loader2,
  Save,
  Settings,
  Sliders,
  Trash2,
  Upload,
  Video,
} from "lucide-react";
import { toast } from "sonner";

const DEMO_KEY = "instructor_demo_video_url";

const PlatformSettings = () => {
  const { profile } = useUser();
  const fileRef = useRef<HTMLInputElement>(null);

  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("platform_settings")
      .select("value")
      .eq("key", DEMO_KEY)
      .maybeSingle()
      .then(({ data }) => {
        const v = data?.value;
        const url = v && typeof v === "string" ? v.trim() : null;
        setCurrentUrl(url);
        setUrlInput(url ?? "");
        setLoading(false);
      });
  }, []);

  const saveUrl = async (url: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("platform_settings")
        .upsert(
          {
            key: DEMO_KEY,
            value: url,
            updated_by: profile?.id ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );
      if (error) throw error;
      setCurrentUrl(url);
      setUrlInput(url);
      toast.success("Demo video URL saved");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "mp4";
      const path = `platform/instructor-demo-video.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("provider-media")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("provider-media").getPublicUrl(path);
      await saveUrl(data.publicUrl);
    } catch (e: any) {
      toast.error(e.message ?? "Upload failed — paste the URL manually below instead");
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("platform_settings")
        .delete()
        .eq("key", DEMO_KEY);
      if (error) throw error;
      setCurrentUrl(null);
      setUrlInput("");
      toast.success("Demo video removed");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to remove");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Settings size={20} />
          Platform Settings
        </h2>
        <p className="text-sm text-muted-foreground mt-0.5">
          Global configuration for CampusBee
        </p>
      </div>

      {/* Demo video section */}
      <Card className="p-5 space-y-5">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Video size={16} className="text-indigo-600" />
            Instructor Demo Video
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Shown on the public landing page as a "Watch demo" button on the instructor card.
            Upload an MP4/WebM file or paste a direct video URL.
          </p>
        </div>

        {/* Current video preview */}
        {currentUrl && (
          <div className="space-y-3">
            <Label className="text-xs text-muted-foreground">Current video</Label>
            <video
              src={currentUrl}
              controls
              className="w-full rounded-xl max-h-52 bg-black"
            />
            <p className="text-[10px] text-muted-foreground font-mono break-all">{currentUrl}</p>
          </div>
        )}

        {/* Upload area */}
        <div>
          <Label className="text-sm font-medium mb-2 block">Upload file</Label>
          <div
            className="border-2 border-dashed rounded-xl p-7 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
            onClick={() => !uploading && fileRef.current?.click()}
          >
            {uploading ? (
              <div className="flex flex-col items-center gap-2">
                <Loader2 size={22} className="animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Uploading…</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload size={22} className="text-muted-foreground" />
                <p className="text-sm font-medium">
                  {currentUrl ? "Click to replace video" : "Click to upload demo video"}
                </p>
                <p className="text-xs text-muted-foreground">MP4, WebM, MOV · max 500 MB</p>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="video/mp4,video/webm,video/quicktime,video/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
              e.target.value = "";
            }}
          />
        </div>

        {/* Manual URL input */}
        <div className="space-y-2">
          <Label className="text-sm font-medium">Or paste a direct video URL</Label>
          <p className="text-xs text-muted-foreground">
            Use this if the file upload fails (storage permissions) or you host the video externally.
          </p>
          <div className="flex gap-2">
            <Input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://…/demo.mp4"
              className="h-10 font-mono text-xs"
            />
            <Button
              size="sm"
              className="h-10 gap-1.5 shrink-0"
              onClick={() => urlInput.trim() && saveUrl(urlInput.trim())}
              disabled={saving || !urlInput.trim() || urlInput.trim() === currentUrl}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Save
            </Button>
          </div>
        </div>

        {/* Remove */}
        {currentUrl && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-red-600 border-red-300 hover:bg-red-50"
            onClick={handleRemove}
            disabled={saving}
          >
            <Trash2 size={14} />
            Remove demo video
          </Button>
        )}
      </Card>

      <SubscriptionPricingCard />
      <PaymentDetailsCard />
      <KeyValueEditor />
    </div>
  );
};

export default PlatformSettings;

// ────────────────────────────────────────────────────────────────────────────
// Subscription pricing — admin sets MRP + selling price for each billing
// period, and toggles availability. Instructors see only is_active=true rows
// on the upgrade sheet.
// ────────────────────────────────────────────────────────────────────────────

type PlanDraft = { mrp: string; price: string; isActive: boolean };

const SubscriptionPricingCard = () => {
  const { profile } = useUser();
  const { data: plans, isLoading } = useAllSubscriptionPlans();
  const updatePlan = useUpdateSubscriptionPlan();
  const [drafts, setDrafts] = useState<Record<string, PlanDraft>>({});

  useEffect(() => {
    if (!plans) return;
    const next: Record<string, PlanDraft> = {};
    plans.forEach((p) => {
      next[p.billing_period] = {
        mrp: String(p.mrp ?? 0),
        price: String(p.price ?? 0),
        isActive: p.is_active,
      };
    });
    setDrafts(next);
  }, [plans]);

  const handleSave = async (billingPeriod: "monthly" | "annual") => {
    const d = drafts[billingPeriod];
    if (!d) return;
    const mrp = Number(d.mrp);
    const price = Number(d.price);
    if (!Number.isFinite(mrp) || mrp < 0 || !Number.isFinite(price) || price < 0) {
      toast.error("Prices must be non-negative numbers");
      return;
    }
    if (price > mrp && mrp > 0) {
      toast.error("Selling price cannot exceed MRP");
      return;
    }
    try {
      await updatePlan.mutateAsync({
        billingPeriod,
        mrp,
        price,
        isActive: d.isActive,
        updatedBy: profile?.id,
      });
      toast.success(`${billingPeriod[0].toUpperCase() + billingPeriod.slice(1)} plan saved`);
    } catch (err) {
      const m = err instanceof Error ? err.message : "Failed to save";
      toast.error(m);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-5">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <Card className="space-y-5 p-5">
      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Crown size={16} className="text-amber-600" />
          Subscription Pricing
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Set the MRP and selling price for each billing period. The selling price is what
          the instructor actually pays. Toggle availability to publish a plan to the upgrade
          sheet.
        </p>
      </div>

      <div className="space-y-4">
        {(["monthly", "annual"] as const).map((bp) => {
          const d = drafts[bp];
          if (!d) return null;
          const mrp = Number(d.mrp) || 0;
          const price = Number(d.price) || 0;
          const discount = mrp > 0 && price < mrp ? Math.round(((mrp - price) / mrp) * 100) : 0;

          return (
            <div key={bp} className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold capitalize">{bp} plan</p>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Active</Label>
                  <Switch
                    checked={d.isActive}
                    onCheckedChange={(v) =>
                      setDrafts((p) => ({ ...p, [bp]: { ...p[bp], isActive: v } }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">MRP (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={d.mrp}
                    onChange={(e) =>
                      setDrafts((p) => ({ ...p, [bp]: { ...p[bp], mrp: e.target.value } }))
                    }
                    className="h-10"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Selling Price (₹)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={d.price}
                    onChange={(e) =>
                      setDrafts((p) => ({ ...p, [bp]: { ...p[bp], price: e.target.value } }))
                    }
                    className="h-10"
                  />
                </div>
              </div>

              {discount > 0 && (
                <p className="text-xs text-emerald-700">
                  Discount: ₹{(mrp - price).toLocaleString("en-IN")} off ({discount}%)
                </p>
              )}

              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => handleSave(bp)}
                disabled={updatePlan.isPending}
              >
                {updatePlan.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                Save {bp} plan
              </Button>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Payment details — UPI ID, QR (optional), bank account. Shown on the
// instructor's upgrade payment screen.
// ────────────────────────────────────────────────────────────────────────────

const PaymentDetailsCard = () => {
  const { profile } = useUser();
  const { data: details, isLoading } = useAdminPlatformPaymentDetails();
  const update = useUpdatePlatformPaymentDetails();
  const uploadQr = useUploadPlatformQr();
  const fileRef = useRef<HTMLInputElement>(null);

  const [upiId, setUpiId] = useState("");
  const [upiQrUrl, setUpiQrUrl] = useState<string | null>(null);
  const [bankAccount, setBankAccount] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!details) return;
    setUpiId(details.upi_id ?? "");
    setUpiQrUrl(details.upi_qr_url ?? null);
    setBankAccount(details.bank_account ?? "");
    setIfsc(details.ifsc ?? "");
    setBankName(details.bank_name ?? "");
    setAccountHolder(details.account_holder ?? "");
  }, [details]);

  const handleSave = async (opts?: { qrUrl?: string | null }) => {
    if (!details?.id) return;
    try {
      await update.mutateAsync({
        id: details.id,
        upiId: upiId.trim() || null,
        upiQrUrl: opts?.qrUrl !== undefined ? opts.qrUrl : undefined,
        bankAccount: bankAccount.trim() || null,
        ifsc: ifsc.trim() || null,
        bankName: bankName.trim() || null,
        accountHolder: accountHolder.trim() || null,
        updatedBy: profile?.id,
      });
      toast.success("Payment details saved");
    } catch (err) {
      const m = err instanceof Error ? err.message : "Failed to save";
      toast.error(m);
    }
  };

  const handleQrUpload = async (file: File) => {
    setUploading(true);
    try {
      const url = await uploadQr.mutateAsync({ file });
      setUpiQrUrl(url);
      await handleSave({ qrUrl: url });
    } catch (err) {
      const m = err instanceof Error ? err.message : "Upload failed";
      toast.error(m);
    } finally {
      setUploading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-5">
        <Loader2 size={20} className="animate-spin text-muted-foreground" />
      </Card>
    );
  }

  return (
    <Card className="space-y-5 p-5">
      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <CreditCard size={16} className="text-indigo-600" />
          Payment Details
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Shown to instructors when they pay for the Premium upgrade. UPI ID is required;
          QR image and bank details are optional but recommended.
        </p>
      </div>

      {/* UPI */}
      <div className="space-y-3 rounded-xl border p-4">
        <p className="text-sm font-semibold">UPI</p>
        <div className="space-y-1">
          <Label className="text-xs">UPI ID</Label>
          <Input
            value={upiId}
            onChange={(e) => setUpiId(e.target.value)}
            placeholder="campusbee@ybl"
            className="h-10 font-mono"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">UPI QR (optional)</Label>
          {upiQrUrl ? (
            <div className="flex items-center gap-3">
              <img
                src={upiQrUrl}
                alt="UPI QR"
                className="h-24 w-24 rounded-lg border bg-white object-contain"
              />
              <div className="flex flex-col gap-1.5">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  <ImagePlus size={13} className="mr-1" />
                  Replace
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-destructive border-destructive/30"
                  onClick={async () => {
                    setUpiQrUrl(null);
                    await handleSave({ qrUrl: null });
                  }}
                >
                  <Trash2 size={13} className="mr-1" />
                  Remove
                </Button>
              </div>
            </div>
          ) : (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              Upload QR
            </Button>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleQrUpload(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {/* Bank */}
      <div className="space-y-3 rounded-xl border p-4">
        <p className="text-sm font-semibold">Bank Transfer</p>
        <div className="space-y-1">
          <Label className="text-xs">Account Holder</Label>
          <Input
            value={accountHolder}
            onChange={(e) => setAccountHolder(e.target.value)}
            placeholder="CampusBee Pvt Ltd"
            className="h-10"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">A/C Number</Label>
            <Input
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value)}
              className="h-10 font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">IFSC</Label>
            <Input
              value={ifsc}
              onChange={(e) => setIfsc(e.target.value)}
              className="h-10 font-mono"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Bank Name</Label>
          <Input
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            placeholder="State Bank of India"
            className="h-10"
          />
        </div>
      </div>

      <Button
        onClick={() => handleSave()}
        disabled={update.isPending}
        className="gap-1.5"
      >
        {update.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Save payment details
      </Button>
    </Card>
  );
};

// ────────────────────────────────────────────────────────────────────────────
// Generic key-value JSON editor for non-special platform_settings rows.
// Hides the demo-video key (handled above).  Each row gets a textarea where
// the admin can edit the JSON value; Save validates JSON before writing.
// ────────────────────────────────────────────────────────────────────────────

const HIDDEN_KEYS = new Set([DEMO_KEY]);

const KeyValueEditor = () => {
  const { profile } = useUser();
  const { data, isLoading } = usePlatformSettings();
  const update = useUpdatePlatformSetting();

  return (
    <Card className="space-y-4 p-5">
      <div>
        <h3 className="flex items-center gap-2 text-base font-semibold">
          <Sliders size={16} className="text-indigo-600" />
          Platform configuration
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          JSONB key-value store.  Edit any value below — values are stored as
          JSON, so strings must be quoted (e.g. <code>"value"</code>), numbers
          unquoted (<code>5</code>), objects in <code>{`{}`}</code>, arrays in <code>[]</code>.
        </p>
      </div>

      {isLoading ? (
        <Loader2 className="animate-spin text-muted-foreground" size={20} />
      ) : (
        <ul className="space-y-4">
          {data
            ?.filter((row) => !HIDDEN_KEYS.has(row.key))
            .map((row) => (
              <SettingRow
                key={row.key}
                settingKey={row.key}
                description={row.description}
                value={row.value}
                onSave={(value) =>
                  update.mutateAsync({
                    key: row.key,
                    value,
                    updatedBy: profile?.id ?? "",
                  })
                }
                saving={update.isPending}
              />
            ))}
        </ul>
      )}
    </Card>
  );
};

const SettingRow = ({
  settingKey,
  description,
  value,
  onSave,
  saving,
}: {
  settingKey: string;
  description: string | null;
  value: unknown;
  onSave: (next: unknown) => Promise<void>;
  saving: boolean;
}) => {
  const initial = JSON.stringify(value, null, 2);
  const [draft, setDraft] = useState(initial);
  const [err, setErr] = useState<string | null>(null);

  // Reset draft when the upstream value changes after a save.
  useEffect(() => {
    setDraft(initial);
    setErr(null);
  }, [initial]);

  const dirty = draft !== initial;

  const save = async () => {
    try {
      const parsed = JSON.parse(draft);
      setErr(null);
      await onSave(parsed);
      toast.success(`Updated ${settingKey}`);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <li className="space-y-2 rounded-lg border p-3">
      <div>
        <p className="font-mono text-xs font-semibold">{settingKey}</p>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={Math.min(8, draft.split("\n").length + 1)}
        className="font-mono text-xs"
      />
      {err && <p className="text-xs text-red-600">Invalid JSON: {err}</p>}
      <div className="flex justify-end">
        <Button size="sm" disabled={!dirty || saving} onClick={save} className="gap-1.5">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          Save
        </Button>
      </div>
    </li>
  );
};
