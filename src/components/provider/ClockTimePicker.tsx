import { useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

// ── Constants ─────────────────────────────────────────────────────────────────

const CLOCK_SIZE = 240;                  // px — diameter of the clock face div
const CENTER     = CLOCK_SIZE / 2;       // 120
const NUM_R      = 84;                   // px — radius where numbers sit

const HOURS   = [12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

const ACCENT       = "#6366F1";                  // provider indigo
const ACCENT_LIGHT = "rgba(99,102,241,0.12)";

// ── Geometry helpers ──────────────────────────────────────────────────────────

/** idx 0 = 12 o'clock (top), clockwise */
const angleRad = (idx: number) => ((idx / 12) * 360 - 90) * (Math.PI / 180);
const numPos   = (idx: number) => ({
  x: CENTER + NUM_R * Math.cos(angleRad(idx)),
  y: CENTER + NUM_R * Math.sin(angleRad(idx)),
});

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = "hours" | "minutes";

interface Props {
  value:    string;                    // "HH:MM" 24-hour
  onChange: (value: string) => void;
}

// ── Conversion helpers ────────────────────────────────────────────────────────

const parse24 = (v: string) => {
  const [h, m] = v.split(":").map(Number);
  return { h24: h, m, isPM: h >= 12, h12: h === 0 ? 12 : h > 12 ? h - 12 : h };
};

const to24 = (h12: number, isPM: boolean) =>
  h12 === 12 ? (isPM ? 12 : 0) : isPM ? h12 + 12 : h12;

// ── Component ─────────────────────────────────────────────────────────────────

const ClockTimePicker = ({ value, onChange }: Props) => {
  const [open, setOpen]   = useState(false);
  const [mode, setMode]   = useState<Mode>("hours");
  const [h12,  setH12]    = useState(parse24(value).h12);
  const [m,    setM]      = useState(parse24(value).m);
  const [isPM, setIsPM]   = useState(parse24(value).isPM);

  // ── Open picker, reset to current value ──────────────────────────────────
  const handleOpen = () => {
    const p = parse24(value);
    setH12(p.h12); setM(p.m); setIsPM(p.isPM);
    setMode("hours");
    setOpen(true);
  };

  // ── Clock interactions ────────────────────────────────────────────────────
  const selectHour = (h: number) => {
    setH12(h);
    setTimeout(() => setMode("minutes"), 160); // auto-advance after tap
  };

  const selectMinute = (min: number) => setM(min);

  const togglePeriod = (pm: boolean) => setIsPM(pm);

  const confirm = () => {
    const h24 = to24(h12, isPM);
    onChange(`${String(h24).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    setOpen(false);
  };

  // ── Trigger display (always reflects saved value) ─────────────────────────
  const { h12: dH, m: dM, isPM: dPM } = parse24(value);
  const triggerText = `${String(dH).padStart(2, "0")}:${String(dM).padStart(2, "0")} ${dPM ? "PM" : "AM"}`;

  // ── Clock face geometry for selected item ─────────────────────────────────
  const roundedM   = Math.round(m / 5) * 5 % 60;
  const selHIdx    = HOURS.indexOf(h12);
  const selMIdx    = MINUTES.indexOf(roundedM);
  const selIdx     = mode === "hours" ? selHIdx : selMIdx;
  const selPos     = numPos(Math.max(selIdx, 0));

  const items      = mode === "hours" ? HOURS : MINUTES;
  const isSelected = (val: number) =>
    mode === "hours" ? val === h12 : val === roundedM;

  return (
    <>
      {/* ── Trigger button ─────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={handleOpen}
        className="flex h-10 w-full items-center justify-center rounded-lg border border-border bg-background text-sm font-semibold transition-colors hover:bg-muted active:scale-[0.98]"
      >
        {triggerText}
      </button>

      {/* ── Clock picker sheet ─────────────────────────────────────────── */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl px-0 pb-0">
          <SheetHeader className="px-5 pb-3 pt-1">
            <SheetTitle className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Select time
            </SheetTitle>
          </SheetHeader>

          {/* ── HH : MM  +  AM / PM ──────────────────────────────────── */}
          <div className="flex items-center justify-between px-5 pb-5">
            {/* Hour / minute display */}
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setMode("hours")}
                className="flex h-16 w-[72px] items-center justify-center rounded-xl text-4xl font-bold transition-colors"
                style={{
                  background: mode === "hours" ? ACCENT_LIGHT : "oklch(0.94 0 0)",
                  color:      mode === "hours" ? ACCENT        : "#1E293B",
                }}
              >
                {String(h12).padStart(2, "0")}
              </button>

              <span className="text-4xl font-bold text-muted-foreground select-none">:</span>

              <button
                type="button"
                onClick={() => setMode("minutes")}
                className="flex h-16 w-[72px] items-center justify-center rounded-xl text-4xl font-bold transition-colors"
                style={{
                  background: mode === "minutes" ? ACCENT_LIGHT : "oklch(0.94 0 0)",
                  color:      mode === "minutes" ? ACCENT        : "#1E293B",
                }}
              >
                {String(m).padStart(2, "0")}
              </button>
            </div>

            {/* AM / PM stack */}
            <div className="flex flex-col overflow-hidden rounded-xl border border-border">
              {(["AM", "PM"] as const).map((p) => {
                const active = p === "AM" ? !isPM : isPM;
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => togglePeriod(p === "PM")}
                    className="px-5 py-2.5 text-sm font-semibold transition-colors"
                    style={{
                      background: active ? ACCENT_LIGHT : "transparent",
                      color:      active ? ACCENT        : "#94A3B8",
                    }}
                  >
                    {p}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Clock face ───────────────────────────────────────────── */}
          <div className="flex justify-center pb-5">
            <div
              className="relative rounded-full"
              style={{ width: CLOCK_SIZE, height: CLOCK_SIZE, background: "oklch(0.94 0 0)" }}
            >
              {/* Hand + selection highlight */}
              <svg
                width={CLOCK_SIZE}
                height={CLOCK_SIZE}
                className="absolute inset-0 pointer-events-none"
              >
                <line
                  x1={CENTER} y1={CENTER}
                  x2={selPos.x} y2={selPos.y}
                  stroke={ACCENT} strokeWidth={2}
                />
                <circle cx={CENTER}     cy={CENTER}     r={4}  fill={ACCENT} />
                {selIdx >= 0 && (
                  <circle cx={selPos.x} cy={selPos.y}   r={18} fill={ACCENT} />
                )}
              </svg>

              {/* Hour / minute number buttons */}
              {items.map((val, idx) => {
                const pos = numPos(idx);
                const sel = isSelected(val);
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() =>
                      mode === "hours" ? selectHour(val) : selectMinute(val)
                    }
                    style={{
                      position:      "absolute",
                      left:          pos.x - 18,
                      top:           pos.y - 18,
                      width:         36,
                      height:        36,
                      borderRadius:  "50%",
                      display:       "flex",
                      alignItems:    "center",
                      justifyContent:"center",
                      fontSize:      "13px",
                      fontWeight:    600,
                      color:         sel ? "#fff" : "#1E293B",
                      background:    "transparent",
                      border:        "none",
                      cursor:        "pointer",
                      zIndex:        2,
                      lineHeight:    1,
                    }}
                  >
                    {mode === "hours"
                      ? val
                      : String(val).padStart(2, "0")}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── Actions ──────────────────────────────────────────────── */}
          <div className="flex items-center justify-end gap-1 border-t border-border px-5 py-3">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirm}
              className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted"
              style={{ color: ACCENT }}
            >
              OK
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

ClockTimePicker.displayName = "ClockTimePicker";

export default ClockTimePicker;
