/**
 * IconPicker — scrollable grid of curated Lucide icons for category selection.
 *
 * Exports ICON_MAP so other components (CategoryRequestSheet, PlatformCategories)
 * can render a stored icon name as an actual React component.
 */

import * as React from "react";
import {
  Activity, Apple, Atom, Baby, Bell, Bike, BookOpen, Bot,
  Brain, Calculator, Camera, Cake, ChefHat, Clock, Code, Code2,
  Coffee, Compass, Cpu, Dumbbell, Eye, Film, Flame, FlaskConical,
  Flower, Gamepad2, Gift, Globe, GraduationCap, Guitar, Heart,
  Home, Languages, Laptop, Leaf, Lightbulb, Map, Medal, Mic,
  Moon, Mountain, Music, Music2, Paintbrush, Palette, Pen, Pencil,
  PenTool, Rocket, Scissors, Shield, Smile, Sparkles, Star, Sun,
  Sword, Target, Timer, Trophy, Users, Utensils, Waves, Wifi,
  Wind, Wrench, Zap, Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

// ── Curated icon map (66 icons across 7 categories) ──────────────────────────

export const ICON_MAP: Record<
  string,
  React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>
> = {
  // Sports & Fitness
  Dumbbell, Trophy, Target, Timer, Bike, Waves, Mountain,
  Zap, Medal, Flame, Sword, Shield,
  // Arts & Performance
  Music, Music2, Mic, Guitar, Palette, PenTool, Camera, Film,
  Scissors, Sparkles, Star, Pen,
  // Education & Academic
  BookOpen, GraduationCap, Brain, Calculator, Globe, Languages,
  Laptop, Code, FlaskConical, Atom, Lightbulb, Pencil,
  // Wellness & Mind
  Heart, Leaf, Sun, Moon, Activity, Wind, Smile, Baby,
  // Technology
  Code2, Bot, Cpu, Gamepad2, Wifi, Wrench,
  // Food & Lifestyle
  ChefHat, Utensils, Cake, Apple, Coffee, Flower,
  // General
  Users, Gift, Compass, Rocket, Bell, Eye, Home, Clock, Map, Paintbrush,
};

// ── Props ─────────────────────────────────────────────────────────────────────

export type IconPickerProps = {
  value: string;
  onChange: (iconName: string) => void;
  className?: string;
};

// ── Component ─────────────────────────────────────────────────────────────────

const IconPicker = React.forwardRef<HTMLDivElement, IconPickerProps>(
  ({ value, onChange, className }, ref) => {
    const [search, setSearch] = React.useState("");

    const allNames = Object.keys(ICON_MAP);
    const filtered = search.trim()
      ? allNames.filter((n) => n.toLowerCase().includes(search.toLowerCase()))
      : allNames;

    return (
      <div ref={ref} className={cn("space-y-2", className)}>
        {/* Search */}
        <div className="relative">
          <Search
            size={13}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search icons…"
            className="h-8 pl-8 text-xs rounded-lg"
          />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-6 gap-1 max-h-44 overflow-y-auto rounded-xl border border-border bg-muted/20 p-2">
          {filtered.map((iconName) => {
            const Icon = ICON_MAP[iconName];
            const selected = value === iconName;
            return (
              <button
                key={iconName}
                type="button"
                title={iconName}
                onClick={() => onChange(iconName)}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 rounded-lg p-1.5 transition-all active:scale-95",
                  selected
                    ? "bg-provider text-white ring-2 ring-provider ring-offset-1"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon size={18} />
                <span className="text-[7px] leading-none truncate w-full text-center">
                  {iconName}
                </span>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="col-span-6 py-4 text-center text-xs text-muted-foreground">
              No matching icons
            </p>
          )}
        </div>

        {/* Selected label */}
        {value && ICON_MAP[value] && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {React.createElement(ICON_MAP[value], {
              size: 13,
              className: "text-provider",
            })}
            <span>
              Selected: <strong className="text-foreground">{value}</strong>
            </span>
          </div>
        )}
      </div>
    );
  }
);

IconPicker.displayName = "IconPicker";
export default IconPicker;
