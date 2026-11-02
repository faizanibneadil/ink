'use client'

import React from 'react'

/** Toolbar / slash menu icon (same size and style as Payload's Lexical icons). */
export const DrawingIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg
        aria-hidden="true"
        className={['icon', className].filter(Boolean).join(' ')}
        fill="none"
        focusable="false"
        height={24}
        viewBox="0 0 24 24"
        width={24}
        xmlns="http://www.w3.org/2000/svg"
    >
        {/* Pencil */}
        <path
            d="M14.6 6.4l3 3M7 17l.8-3.2 7.5-7.5a1.4 1.4 0 0 1 2 0l.4.4a1.4 1.4 0 0 1 0 2l-7.5 7.5L7 17z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
        />
        {/* Squiggle */}
        <path d="M5 20c1.5-1 3-1 4.5 0s3 1 4.5 0" stroke="currentColor" strokeLinecap="round" />
    </svg>
)
