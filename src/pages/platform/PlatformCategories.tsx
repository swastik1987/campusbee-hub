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
  useRetagCategoryRequest,
} from "@/hooks/useCategoryRequests";
import { useUser } from "@/contexts/UserContext";
import { useCategories } from "@/hooks/useClasses";
import IconPicker, { ICON_MAP } from "@/components/provider/IconPicker";
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
  ChevronDown,
  ChevronRight,
  ChevronUp,
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

// ── Sortable parent card ──────────────────────────────────────────────────────

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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: parent.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };
  const ParentIcon = parent.icon ? ICON_MAP[parent.icon] : null;

  return (
    <Card ref={setNodeRef} style={style} className="overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border/50 last:border-0">
        <div className="flex items-center gap-3">
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
          >
            <GripVertical size={16} />
          </button>
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            {ParentIcon ? (
              <ParentIcon size={16} className="text-primary" />
            ) : (
              <span className="text-xs font-bold text-primary">
                {parent.sort_order}
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">{parent.name}</p>
            <p className="text-[10px] text-muted-foreground font-mono">
              {parent.slug}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {children.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {children.length} sub
            </Badge>
          )}
          <Switch
            checked={parent.is_active ?? true}
            onCheckedChange={() =>
              onToggle(parent.id, parent.is_active ?? true)
            }
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={() => onEdit(parent)}
          >
            <Edit2 size={14} />
          </Button>
        </div>
      </div>

      {children.length > 0 && (
        <SortableContext
          items={children.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
        >
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

// ── Sortable child row ────────────────────────────────────────────────────────

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
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: child.id });
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
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground hover:text-foreground"
        >
          <GripVertical size={12} />
        </button>
        <ChevronRight size={12} className="text-muted-foreground" />
        <p className="text-xs font-medium">{child.name}</p>
        <span className="text-[10px] text-muted-foreground font-mono">
          {child.slug}
        </span>
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
                  <SelectItem key={p.id} value={p.id} className="text-xs">
                    {p.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        ) : (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            title="Move to another category"
            onClick={() => setShowMove(true)}
          >
            <MoveRight size={12} />
          </Button>
        )}
        <Switch
          checked={child.is_active ?? true}
          onCheckedChange={() => onToggle(child.id, child.is_active ?? true)}
        />
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          onClick={() => onEdit(child)}
        >
          <Edit2 size={12} />
        </Button>
      </div>
    </div>
  );
}

// ── Status badge config for requests ─────────────────────────────────────────

const REQ_STATUS: Record<
  string,
  { label: string; classes: string }
> = {
  pending:       { label: "Pending",               classes: "border-amber-300 text-amber-700" },
  approved:      { label: "Approved",              classes: "border-green-300 text-green-700" },
  rejected:      { label: "Rejected",              classes: "border-red-300 text-red-700" },
  retag_pending: { label: "Awaiting Provider",     classes: "border-blue-300 text-blue-700" },
  retag_declined:{ label: "Retag Declined",        classes: "border-slate-300 text-slate-600" },
};

// ── Main component ────────────────────────────────────────────────────────────

