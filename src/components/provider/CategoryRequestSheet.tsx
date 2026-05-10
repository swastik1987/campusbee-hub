/**
 * CategoryRequestSheet
 *
 * Bottom-sheet form for providers to request a new category or sub-category.
 *
 * Flow:
 * 1. Pick request type  — "Sub-category under existing" OR "New top-level category"
 * 2. (Sub-category only) Pick parent from existing categories (shown with real icon)
 * 3. Enter name + optional description
 * 4. Click "Check for Existing Matches" — client-side fuzzy match against all
 *    categories; shows matches with their actual Lucide icons.
 *    Provider can either "Use this" (calls onSelectExisting) or dismiss and proceed.
 * 5. (Optional) Pick icon from scrollable icon grid
 * 6. Submit
 */

import * as React from "react";
import { useSubmitCategoryRequest } from "@/hooks/useCategoryRequests";
import { useCategories } from "@/hooks/useClasses";
import IconPicker, { ICON_MAP } from "@/components/provider/IconPicker";
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
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  Search,
} from "lucide-react";
import { toast } from "sonner";

// ── Fuzzy duplicate check ─────────────────────────────────────────────────────

type Category = { id: string; name: string; icon: string | null; parent_id: string | null };

function findSimilarCategories(name: string, categories: Category[]): Category[] {
  const lower = name.toLowerCase().trim();
  if (lower.length < 3) return [];
  const tokens = lower.split(/\s+/).filter((t) => t.length >= 3);
  return categories.filter((cat) => {
    const catLower = cat.name.toLowerCase();
    if (catLower.includes(lower) || lower.includes(catLower)) return true;
    return tokens.some((t) => catLower.includes(t));
  });
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface CategoryRequestSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  providerId: string;
  /** Called with the new request ID + name after a successful submit */
  onSubmitted?: (requestId: string, categoryName: string) => void;
  /**
   * Optional: if provided, "Use this" buttons appear next to duplicate matches,
   * letting the user pick an existing category instead of submitting a new request.
   */
  onSelectExisting?: (categoryId: string) => void;
}

// ── Component ─────────────────────────────────────────────────────────────────

const CategoryRequestSheet = React.forwardRef<
  HTMLDivElement,
  CategoryRequestSheetProps
