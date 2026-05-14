import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileText, Image as ImageIcon, Loader2, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { useUser } from "@/contexts/UserContext";
import {
  useCreateSupportRequest,
  type SupportType,
} from "@/hooks/useSupportRequests";

const MAX_FILES = 5;
const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPT = ".jpg,.jpeg,.png,.pdf";
const ALLOWED = new Set(["image/jpeg", "image/png", "application/pdf"]);

const schema = z.object({
  type: z.enum(["support", "recommendation"]),
  subject: z.string().trim().min(3, "Subject is too short").max(120, "Max 120 characters"),
  body: z.string().trim().min(10, "Please add more detail").max(2000, "Max 2000 characters"),
});

type FormValues = z.infer<typeof schema>;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultType?: SupportType;
};

const SupportRequestSheet = React.forwardRef<HTMLDivElement, Props>(
  ({ open, onOpenChange, defaultType = "support" }, _ref) => {
    const { profile } = useUser();
    const createRequest = useCreateSupportRequest();

    const {
      register,
      handleSubmit,
      setValue,
      watch,
      reset,
      formState: { errors, isSubmitting },
    } = useForm<FormValues>({
      resolver: zodResolver(schema),
      defaultValues: { type: defaultType, subject: "", body: "" },
    });

    const [files, setFiles] = React.useState<File[]>([]);
    const type = watch("type");
    const body = watch("body") ?? "";

    React.useEffect(() => {
      if (!open) {
        reset({ type: defaultType, subject: "", body: "" });
        setFiles([]);
      }
    }, [open, defaultType, reset]);

    const onFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = Array.from(e.target.files ?? []);
      e.target.value = "";
      if (!picked.length) return;

      const accepted: File[] = [];
      const errs: string[] = [];
      for (const f of picked) {
        if (!ALLOWED.has(f.type)) {
          errs.push(`${f.name}: unsupported type`);
          continue;
        }
        if (f.size > MAX_SIZE) {
          errs.push(`${f.name}: larger than 5 MB`);
          continue;
        }
        accepted.push(f);
      }

      setFiles((curr) => {
        const merged = [...curr, ...accepted];
        if (merged.length > MAX_FILES) {
          errs.push(`Only ${MAX_FILES} files allowed — dropped the extras`);
          return merged.slice(0, MAX_FILES);
        }
        return merged;
      });

      errs.forEach((e) => toast.error(e));
    };

    const removeFile = (idx: number) => {
      setFiles((curr) => curr.filter((_, i) => i !== idx));
    };

    const onSubmit = async (values: FormValues) => {
      if (!profile) {
        toast.error("You need to be signed in");
        return;
      }
      try {
        const { failures } = await createRequest.mutateAsync({
          userId: profile.id,
          type: values.type,
          subject: values.subject,
          body: values.body,
          files,
        });
        if (failures.length > 0) {
          toast.warning(
            `Submitted, but ${failures.length} attachment(s) failed to upload`,
          );
        } else {
          toast.success(
            values.type === "recommendation"
              ? "Thanks for the recommendation!"
              : "Support request submitted",
          );
        }
        onOpenChange(false);
      } catch (err) {
        console.error("[support] submit:", err);
        toast.error(err instanceof Error ? err.message : "Failed to submit");
      }
    };

    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="h-[88vh] rounded-t-2xl p-0 flex flex-col"
        >
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-border/50 flex-shrink-0">
            <SheetTitle className="text-left">Help &amp; Feedback</SheetTitle>
          </SheetHeader>

          <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-1 flex-col overflow-hidden"
          >
            <div className="flex-1 overflow-y-auto px-4 py-5 space-y-5">
              {/* Type */}
              <div className="space-y-1.5">
                <Label className="text-sm">What would you like to share?</Label>
                <Select
                  value={type}
                  onValueChange={(v) => setValue("type", v as SupportType, { shouldValidate: true })}
                >
                  <SelectTrigger className="h-11 rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="support">Support request</SelectItem>
                    <SelectItem value="recommendation">Recommendation / feedback</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Subject */}
              <div className="space-y-1.5">
                <Label htmlFor="sr-subject" className="text-sm">
                  Subject
                </Label>
                <Input
                  id="sr-subject"
                  {...register("subject")}
                  placeholder="Briefly, what's this about?"
                  maxLength={120}
                  className="h-11 rounded-xl"
                />
                {errors.subject && (
                  <p className="text-[11px] text-destructive">{errors.subject.message}</p>
                )}
              </div>

              {/* Body */}
              <div className="space-y-1.5">
                <Label htmlFor="sr-body" className="text-sm">
                  Details
                </Label>
                <Textarea
                  id="sr-body"
                  {...register("body")}
                  rows={6}
                  placeholder={
                    type === "recommendation"
                      ? "What would you like us to add or improve?"
                      : "Please describe the issue, including any steps to reproduce it."
                  }
                  maxLength={2000}
                  className="rounded-xl resize-none"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>
                    {errors.body && (
                      <span className="text-destructive">{errors.body.message}</span>
                    )}
                  </span>
                  <span>{body.length}/2000</span>
                </div>
              </div>

              {/* Attachments */}
              <div className="space-y-2">
                <Label className="text-sm">
                  Attachments{" "}
                  <span className="text-[10px] font-normal text-muted-foreground">
                    (optional — up to 5 files; JPG, PNG, or PDF; max 5 MB each)
                  </span>
                </Label>
                <label
                  htmlFor="sr-files"
                  className="flex h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 text-sm font-medium text-muted-foreground hover:bg-muted/50"
                >
                  <Paperclip size={15} />
                  {files.length === 0
                    ? "Add files"
                    : `${files.length} of ${MAX_FILES} attached — add more`}
                </label>
                <input
                  id="sr-files"
                  type="file"
                  accept={ACCEPT}
                  multiple
                  className="sr-only"
                  onChange={onFiles}
                  disabled={files.length >= MAX_FILES}
                />

                {files.length > 0 && (
                  <ul className="space-y-1.5">
                    {files.map((f, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2"
                      >
                        {f.type === "application/pdf" ? (
                          <FileText size={14} className="text-muted-foreground" />
                        ) : (
                          <ImageIcon size={14} className="text-muted-foreground" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{f.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {(f.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFile(i)}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Remove file"
                        >
                          <X size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            <SheetFooter className="flex-shrink-0 border-t border-border/50 px-4 py-3">
              <Button
                type="submit"
                className="h-12 w-full rounded-xl gradient-primary font-semibold text-primary-foreground"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 size={16} className="mr-2 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit"
                )}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    );
  },
);

SupportRequestSheet.displayName = "SupportRequestSheet";

export default SupportRequestSheet;
