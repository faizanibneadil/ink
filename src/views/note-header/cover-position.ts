import { COVER_POSITION_MAX, COVER_POSITION_MIN } from '@/collections/note-header'

/**
 * How many pixels of the cover image are hidden above + below the cover box. The image fills the box
 * (`object-fit: cover`), so it is scaled until both sides fit and the rest is cropped.
 * 0 when nothing is hidden vertically (the image is cropped left / right instead, or fits exactly).
 */
export const coverOverflow = ({
    boxHeight,
    boxWidth,
    imageHeight,
    imageWidth,
}: {
    boxHeight: number
    boxWidth: number
    imageHeight: number
    imageWidth: number
}): number => {
    if (!(boxHeight > 0 && boxWidth > 0 && imageHeight > 0 && imageWidth > 0)) return 0
    const scale = Math.max(boxWidth / imageWidth, boxHeight / imageHeight)
    return Math.max(0, imageHeight * scale - boxHeight)
}

const clamp = (value: number) => Math.min(COVER_POSITION_MAX, Math.max(COVER_POSITION_MIN, value))

/**
 * Cover position after dragging the image `deltaY` pixels (down is positive), like Notion: the image follows the
 * pointer. Dragging down shows more of the top (a smaller position). Rounded to 0.1.
 */
export const dragCoverPosition = (start: number, deltaY: number, overflow: number): number => {
    if (overflow <= 0) return clamp(start)
    return Math.round(clamp(start - (deltaY / overflow) * 100) * 10) / 10
}

/**
 * Keyboard (slider): ArrowUp / ArrowRight raise the position 1% (10% with Shift), which moves the image up, like
 * dragging it up; ArrowDown / ArrowLeft lower it; Home / End go to the top / bottom of the image.
 */
export const stepCoverPosition = (position: number, key: string, shift: boolean): null | number => {
    const step = shift ? 10 : 1
    if (key === 'ArrowUp' || key === 'ArrowRight') return clamp(Math.round(position) + step)
    if (key === 'ArrowDown' || key === 'ArrowLeft') return clamp(Math.round(position) - step)
    if (key === 'Home') return COVER_POSITION_MIN
    if (key === 'End') return COVER_POSITION_MAX
    return null
}
