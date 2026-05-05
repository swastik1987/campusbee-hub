import React, { useState, useEffect } from "react";
import { useSubmitCategoryRequest } from "@/hooks/useCategoryRequests";
import { useCategories } from "@/hooks/useClasses";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

// ── Icon auto-suggestion ───────────────────────────────────────────────────────

const ICON_KEYWORDS: Record<string, string> = {
  music: "Music",
  vocal: "Mic",
  sing: "Mic",
  dance: "Music2",
  fitness: "Dumbbell",
  gym: "Dumbbell",
  yoga: "Activity",
  swim: "Waves",
  art: "Palette",
  paint: "Palette",
  draw: "PenTool",
  sketch: "PenTool",
  code: "Code",
  program: "Code2",
  language: "Languages",
  english: "Languages",
  hindi: "Languages",
  math: "Calculator",
  science: "FlaskConical",
  chess: "Grid3x3",
  cricket: "CircleDot",
  football: "CircleDot",
  soccer: "CircleDot",
  sport: "Trophy",
  tennis: "CircleDot",
  basket: "CircleDot",
  cook: "ChefHat",
  bake: "Cake",
  craft: "Scissors",
  photo: "Camera",
  theater: "Drama",
  drama: "Drama",
  karate: "Shield",
  martial: "Shield",
  taekwondo: "Shield",
  gymnastic: "Activity",
  meditat: "Brain",
  read: "BookOpen",
  writ: "PenLine",
  robot: "Bot",
  stem: "FlaskConical",
  tutor: "GraduationCap",
  academ: "GraduationCap",
};

function suggestIcon(name: string): string {
  const lower = name.toLowerCase();
  for (const [keyword, icon] of Object.entries(ICON_KEYWORDS)) {
    if (lower.includes(keyword)) return icon;
  }
  return "";
}

// ── Props ──────────────────────────────────────────────────────────────────────

interface CategoryRequestSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  /** Called with the new request ID after successful submit */
  onSubmitted?: (requestId: string, categoryName: string) => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

const CategoryRequestSheet = React.forwardRef<
  HTMLDivElement,
  CategoryRequestSheetProps
>(({ open, onOpenChange, providerId, onSubmitted }, ref) => {
  const { data: categories } = useCategories();
  const submitRequest = useSubmitCategoryRequest();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("");
  const [parentId, setParentId] = useState<string>("none");
  const [iconSuggested, setIconSuggested] = useState(false);

  const parentCategories = (categories ?? []).filter((c) => !c.parent_id);

  // Auto-suggest icon when name changes
  useEffect(() => {
    if (!name.trim()) return;
    const suggested = suggestIcon(name);
    if (suggested && !iconSuggested) {
      setIcon(suggested);
    }
  }, [name, iconSuggested]);

  const reset = () => {
    setName("");
    setDescription("");
    setIcon("");
    setParentId("none");
    setIconSuggested(false);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    try {
      const result = await submitRequest.mutateAsync({
        providerId,
        name: name.trim(),
        description: description.trim() || undefined,
        icon: icon.trim() || undefined,
        parentCategoryId: parentId !== "none" ? parentId : null,
      });
      toast.success("Category request submitted — we'll review it shortly!");
      onSubmitted?.(result.id, name.trim());
      handleClose();
    } catch {
      toast.error("Failed to submit category request");
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent side="bottom" className="rounded-t-2xl" ref={ref}>
        <SheetHeader>
          <SheetTitle>Request a New Category</SheetTitle>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <p className="text-xs text-muted-foreground">
            Suggest a category that fits your class. Our team will review and
            approve it — once approved, your class will be automatically
            published.
          </p>

          {/* Name */}
          <div className="space-y-1">
            <Label className="text-xs">Category Name *</Label>
            <Input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setIconSuggested(false); // allow re-suggestion on new input
              }}
              placeholder="e.g., Abacus, Pottery, Robotics"
              className="h-10 rounded-lg"
            />
          </div>

          {/* Parent */}
          <div className="space-y-1">
            <Label className="text-xs">Sub-category of (optional)</Label>
            <Select value={parentId} onValueChange={setParentId}>
              <SelectTrigger className="h-10 rounded-lg">
                <SelectValue placeholder="None — top-level category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None — top-level category</SelectItem>
                {parentCategories.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Icon */}
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              Icon name
              {icon && (
                <span className="text-[10px] text-amber-600 flex items-center gap-0.5">
                  <Sparkles size={10} /> auto-suggested
                </span>
              )}
            </Label>
            <Input
              value={icon}
              onChange={(e) => {
                setIcon(e.target.value);
                setIconSuggested(true);
              }}
              placeholder="e.g., Music, Dumbbell, Palette"
              className="h-10 rounded-lg font-mono text-sm"
            />
            <p className="text-[10px] text-muted-foreground">
              Lucide icon name — leave blank and we'll pick one.
            </p>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label className="text-xs">Why is this category needed? (optional)</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this category covers…"
              className="rounded-lg text-sm resize-none"
              rows={3}
            />
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || submitRequest.isPending}
            className="w-full rounded-lg"
          >
            {submitRequest.isPending ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              "Submit Request"
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
});

CategoryRequestSheet.displayName = "CategoryRequestSheet";

export default CategoryRequestSheet;
