/**
 * The shape `SegmentedPill` takes, shared by all three platform
 * implementations (`.ios.tsx`, `.android.tsx`, and the plain `.tsx` that
 * Metro resolves for web).
 *
 * Kept in its own module, and a `.ts` rather than `.tsx`, so importing the
 * type never drags a platform's native UI library into another platform's
 * bundle.
 */
export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  /** Shown after the label, e.g. how many items the segment holds. */
  count?: number;
};

export type SegmentedPillProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
};

/** `"ראיתי"` → `"ראיתי (3)"`. Shared so the three platforms label alike. */
export function segmentLabel<T extends string>(option: SegmentedOption<T>): string {
  return option.count !== undefined ? `${option.label} (${option.count})` : option.label;
}

/**
 * How tall the control stands, and how wide it is allowed to get.
 *
 * Shared across the three platform files so the control doesn't change size
 * when you pick up a different phone. The max width keeps it from stretching
 * edge-to-edge on a tablet or on web, where a full-bleed two-segment control
 * reads as a toolbar rather than a toggle — it stays centred instead.
 */
export const SEGMENTED_HEIGHT = 52;
export const SEGMENTED_MAX_WIDTH = 420;
