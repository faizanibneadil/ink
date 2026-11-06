/** Cover photo position (`notes.coverPosition`): percent from the top, used as `object-position: center <n>%`. */
export const COVER_POSITION_MIN = 0
export const COVER_POSITION_MAX = 100
export const COVER_POSITION_DEFAULT = 50

/** A saved position as a safe number in 0–100 (old / missing / bad values fall back to the middle). */
export const normalizeCoverPosition = (value: unknown): number => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        return COVER_POSITION_DEFAULT
    }
    return Math.min(COVER_POSITION_MAX, Math.max(COVER_POSITION_MIN, value))
}
