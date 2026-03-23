import { useState } from "react";
import {
  usePlatformCategories,
  useCreateCategory,
  useUpdateCategory,
} from "@/hooks/usePlatformAdmin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
  ChevronRight,
  Edit2,
  FolderTree,
  Loader2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import ErrorState from "@/components/shared/ErrorState";

const PlatformCategories = () => {
  const { data: categories, isLoading, isError, refetch } = usePlatformCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [iconName, setIconName] = useState("");
  const [parentId, setParentId] = useState<string>("none");
  const [displayOrder, setDisplayOrder] = useState("0");

  const parentCategories = (categories ?? []).filter((c) => !c.parent_category_id);
  const getChildren = (parentId: string) =>
    (categories ?? []).filter((c) => c.parent_category_id === parentId);

  const resetForm = () => {
    setName("");
    setSlug("");
    setIconName("");
    setParentId("none");
    setDisplayOrder("0");
    setShowAdd(false);
    setEditId(null);
  };

  const handleCreate = async () => {
    if (!name.trim() || !slug.trim()) return;
    try {
      await createCategory.mutateAsync({
        name: name.trim(),
        slug: slug.trim(),
        iconName: iconName.trim() || undefined,
        parentCategoryId: parentId !== "none" ? parentId : undefined,
        displayOrder: parseInt(displayOrder) || 0,
      });
      toast.success("Category created");
      resetForm();
    } catch {
      toast.error("Failed to create category");
    }
  };

  const handleToggleActive = async (id: string, currentActive: boolean) => {
    try {
      await updateCategory.mutateAsync({ id, isActive: !currentActive });
      toast.success(currentActive ? "Category disabled" : "Category enabled");
    } catch {
      toast.error("Failed to update");
    }
  };

  const openEdit = (cat: NonNullable<typeof categories>[number]) => {
    setEditId(cat.id);
    setName(cat.name);
    setSlug(cat.slug);
    setIconName(cat.icon_name ?? "");
    setDisplayOrder(String(cat.display_order));
    setParentId(cat.parent_category_id ?? "none");
    setShowAdd(true);
  };

  const handleSaveEdit = async () => {
    if (!editId || !name.trim() || !slug.trim()) return;
    try {
      await updateCategory.mutateAsync({
        id: editId,
        name: name.trim(),
        slug: slug.trim(),
        iconName: iconName.trim() || undefined,
        displayOrder: parseInt(displayOrder) || 0,
      });
      toast.success("Category updated");
      resetForm();
    } catch {
      toast.error("Failed to update");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FolderTree size={22} /> Categories
        </h2>
        <Button
          size="sm"
          className="gap-1"
          onClick={() => {
            resetForm();
            setShowAdd(true);
          }}
        >
          <Plus size={14} /> Add Category
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <div className="space-y-3">
          {parentCategories.map((parent) => {
            const children = getChildren(parent.id);
            return (
              <Card key={parent.id} className="overflow-hidden">
                {/* Parent row */}
                <div className="flex items-center justify-between p-4 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {parent.display_order}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{parent.name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{parent.slug}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {children.length > 0 && (
                      <Badge variant="secondary" className="text-[10px]">{children.length} sub</Badge>
                    )}
                    <Switch
                      checked={parent.is_active ?? true}
                      onCheckedChange={() => handleToggleActive(parent.id, parent.is_active ?? true)}
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(parent)}>
                      <Edit2 size={14} />
                    </Button>
                  </div>
                </div>

                {/* Children */}
                {children.length > 0 && (
                  <div className="bg-muted/30">
                    {children.map((child) => (
                      <div
                        key={child.id}
                        className="flex items-center justify-between px-4 py-2.5 pl-12 border-b border-border/30 last:border-0"
                      >
                        <div className="flex items-center gap-2">
                          <ChevronRight size={12} className="text-muted-foreground" />
                          <p className="text-xs font-medium">{child.name}</p>
                          <span className="text-[10px] text-muted-foreground font-mono">{child.slug}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={child.is_active ?? true}
                            onCheckedChange={() => handleToggleActive(child.id, child.is_active ?? true)}
                          />
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(child)}>
                            <Edit2 size={12} />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Add/Edit Category Sheet */}
      <Sheet open={showAdd} onOpenChange={() => resetForm()}>
        <SheetContent side="bottom" className="rounded-t-2xl md:max-w-lg md:mx-auto">
          <SheetHeader>
            <SheetTitle>{editId ? "Edit Category" : "Add Category"}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label className="text-xs">Name</Label>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!editId) setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
                }}
                placeholder="e.g., Swimming"
                className="h-10 rounded-lg"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">Slug</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g., swimming"
                className="h-10 rounded-lg font-mono text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Icon (Lucide name)</Label>
                <Input
                  value={iconName}
                  onChange={(e) => setIconName(e.target.value)}
                  placeholder="e.g., Trophy"
                  className="h-10 rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Display Order</Label>
                <Input
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  className="h-10 rounded-lg"
                />
              </div>
            </div>

            {!editId && (
              <div className="space-y-1">
                <Label className="text-xs">Parent Category</Label>
                <Select value={parentId} onValueChange={setParentId}>
                  <SelectTrigger className="h-10 rounded-lg">
                    <SelectValue placeholder="None (top-level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (top-level)</SelectItem>
                    {parentCategories.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <Button
              onClick={editId ? handleSaveEdit : handleCreate}
              disabled={!name.trim() || !slug.trim() || createCategory.isPending || updateCategory.isPending}
              className="w-full rounded-lg"
            >
              {(createCategory.isPending || updateCategory.isPending) ? (
                <Loader2 size={16} className="animate-spin" />
              ) : editId ? "Save Changes" : "Create Category"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default PlatformCategories;