>(({ open, onOpenChange, providerId, onSubmitted, onSelectExisting }, ref) => {
  const { data: categories } = useCategories();
  const submitRequest = useSubmitCategoryRequest();

  // Form state
  const [requestType, setRequestType] = React.useState<
    "new_subcategory" | "new_category"
  >("new_subcategory");
  const [parentId, setParentId] = React.useState("none");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [icon, setIcon] = React.useState("");
  const [showIconPicker, setShowIconPicker] = React.useState(false);

  // Duplicate-check state
  const [checked, setChecked] = React.useState(false);
  const [similarCats, setSimilarCats] = React.useState<Category[]>([]);
  const [similarDismissed, setSimilarDismissed] = React.useState(false);

  const parentCategories = (categories ?? []).filter((c) => !c.parent_id);

  const reset = () => {
    setRequestType("new_subcategory");
    setParentId("none");
    setName("");
    setDescription("");
    setIcon("");
    setShowIconPicker(false);
    setChecked(false);
    setSimilarCats([]);
    setSimilarDismissed(false);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const handleNameChange = (v: string) => {
    setName(v);
    setChecked(false);
    setSimilarCats([]);
    setSimilarDismissed(false);
  };

  const handleCheckDuplicates = () => {
    const matches = findSimilarCategories(name, categories ?? []);
    setSimilarCats(matches);
    setChecked(true);
    setSimilarDismissed(false);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    if (requestType === "new_subcategory" && parentId === "none") {
      toast.error("Please select a parent category");
      return;
    }
    try {
      const result = await submitRequest.mutateAsync({
        providerId,
        requestType,
        name: name.trim(),
        description: description.trim() || undefined,
        icon: icon.trim() || undefined,
        parentCategoryId:
          requestType === "new_subcategory" && parentId !== "none"
            ? parentId
            : null,
      });
      toast.success("Request submitted — we'll review it shortly!");
      onSubmitted?.(result.id, name.trim());
      handleClose();
    } catch {
      toast.error("Failed to submit request. Please try again.");
    }
  };

  const canSubmit =
    name.trim().length > 0 &&
    (requestType === "new_category" || parentId !== "none");

  // Block submit while unresolved duplicates are shown
  const hasUnresolvedDuplicates = checked && similarCats.length > 0 && !similarDismissed;

  const SelectedIcon = icon ? ICON_MAP[icon] : null;

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl flex flex-col"
        style={{
          maxHeight: "92dvh",
          paddingBottom: "env(safe-area-inset-bottom, 16px)",
        }}
        ref={ref}
      >
        <SheetHeader className="shrink-0 border-b border-border pb-3">
          <SheetTitle>Request New Category</SheetTitle>
          <p className="text-left text-xs text-muted-foreground">
            Submit a category or sub-category request. Our team will review and
            approve it before it becomes available for class creation.
          </p>
        </SheetHeader>

        <div className="flex-1 min-h-0 overflow-y-auto py-4 space-y-5">

          {/* ── Request type ──────────────────────────────── */}
          <div className="space-y-2">
            <Label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              What are you requesting?
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  {
                    value: "new_subcategory" as const,
                    label: "Add Sub-category",
                    sub: "Under an existing category",
                  },
                  {
                    value: "new_category" as const,
                    label: "New Category",
                    sub: "Brand new top-level category",
                  },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    setRequestType(opt.value);
                    setParentId("none");
                    setChecked(false);
                    setSimilarCats([]);
                    setSimilarDismissed(false);
                  }}
                  className={`text-left p-3 rounded-xl border text-sm transition-all ${
                    requestType === opt.value
                      ? "border-provider bg-provider/5 text-provider"
                      : "border-border text-muted-foreground hover:border-muted-foreground/40"
                  }`}
                >
                  <p className="font-semibold text-xs">{opt.label}</p>
                  <p className="text-[10px] mt-0.5 opacity-70">{opt.sub}</p>
                </button>
              ))}
            </div>
          </div>

          {/* ── Parent category (sub-category only) ───────── */}
          {requestType === "new_subcategory" && (
            <div className="space-y-1.5">
              <Label className="text-xs">
                Parent Category <span className="text-red-500">*</span>
              </Label>
              <Select value={parentId} onValueChange={setParentId}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Select existing category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Select existing category</SelectItem>
                  {parentCategories.map((p) => {
                    const PIcon = p.icon ? ICON_MAP[p.icon] : null;
                    return (
                      <SelectItem key={p.id} value={p.id}>
                        <span className="flex items-center gap-2">
                          {PIcon && <PIcon size={14} />}
                          {p.name}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ── Name ──────────────────────────────────────── */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              {requestType === "new_subcategory"
                ? "Sub-category Name"
                : "Category Name"}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder={
                requestType === "new_subcategory"
                  ? "e.g., Classical Dance, Abacus, Robotics"
                  : "e.g., Martial Arts, Performing Arts"
              }
              className="h-11 rounded-xl"
            />
          </div>

          {/* ── Duplicate check ───────────────────────────── */}
          {name.trim().length >= 3 && (
            <div className="space-y-2">
              {!checked ? (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10 rounded-xl gap-2 text-sm border-amber-300 text-amber-700 hover:bg-amber-50"
                  onClick={handleCheckDuplicates}
                >
                  <Search size={14} /> Check for Existing Matches
                </Button>
              ) : similarCats.length === 0 || similarDismissed ? (
                <div className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-3 py-2">
                  <CheckCircle2 size={14} className="text-green-600 shrink-0" />
                  <span className="text-xs font-medium text-green-700">
                    {similarCats.length === 0
                      ? "No duplicates found — looks good!"
                      : "Proceeding with new request"}
                  </span>
                </div>
              ) : (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle size={13} className="text-amber-600 shrink-0" />
                    <p className="text-xs font-semibold text-amber-800">
                      {similarCats.length} similar{" "}
                      {similarCats.length === 1 ? "category" : "categories"} found
                    </p>
                  </div>
                  <p className="text-[11px] text-amber-700">
                    Consider using an existing option before creating a new one:
                  </p>
                  <div className="space-y-1.5">
                    {similarCats.map((cat) => {
                      const CatIcon = cat.icon ? ICON_MAP[cat.icon] : null;
                      return (
                        <div
                          key={cat.id}
                          className="flex items-center justify-between gap-2 bg-white rounded-lg px-3 py-2 border border-amber-100"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {CatIcon ? (
                              <CatIcon size={16} className="text-provider shrink-0" />
                            ) : (
                              <div className="w-4 h-4 rounded-full bg-provider/20 shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-xs font-semibold truncate">
                                {cat.name}
                              </p>
                              <p className="text-[10px] text-muted-foreground">
                                {cat.parent_id ? "Sub-category" : "Top-level category"}
                              </p>
                            </div>
                          </div>
                          {onSelectExisting && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-[11px] shrink-0"
                              onClick={() => {
                                onSelectExisting(cat.id);
                                handleClose();
                              }}
                            >
                              Use this
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="w-full text-xs text-amber-700 hover:bg-amber-100"
                    onClick={() => setSimilarDismissed(true)}
                  >
                    None of these match — proceed with my request
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ── Icon picker (collapsible) ──────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">
                Icon{" "}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <button
                type="button"
                onClick={() => setShowIconPicker((v) => !v)}
                className="flex items-center gap-1 text-xs text-provider hover:underline"
              >
                {SelectedIcon && (
                  <SelectedIcon size={13} className="text-provider" />
                )}
                {icon || "Choose icon"}
                {showIconPicker ? (
                  <ChevronUp size={11} />
                ) : (
                  <ChevronDown size={11} />
                )}
              </button>
            </div>
            {showIconPicker && (
              <IconPicker value={icon} onChange={setIcon} />
            )}
          </div>

          {/* ── Description ───────────────────────────────── */}
          <div className="space-y-1.5">
            <Label className="text-xs">
              Why is this needed?{" "}
              <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Briefly describe what this category covers and why it's needed…"
              className="rounded-xl text-sm resize-none"
              rows={3}
            />
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-border pt-3 space-y-2">
          {name.trim().length >= 3 && !checked && (
            <p className="text-[11px] text-amber-600 text-center">
              Tip: check for existing matches before submitting to avoid duplicates.
            </p>
          )}
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit || hasUnresolvedDuplicates || submitRequest.isPending}
            className="w-full h-11 rounded-xl bg-provider hover:bg-provider/90 text-white font-semibold"
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
