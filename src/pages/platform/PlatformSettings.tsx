import { useEffect, useRef, useState } from "react";
import { useUser } from "@/contexts/UserContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Settings, Trash2, Upload, Video } from "lucide-react";
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
    </div>
  );
};

export default PlatformSettings;
