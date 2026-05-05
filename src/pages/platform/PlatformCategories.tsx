import { useState, useMemo } from "react";
import {
  usePlatformCategories,
  useCreateCategory,
  useUpdateCategory,
} from "@/hooks/usePlatformAdmin";
import {
  usePlatformCategoryRequests,
  useApproveCategoryRequest,
  useRejectCategoryRequest,
} from "@/hooks/useCategoryRequests";
import { useUser } from "@/contexts/UserContext";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
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
  Check,
  ChevronRight,
  Clock,
  Edit2,
  FolderTree,
  GripVertical,
  Loader2,
  MoveRight,
  Plus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import ErrorState from "@/components/shared/ErrorState";

import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean | null;
};

// Sortable parent card
function SortableParentCard({
  parent,
  children,
  onToggle,
  onEdit,
  onEditChild,
  onToggleChild,
  onMoveChild,
  parentCategories,
}: {
  parent: Category;
  children: Category[];
  onToggle: (id: string, active: boolean) => void;
  onEdit: (cat: Category) => void;
  onEditChild: (cat: Category) => void;
  onToggleChild: (id: string, active: boolean) => void;
  onMoveChild: (childId: string, newParentId: string) => void;
  parentCategories: Category[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: parent.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <Card ref={setNodeRef} style={style} className="overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border/50 last:border-0">
        <div className="flex items-center gap-3">
          <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground">
            <GripVertical size={16} />
          </button>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
            {parent.sort_order}
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
            onCheckedChange={() => onToggle(parent.id, parent.is_active ?? true)}
          />
          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(parent)}>
            <Edit2 size={14} />
          </Button>
        </div>
      </div>

      {children.length > 0 && (
        <SortableContext items={children.map((c) => c.id)} strategy={verticalListSortingStrategy}>
          <div className="bg-muted/30">
            {children.map((child) => (
              <SortableChildRow
                key={child.id}
                child={child}
                onToggle={onToggleChild}
                onEdit={onEditChild}
                onMove={onMoveChild}
                parentCategories={parentCategories}
                currentParentId={parent.id}
              />
            ))}
          </div>
        </SortableContext>
      )}
    </Card>
  );
}

// Sortable child row
function SortableChildRow({
  child,
  onToggle,
  onEdit,
  onMove,
  parentCategories,
  currentParentId,
}: {
  child: Category;
  onToggle: (id: string, active: boolean) => void;
  onEdit: (cat: Category) => void;
  onMove: (childId: string, newParentId: string) => void;
  parentCategories: Category[];
  currentParentId: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: child.id });
  const [showMove, setShowMove] = useState(false);
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between px-4 py-2.5 pl-8 border-b border-border/30 last:border-0"
    >
      <div className="flex items-center gap-2">
        <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground">
          <GripVertical size={12} />
        </button>
        <ChevronRight size={12} className="text-muted-foreground" />
        <p className="text-xs font-medium">{child.name}</p>
        <span className="text-[10px] text-muted-foreground font-mono">{child.slug}</span>
      </div>
      <div className="flex items-center gap-1">
        {showMove ? (
          <Select
            value=""
            onValueChange={(val) => {
              onMove(child.id, val);
              setShowMove(false);
            }}
          >
            <SelectTrigger className="h-6 w-28 text-[10px] rounded">
              <SelectValue placeholder="Move to..." />
            </SelectTrigger>
            <SelectContent>
              {parentCategories
                .filter((p) => p.id !== currentParentId)
                .map((p) => (
                  <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>
                ))}
            </SelectContent>
          </Select>
        ) : (
          <Button size="icon" variant="ghost" className="h-6 w-6" title="Move to another category" onClick={() => setShowMove(true)}>
            <MoveRight size={12} />
          </Button>
        )}
        <Switch
          checked={child.is_active ?? true}
          onCheckedChange={() => onToggle(child.id, child.is_active ?? true)}
        />
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onEdit(child)}>
          <Edit2 size={12} />
        </Button>
      </div>
    </div>
  );
}

