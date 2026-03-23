import { useState } from "react";
import { useParams } from "react-router-dom";
import { useUser } from "@/contexts/UserContext";
import {
  useClassMaterials,
  useCreateClassMaterial,
  useDeleteClassMaterial,
  useUploadMaterialFile,
} from "@/hooks/useClassMaterials";
import Header from "@/components/layout/Header";
import BottomNav from "@/components/BottomNav";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Film,
  Image,
  Link as LinkIcon,
  Loader2,
  NotebookPen,
  Plus,
  Trash2,
  FolderOpen,
} from "lucide-react";
import { toast } from "sonner";

const TYPE_ICONS: Record<string, React.ReactNode> = {
  document: <FileText size={16} className="text-blue-600" />,
  video: <Film size={16} className="text-red-600" />,
  image: <Image size={16} className="text-green-600" />,
  link: <LinkIcon size={16} className="text-indigo-600" />,
  note: <NotebookPen size={16} className="text-amber-600" />,
};

const ProviderMaterials = () => {
  const { classId } = useParams<{ classId: string }>();
  const { profile } = useUser();

  const { data: materials, isLoading } = useClassMaterials(classId);
  const createMaterial = useCreateClassMaterial();
  const deleteMaterial = useDeleteClassMaterial();
  const uploadFile = useUploadMaterialFile();

  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [materialType, setMaterialType] = useState("document");
  const [externalUrl, setExternalUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setMaterialType("document");
    setExternalUrl("");
    setSelectedFile(null);
    setShowAdd(false);
  };

  const handleSubmit = async () => {
    if (!classId || !profile || !title.trim()) return;

    try {
      let fileUrl: string | undefined;

      if (selectedFile && (materialType === "document" || materialType === "image")) {
        fileUrl = await uploadFile.mutateAsync({ file: selectedFile, classId });
      }

      await createMaterial.mutateAsync({
        classId,
        uploadedBy: profile.id,
        title: title.trim(),
        description: description.trim(),
        materialType,
        fileUrl,
        externalUrl: materialType === "link" || materialType === "video" ? externalUrl.trim() : undefined,
      });

      toast.success("Material added");
      resetForm();
    } catch {
      toast.error("Failed to add material");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMaterial.mutateAsync(id);
      toast.success("Material removed");
    } catch {
      toast.error("Failed to remove");
    }
  };

  const isSubmitting = createMaterial.isPending || uploadFile.isPending;

  return (
    <div className="flex min-h-screen flex-col bg-background pb-20">
      <Header />

      <div className="mx-auto w-full max-w-lg px-4 py-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Class Materials</h2>
          <Button size="sm" className="gap-1 text-xs" onClick={() => setShowAdd(true)}>
            <Plus size={14} /> Add
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : materials && materials.length > 0 ? (
          <div className="space-y-2">
            {materials.map((m) => (
              <Card key={m.id} className="p-3 flex items-start gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted">
                  {TYPE_ICONS[m.material_type] ?? <FileText size={16} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{m.title}</p>
                  {m.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1">{m.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="secondary" className="text-[10px]">{m.material_type}</Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(m.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                </div>
                <div className="flex gap-1">
                  {(m.file_url || m.external_url) && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => window.open(m.file_url || m.external_url!, "_blank")}
                    >
                      <LinkIcon size={14} />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    onClick={() => handleDelete(m.id)}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-12 text-center">
            <FolderOpen size={28} className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">No materials shared yet</p>
            <p className="text-xs text-muted-foreground">Add documents, videos, links, or notes for your students</p>
          </div>
        )}
      </div>

      {/* Add Material Sheet */}
      <Sheet open={showAdd} onOpenChange={setShowAdd}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
          <SheetHeader><SheetTitle>Add Material</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Practice Schedule"
                className="h-10 rounded-lg"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Description (optional)</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Brief description"
                className="h-10 rounded-lg"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={materialType} onValueChange={setMaterialType}>
                <SelectTrigger className="h-10 rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="document">Document</SelectItem>
                  <SelectItem value="video">Video (URL)</SelectItem>
                  <SelectItem value="image">Image</SelectItem>
                  <SelectItem value="link">Link</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(materialType === "document" || materialType === "image") && (
              <div className="space-y-1">
                <Label className="text-xs">Upload File</Label>
                <Input
                  type="file"
                  accept={materialType === "image" ? "image/*" : undefined}
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                  className="h-10 rounded-lg"
                />
              </div>
            )}

            {(materialType === "video" || materialType === "link") && (
              <div className="space-y-1">
                <Label className="text-xs">URL</Label>
                <Input
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://..."
                  className="h-10 rounded-lg"
                />
              </div>
            )}

            {materialType === "note" && (
              <div className="space-y-1">
                <Label className="text-xs">Note Content</Label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Write your note..."
                  className="w-full rounded-lg border border-input px-3 py-2 text-sm min-h-[100px]"
                />
              </div>
            )}

            <Button
              onClick={handleSubmit}
              disabled={!title.trim() || isSubmitting}
              className="w-full rounded-lg"
            >
              {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : "Add Material"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <BottomNav persona="provider" />
    </div>
  );
};

export default ProviderMaterials;
