// Visual geometry for the shared angle dial. These values only describe the
// compact 48px control surface; angle semantics live in helper.ts / ~/lib/angle.
export const WHEEL_SIZE = 48
export const WHEEL_RADIUS = WHEEL_SIZE / 2
export const DOT_SIZE = 8
export const GUIDE_ARC_SPAN = 78

// Pointer and keyboard updates snap near these guide angles, but the public
// value remains a signed angle in the -180..180 range.
export const SNAP_STEP = 45
export const SNAP_THRESHOLD = 1

// Hover ticks are visual references only. They do not define extra snap points
// or change pointer hit-testing.
export const TICK_STEP = 15
export const MAJOR_TICK_STEP = 45
export const TICK_OUTER_RADIUS = WHEEL_RADIUS - 2
export const TICK_INNER_RADIUS = WHEEL_RADIUS - 4
export const MAJOR_TICK_INNER_RADIUS = WHEEL_RADIUS - 5

export const TICKS = Array.from({ length: 360 / TICK_STEP }, (_, index) => index * TICK_STEP)
