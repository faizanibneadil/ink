import { describe, expect, it } from 'vitest'

import { coverOverflow, dragCoverPosition, stepCoverPosition } from '@/views/note-header/cover-position'

describe('coverOverflow (object-fit: cover)', () => {
  it('a wide image in a wide box: the extra height is hidden', () => {
    // 1200×600 image in a 1280×280 box: scaled to 1280×640, 360px hidden
    expect(coverOverflow({ boxHeight: 280, boxWidth: 1280, imageHeight: 600, imageWidth: 1200 })).toBe(360)
  })

  it('a very wide image is cropped left / right: nothing to move vertically', () => {
    expect(coverOverflow({ boxHeight: 280, boxWidth: 390, imageHeight: 100, imageWidth: 2000 })).toBe(0)
  })

  it('not loaded yet / no size: 0', () => {
    expect(coverOverflow({ boxHeight: 280, boxWidth: 1280, imageHeight: 0, imageWidth: 0 })).toBe(0)
    expect(coverOverflow({ boxHeight: 0, boxWidth: 0, imageHeight: 600, imageWidth: 1200 })).toBe(0)
  })
})

describe('dragCoverPosition', () => {
  it('the image follows the pointer: dragging up shows more of the bottom', () => {
    // 360px hidden: dragging up 36px moves 10%
    expect(dragCoverPosition(50, -36, 360)).toBe(60)
    expect(dragCoverPosition(50, 36, 360)).toBe(40)
    expect(dragCoverPosition(50, 0, 360)).toBe(50)
  })

  it('stays within 0–100', () => {
    expect(dragCoverPosition(50, -10_000, 360)).toBe(100)
    expect(dragCoverPosition(50, 10_000, 360)).toBe(0)
  })

  it('nothing hidden vertically: the position does not move', () => {
    expect(dragCoverPosition(30, -100, 0)).toBe(30)
  })

  it('rounded to 0.1', () => {
    expect(dragCoverPosition(50, -10, 360)).toBe(52.8)
  })
})

describe('stepCoverPosition (keyboard)', () => {
  it('arrows move 1%, with Shift 10%; Home / End go to the ends', () => {
    expect(stepCoverPosition(50, 'ArrowUp', false)).toBe(51)
    expect(stepCoverPosition(50, 'ArrowRight', false)).toBe(51)
    expect(stepCoverPosition(50, 'ArrowDown', false)).toBe(49)
    expect(stepCoverPosition(50, 'ArrowLeft', true)).toBe(40)
    expect(stepCoverPosition(95, 'ArrowUp', true)).toBe(100)
    expect(stepCoverPosition(3, 'ArrowDown', true)).toBe(0)
    expect(stepCoverPosition(50, 'Home', false)).toBe(0)
    expect(stepCoverPosition(50, 'End', false)).toBe(100)
  })

  it('other keys: no change', () => {
    expect(stepCoverPosition(50, 'a', false)).toBeNull()
    expect(stepCoverPosition(50, 'Tab', false)).toBeNull()
  })
})
