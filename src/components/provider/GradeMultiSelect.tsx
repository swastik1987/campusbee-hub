import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export const GRADE_OPTIONS = [
  "KG",
  ...Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`),
];

interface Props {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  className?: string;
}

const GradeMultiSelect = React.forwardRef<HTMLButtonElement, Props>(
  ({ value, onChange, placeholder = "Select grades", className }, ref) => {
    const toggle = (g: string) => {
      onChange(value.includes(g) ? value.filter((x) => x !== g) : [...value, g]);
    };
    const label =
      value.length === 0
        ? placeholder
        : value.length <= 2
          ? value.join(", ")
          : `${value.length} selected`;
    return (
      <Popover>
        <PopoverTrigger asChild>
          <button
            ref={ref}
            type="button"
            className={cn(
              "flex h-11 w-full items-center justify-between rounded-xl border border-input bg-background px-3 py-2 text-sm text-left",
              value.length === 0 && "text-muted-foreground",
              className,
            )}
          >
            <span className="truncate">{label}</span>
            <ChevronDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-1 max-h-72 overflow-y-auto" align="start">
          {GRADE_OPTIONS.map((g) => {
            const selected = value.includes(g);
            return (
              <button
                key={g}
                type="button"
                onClick={() => toggle(g)}
                className="flex w-full items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-accent"
              >
                <span>{g}</span>
                {selected && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })}
        </PopoverContent>
      </Popover>
    );
  },
);
GradeMultiSelect.displayName = "GradeMultiSelect";

export default GradeMultiSelect;