const PlatformCategories = () => {
  const { profile } = useUser();
  const { data: categories, isLoading, isError, refetch } = usePlatformCategories();
  const { data: allCategories } = useCategories(); // for parent picker in retag
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  // ── Tab ──────────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"categories" | "requests">(
    "categories"
  );

  // ── Requests state ────────────────────────────────────────────────────────
  const [requestStatusFilter, setRequestStatusFilter] = useState("pending");
  const { data: catRequests, isLoading: reqLoading } =
    usePlatformCategoryRequests(requestStatusFilter);
  const approveRequest = useApproveCategoryRequest();
  const rejectRequest  = useRejectCategoryRequest();
  const retagRequest   = useRetagCategoryRequest();

  // Approve sheet
  const [approveTarget, setApproveTarget]     = useState<any>(null);
  const [approveName, setApproveName]         = useState("");
  const [approveIcon, setApproveIcon]         = useState("");
  const [showApproveIconPicker, setShowApproveIconPicker] = useState(false);

  // Reject sheet
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Retag sheet
  const [retagTarget, setRetagTarget]   = useState<any>(null);
  const [retagCatId, setRetagCatId]     = useState("");
  const [retagNotes, setRetagNotes]     = useState("");

  // ── Category CRUD state ────────────────────────────────────────────────────
  const [showAdd, setShowAdd]           = useState(false);
  const [editId, setEditId]             = useState<string | null>(null);
  const [name, setName]                 = useState("");
  const [slug, setSlug]                 = useState("");
  const [iconName, setIconName]         = useState("");
  const [parentId, setParentId]         = useState<string>("none");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [showCrudIconPicker, setShowCrudIconPicker] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const parentCategories = useMemo(
    () =>
      (categories ?? [])
        .filter((c) => !c.parent_id)
        .sort((a, b) => a.sort_order - b.sort_order),
    [categories]
  );

  const allParentCats = useMemo(
    () => (allCategories ?? []).filter((c) => !c.parent_id),
    [allCategories]
  );

  const getChildren = (pid: string) =>
    (categories ?? [])
      .filter((c) => c.parent_id === pid)
      .sort((a, b) => a.sort_order - b.sort_order);

  const resetForm = () => {
    setName(""); setSlug(""); setIconName(""); setParentId("none");
    setDisplayOrder("0"); setShowAdd(false); setEditId(null);
    setShowCrudIconPicker(false);
  };

  // ── Category CRUD handlers ─────────────────────────────────────────────────

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
    setShowCrudIconPicker(false);
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
      await updateCategory.mutateAsync({
        id: childId,
        parentCategoryId: newParentId,
      });
      toast.success("Sub-category moved");
    } catch {
      toast.error("Failed to move");
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const activeId = String(active.id);
    const overId   = String(over.id);

    const activeParent = parentCategories.find((p) => p.id === activeId);
    const overParent   = parentCategories.find((p) => p.id === overId);

    if (activeParent && overParent) {
      const oldIndex = parentCategories.findIndex((p) => p.id === activeId);
      const newIndex = parentCategories.findIndex((p) => p.id === overId);
      const reordered = arrayMove(parentCategories, oldIndex, newIndex);
      for (let i = 0; i < reordered.length; i++) {
        if (reordered[i].sort_order !== i + 1) {
          await updateCategory.mutateAsync({
            id: reordered[i].id,
            displayOrder: i + 1,
          });
        }
      }
      toast.success("Order updated");
      return;
    }

    for (const parent of parentCategories) {
      const children    = getChildren(parent.id);
      const activeChild = children.find((c) => c.id === activeId);
      const overChild   = children.find((c) => c.id === overId);
      if (activeChild && overChild) {
        const oldIdx   = children.findIndex((c) => c.id === activeId);
        const newIdx   = children.findIndex((c) => c.id === overId);
        const reordered = arrayMove(children, oldIdx, newIdx);
        for (let i = 0; i < reordered.length; i++) {
          if (reordered[i].sort_order !== i + 1) {
            await updateCategory.mutateAsync({
              id: reordered[i].id,
              displayOrder: i + 1,
            });
          }
        }
        toast.success("Order updated");
        return;
      }
    }
  };

  // ── Request review handlers ────────────────────────────────────────────────

  const openApprove = (req: any) => {
    setApproveTarget(req);
    setApproveName(req.requested_name);
    setApproveIcon(req.requested_icon ?? "");
    setShowApproveIconPicker(false);
  };

  const handleApproveConfirm = async () => {
    if (!approveTarget || !profile) return;
    const finalName = approveName.trim() || approveTarget.requested_name;
    try {
      await approveRequest.mutateAsync({
        requestId:   approveTarget.id,
        finalName,
        finalIcon:   approveIcon || undefined,
        parentId:    approveTarget.parent_category_id || undefined,
        adminUserId: profile.id,
      });
      toast.success(`"${finalName}" approved and added to categories`);
      setApproveTarget(null);
    } catch {
      toast.error("Failed to approve request");
    }
  };

  const handleRejectConfirm = async () => {
    if (!rejectTarget || !rejectReason.trim() || !profile) return;
    try {
      await rejectRequest.mutateAsync({
        requestId:   rejectTarget,
        reason:      rejectReason.trim(),
        adminUserId: profile.id,
      });
      toast.success("Request rejected");
      setRejectTarget(null);
      setRejectReason("");
    } catch {
      toast.error("Failed to reject request");
    }
  };

  const handleRetagConfirm = async () => {
    if (!retagTarget || !retagCatId || !profile) return;
    try {
      await retagRequest.mutateAsync({
        requestId:       retagTarget.id,
        retagCategoryId: retagCatId,
        notes:           retagNotes.trim() || undefined,
        adminUserId:     profile.id,
      });
      toast.success("Re-tag suggestion sent to provider");
      setRetagTarget(null);
      setRetagCatId("");
      setRetagNotes("");
    } catch {
      toast.error("Failed to send re-tag");
    }
  };

  const ApproveIcon = approveIcon ? ICON_MAP[approveIcon] : null;
  const CrudIcon    = iconName    ? ICON_MAP[iconName]    : null;

  // ── Render ────────────────────────────────────────────────────────────────

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

      {/* ── Categories tab ──────────────────────────────────────────────── */}
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
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={parentCategories.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
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

      {/* ── Requests tab ────────────────────────────────────────────────── */}
      {activeTab === "requests" && (
        <div className="space-y-4">
          {/* Status filter */}
          <div className="flex flex-wrap gap-2">
            {[
              "pending",
              "retag_pending",
              "approved",
              "rejected",
              "retag_declined",
              "all",
            ].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={requestStatusFilter === s ? "default" : "outline"}
                className="capitalize text-xs h-7"
                onClick={() => setRequestStatusFilter(s)}
              >
                {s.replace("_", " ")}
              </Button>
            ))}
          </div>

          {reqLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-24 rounded-xl" />
              ))}
            </div>
          ) : !catRequests || catRequests.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <FolderTree size={28} className="text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                No{" "}
                {requestStatusFilter !== "all"
                  ? requestStatusFilter.replace("_", " ")
                  : ""}{" "}
                requests
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {catRequests.map((req: any) => {
                const cfg = REQ_STATUS[req.status] ?? REQ_STATUS.pending;
                const ReqIcon  = req.requested_icon  ? ICON_MAP[req.requested_icon]  : null;
                const RetagIcon = req.retag_cat?.icon ? ICON_MAP[req.retag_cat.icon] : null;

                return (
                  <Card key={req.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {ReqIcon && (
                            <ReqIcon size={16} className="text-primary shrink-0" />
                          )}
                          <p className="font-semibold text-sm">
                            {req.requested_name}
                          </p>
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize ${cfg.classes}`}
                          >
                            {cfg.label}
                          </Badge>
                          {req.request_type === "new_subcategory" && (
                            <Badge variant="secondary" className="text-[10px]">
                              Sub-category
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground mt-0.5">
                          By:{" "}
                          {(req.service_providers as any)?.business_name ??
                            "Unknown provider"}
                          {req.parent_cat?.name &&
                            ` · Under: ${req.parent_cat.name}`}
                        </p>

                        {req.description && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {req.description}
                          </p>
                        )}

                        {/* Requested sub-categories */}
                        {(req.requested_subcategories as string[] | null)?.length && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {(req.requested_subcategories as string[]).map((s, i) => (
                              <span
                                key={i}
                                className="bg-muted rounded px-1.5 py-0.5 text-[10px] font-medium"
                              >
                                + {s}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Rejection reason */}
                        {req.admin_notes && req.status === "rejected" && (
                          <p className="text-xs text-red-600 mt-1">
                            Reason: {req.admin_notes}
                          </p>
                        )}

                        {/* Re-tag pending info */}
                        {req.status === "retag_pending" && req.retag_cat && (
                          <div className="flex items-center gap-1.5 mt-1.5">
                            {RetagIcon && (
                              <RetagIcon size={13} className="text-blue-600 shrink-0" />
                            )}
                            <p className="text-xs text-blue-700">
                              Suggested: {req.retag_cat.name} — awaiting provider confirmation
                            </p>
                          </div>
                        )}

                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(req.requested_at).toLocaleDateString(
                            "en-IN",
                            { day: "numeric", month: "short", year: "numeric" }
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Actions — only for pending requests */}
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
                          variant="outline"
                          className="flex-1 text-xs gap-1 border-blue-200 text-blue-600 hover:bg-blue-50"
                          onClick={() => {
                            setRetagTarget(req);
                            setRetagCatId("");
                            setRetagNotes("");
                          }}
                        >
                          <MoveRight size={12} /> Re-tag
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => openApprove(req)}
                        >
                          <Check size={12} /> Approve
                        </Button>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Approve sheet ────────────────────────────────────────────────── */}
      <Sheet
        open={!!approveTarget}
        onOpenChange={(o) => { if (!o) setApproveTarget(null); }}
      >
        <SheetContent
          side="bottom"
          className="rounded-t-2xl flex flex-col"
          style={{ maxHeight: "88dvh" }}
        >
          <SheetHeader className="shrink-0 border-b border-border pb-3">
            <SheetTitle>Approve Category Request</SheetTitle>
            <p className="text-left text-xs text-muted-foreground">
              You can edit the name or icon before approving. The provider will
              be notified.
            </p>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto py-4 space-y-4">
            {/* Original request */}
            {approveTarget && (
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 space-y-0.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Requested by provider
                </p>
                <p className="text-sm font-semibold">
                  {approveTarget.requested_name}
                </p>
                {approveTarget.description && (
                  <p className="text-xs text-muted-foreground">
                    {approveTarget.description}
                  </p>
                )}
              </div>
            )}

            {/* Sub-categories to be auto-created (read-only info) */}
            {(approveTarget?.requested_subcategories as string[] | null)?.length > 0 && (
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5 space-y-1.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Sub-categories (auto-created on approval)
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(approveTarget.requested_subcategories as string[]).map(
                    (s: string, i: number) => (
                      <span
                        key={i}
                        className="bg-primary/10 text-primary rounded-lg px-2.5 py-1 text-xs font-medium"
                      >
                        {s}
                      </span>
                    )
                  )}
                </div>
              </div>
            )}

            {/* Editable name */}
            <div className="space-y-1.5">
              <Label className="text-xs">Final Name</Label>
              <Input
                value={approveName}
                onChange={(e) => setApproveName(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>

            {/* Editable icon */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Icon</Label>
                <button
                  type="button"
                  onClick={() => setShowApproveIconPicker((v) => !v)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {ApproveIcon && (
                    <ApproveIcon size={13} className="text-primary" />
                  )}
                  {approveIcon || "Choose icon"}
                  {showApproveIconPicker ? (
                    <ChevronUp size={11} />
                  ) : (
                    <ChevronDown size={11} />
                  )}
                </button>
              </div>
              {showApproveIconPicker && (
                <IconPicker value={approveIcon} onChange={setApproveIcon} />
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-border pt-3">
            <Button
              onClick={handleApproveConfirm}
              disabled={!approveName.trim() || approveRequest.isPending}
              className="w-full h-11 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold"
            >
              {approveRequest.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "Approve & Create Category"
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Reject sheet ─────────────────────────────────────────────────── */}
      <Sheet
        open={!!rejectTarget}
        onOpenChange={(o) => {
          if (!o) { setRejectTarget(null); setRejectReason(""); }
        }}
      >
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Reject Category Request</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs">
                Reason <span className="text-red-500">*</span>
                <span className="text-muted-foreground font-normal ml-1">
                  (shown to provider)
                </span>
              </Label>
              <Textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g., This already exists under Arts → Classical Dance"
                className="rounded-xl"
                rows={3}
              />
            </div>
            <Button
              onClick={handleRejectConfirm}
              disabled={!rejectReason.trim() || rejectRequest.isPending}
              className="w-full rounded-xl h-11 bg-destructive hover:bg-destructive/90 text-white"
            >
              {rejectRequest.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "Confirm Rejection"
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Re-tag sheet ─────────────────────────────────────────────────── */}
      <Sheet
        open={!!retagTarget}
        onOpenChange={(o) => {
          if (!o) { setRetagTarget(null); setRetagCatId(""); setRetagNotes(""); }
        }}
      >
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Suggest Existing Category</SheetTitle>
            <p className="text-left text-xs text-muted-foreground">
              Map this request to an existing category. The provider will be
              asked to Accept or Decline.
            </p>
          </SheetHeader>
          <div className="space-y-4 py-4">
            {retagTarget && (
              <div className="rounded-xl border border-border bg-muted/30 px-3 py-2.5">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                  Provider requested
                </p>
                <p className="text-sm font-semibold">
                  {retagTarget.requested_name}
                </p>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs">
                Map to existing category{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Select value={retagCatId} onValueChange={setRetagCatId}>
                <SelectTrigger className="h-11 rounded-xl">
                  <SelectValue placeholder="Select category…" />
                </SelectTrigger>
                <SelectContent>
                  {(allCategories ?? []).map((cat) => {
                    const CIcon = cat.icon ? ICON_MAP[cat.icon] : null;
                    return (
                      <SelectItem key={cat.id} value={cat.id}>
                        <span className="flex items-center gap-2">
                          {CIcon && <CIcon size={14} />}
                          {cat.name}
                          {cat.parent_id && (
                            <span className="text-[10px] text-muted-foreground ml-1">
                              (sub)
                            </span>
                          )}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">
                Note to provider{" "}
                <span className="text-muted-foreground font-normal">
                  (optional)
                </span>
              </Label>
              <Textarea
                value={retagNotes}
                onChange={(e) => setRetagNotes(e.target.value)}
                placeholder="e.g., Your request fits well under the existing Classical Dance category."
                className="rounded-xl"
                rows={2}
              />
            </div>

            <Button
              onClick={handleRetagConfirm}
              disabled={!retagCatId || retagRequest.isPending}
              className="w-full h-11 rounded-xl"
            >
              {retagRequest.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                "Send Re-tag Suggestion"
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Add / Edit Category sheet ────────────────────────────────────── */}
      <Sheet open={showAdd} onOpenChange={() => resetForm()}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl md:max-w-lg md:mx-auto flex flex-col"
          style={{ maxHeight: "88dvh" }}
        >
          <SheetHeader className="shrink-0">
            <SheetTitle>
              {editId ? "Edit Category" : "Add Category"}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!editId)
                    setSlug(
                      e.target.value
                        .toLowerCase()
                        .replace(/\s+/g, "-")
                        .replace(/[^a-z0-9-]/g, "")
                    );
                }}
                placeholder="e.g., Swimming"
                className="h-10 rounded-lg"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Slug</Label>
              <Input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="e.g., swimming"
                className="h-10 rounded-lg font-mono text-sm"
              />
            </div>

            {/* Icon picker */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Icon (Lucide)</Label>
                <button
                  type="button"
                  onClick={() => setShowCrudIconPicker((v) => !v)}
                  className="flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {CrudIcon && <CrudIcon size={13} className="text-primary" />}
                  {iconName || "Choose icon"}
                  {showCrudIconPicker ? (
                    <ChevronUp size={11} />
                  ) : (
                    <ChevronDown size={11} />
                  )}
                </button>
              </div>
              {showCrudIconPicker && (
                <IconPicker value={iconName} onChange={setIconName} />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
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
              <div className="space-y-1.5">
                <Label className="text-xs">Parent Category</Label>
                <Select value={parentId} onValueChange={setParentId}>
                  <SelectTrigger className="h-10 rounded-lg">
                    <SelectValue placeholder="None (top-level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None (top-level)</SelectItem>
                    {parentCategories.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="shrink-0 pt-3 border-t border-border">
            <Button
              onClick={editId ? handleSaveEdit : handleCreate}
              disabled={
                !name.trim() ||
                !slug.trim() ||
                createCategory.isPending ||
                updateCategory.isPending
              }
              className="w-full rounded-lg h-11"
            >
              {createCategory.isPending || updateCategory.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : editId ? (
                "Save Changes"
              ) : (
                "Create Category"
              )}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default PlatformCategories;
