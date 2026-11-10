'use client'

import { useEffect, useRef, useState } from 'react'

import { copyText } from '../shared/copyText'

const cx = (...classes: (0 | false | null | string | undefined)[]) => classes.filter(Boolean).join(' ')

export const CopyIcon = () => (
    <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" viewBox="0 0 24 24" width="14">
        <rect height="13" rx="2" width="13" x="9" y="9" />
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
)

export const CheckIcon = () => (
    <svg aria-hidden="true" fill="none" height="14" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" viewBox="0 0 24 24" width="14">
        <path d="M20 6 9 17l-5-5" />
    </svg>
)

/**
 * Copy button of the read-only code block (./CodeBlockView.tsx). The only interactive part of the block, so the only
 * part that ships to the browser on the guest note page: the highlighted code is rendered on the server.
 */
export const CopyButton: React.FC<{ code: string }> = ({ code }) => {
    const [copied, setCopied] = useState(false)
    const timeout = useRef<ReturnType<typeof setTimeout>>(undefined)

    useEffect(() => () => clearTimeout(timeout.current), [])

    const onCopy = async () => {
        try {
            await copyText(code)
            setCopied(true)
            clearTimeout(timeout.current)
            timeout.current = setTimeout(() => setCopied(false), 2000)
        } catch {
            // Clipboard blocked: leave the button as it is
        }
    }

    return (
        <button
            aria-label={copied ? 'Copied' : 'Copy code'}
            className={cx('note-view__codeblock-copy', copied && 'note-view__codeblock-copy--copied')}
            onClick={onCopy}
            type="button"
        >
            {copied ? <CheckIcon /> : <CopyIcon />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
        </button>
    )
}