const PlatformCategories = () => {
  const { profile } = useUser();
  const { data: categories, isLoading, isError, refetch } = usePlatformCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  // Category requests
  const [activeTab, setActiveTab] = useState<"categories" | "requests">("categories");
  const [requestStatusFilter, setRequestStatusFilter] = useState("pending");
  const { data: catRequests, isLoading: reqLoading } = usePlatformCategoryRequests(requestStatusFilter);
  const approveRequest = useApproveCategoryRequest();
  const rejectRequest = useRejectCategoryRequest();

  // Reject dialog state
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [iconName, setIconName] = useState("");
  const [parentId, setParentId] = useState<string>("none");
  const [displayOrder, setDisplayOrder] = useState("0");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const parentCategories = useMemo(
    () => (categories ?? []).filter((c) => !c.parent_id).sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );
  const getChildren = (pid: string) =>
    (categories ?? []).filter((c) => c.parent_id === pid).sort((a, b) => a.sort_order - b.sort_order);

  const resetForm = () => {
    setName(""); setSlug(""); setIconName(""); setParentId("none"); setDisplayOrder("0");
    setShowAdd(false); setEditId(null);
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

  const openEdit = (cat: Category) => {
    setEditId(cat.id);
    setName(cat.name);
    setSlug(cat.slug);
    setIconName(cat.icon ?? "");
    setDisplayOrder(String(cat.sort_order));
    setParentId(cat.parent_id ?? "none");
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

  const handleMoveChild = async (childId: string, newParentId: string) => {
    try {
      await updateCategory.mutateAsync({ id: childId, parentCategoryId: newParentId });
      toast.success("Sub-category moved");
    } catch {
      toast.error("Failed to move");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    // Check if both are parents
    const activeParent = parentCategories.find((p) => p.id === activeId);
    const overParent = parentCategories.find((p) => p.id === overId);

    if (activeParent && overParent) {
      // Reorder parents
      const oldIndex = parentCategories.findIndex((p) => p.id === activeId);
      const newIndex = parentCategories.findIndex((p) => p.id === overId);
      const reordered = arrayMove(parentCategories, oldIndex, newIndex);

      // Batch update sort_order
      for (let i = 0; i < reordered.length; i++) {
        if (reordered[i].sort_order !== i + 1) {
          await updateCategory.mutateAsync({ id: reordered[i].id, displayOrder: i + 1 });
        }
      }
      toast.success("Order updated");
      return;
    }

    // Check if both are children of the same parent
    for (const parent of parentCategories) {
      const children = getChildren(parent.id);
      const activeChild = children.find((c) => c.id === activeId);
      const overChild = children.find((c) => c.id === overId);
      if (activeChild && overChild) {
        const oldIndex = children.findIndex((c) => c.id === activeId);
        const newIndex = children.findIndex((c) => c.id === overId);
        const reordered = arrayMove(children, oldIndex, newIndex);

        for (let i = 0; i < reordered.length; i++) {
          if (reordered[i].sort_order !== i + 1) {
            await updateCategory.mutateAsync({ id: reordered[i].id, displayOrder: i + 1 });
          }
        }
        toast.success("Order updated");
        return;
      }
    }
  };

  const handleApprove = async (req: any) => {
    if (!profile) return;
    try {
      await approveRequest.mutateAsync({
        requestId: req.id,
        name: req.name,
        icon: req.icon ?? undefined,
        parentCategoryId: req.parent_category_id ?? undefined,
        adminUserId: profile.id,
      });
      toast.success(`"${req.name}" approved and added to categories`);
    } catch {
      toast.error("Failed to approve request");
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || !rejectReason.trim() || !profile) return;
    try {
      await rejectRequest.mutateAsync({
        requestId: rejectTarget,
        reason: rejectReason.trim(),
        adminUserId: profile.id,
      });
      toast.success("Request rejected");
      setRejectTarget(null);
      setRejectReason("");
    } catch {
      toast.error("Failed to reject request");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <FolderTree size={22} /> Categories
        </h2>
        {activeTab === "categories" && (
          <Button
            size="sm"
            className="gap-1"
            onClick={() => { resetForm(); setShowAdd(true); }}
          >
            <Plus size={14} /> Add Category
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        {(["categories", "requests"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Categories tab */}
      {activeTab === "categories" && (
        <>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))}
            </div>
          ) : isError ? (
            <ErrorState onRetry={() => refetch()} />
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={parentCategories.map((p) => p.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {parentCategories.map((parent) => (
                    <SortableParentCard
                      key={parent.id}
                      parent={parent}
                      children={getChildren(parent.id)}
                      onToggle={handleToggleActive}
                      onEdit={openEdit}
                      onEditChild={openEdit}
                      onToggleChild={handleToggleActive}
                      onMoveChild={handleMoveChild}
                      parentCategories={parentCategories}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </>
      )}

      {/* Requests tab */}
      {activeTab === "requests" && (
        <div className="space-y-4">
          {/* Status filter */}
          <div className="flex gap-2">
            {["pending", "approved", "rejected", "all"].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={requestStatusFilter === s ? "default" : "outline"}
                className="capitalize text-xs h-7"
                onClick={() => setRequestStatusFilter(s)}
              >
                {s}
              </Button>
            ))}
          </div>

          {reqLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
          ) : !catRequests || catRequests.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <FolderTree size={28} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">No {requestStatusFilter !== "all" ? requestStatusFilter : ""} requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {catRequests.map((req: any) => (
                <Card key={req.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{req.name}</p>
                        {req.icon && (
                          <Badge variant="outline" className="text-[10px] font-mono">{req.icon}</Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize ${
                            req.status === "pending" ? "border-amber-300 text-amber-700" :
                            req.status === "approved" ? "border-green-300 text-green-700" :
                            "border-red-300 text-red-700"
                          }`}
                        >
                          {req.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        By: {(req.service_providers as any)?.business_name ?? "Unknown provider"}
                        {req.class_categories && ` · Under: ${(req.class_categories as any)?.name}`}
                      </p>
                      {req.description && (
                        <p className="text-xs text-muted-foreground mt-1">{req.description}</p>
                      )}
                      {req.rejection_reason && (
                        <p className="text-xs text-red-600 mt-1">Reason: {req.rejection_reason}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(req.requested_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>

                  {req.status === "pending" && (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-xs gap-1 border-red-200 text-red-600 hover:bg-red-50"
                        onClick={() => setRejectTarget(req.id)}
                      >
                        <X size={12} /> Reject
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1 text-xs gap-1 bg-green-600 hover:bg-green-700"
                        onClick={() => handleApprove(req)}
                        disabled={approveRequest.isPending}
                      >
                        {approveRequest.isPending ? <Loader2 size={12} className="animate-spin" /> : <><Check size={12} /> Approve</>}
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reject reason sheet */}
      <Sheet open={!!rejectTarget} onOpenChange={(o) => !o && (setRejectTarget(null), setRejectReason(""))}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader><SheetTitle>Reject Category Request</SheetTitle></SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1">
              <Label className="text-xs">Reason (shown to provider)</Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., This category already exists under Arts…"
                className="rounded-lg"
                rows={3}
              />
            </div>
            <Button
              onClick={handleReject}
              disabled={!rejectReason.trim() || rejectRequest.isPending}
              className="w-full rounded-lg bg-destructive hover:bg-destructive/90"
            >
              {rejectRequest.isPending ? <Loader2 size={16} className="animate-spin" /> : "Confirm Rejection"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

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
