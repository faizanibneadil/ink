'use client'

import type { AutosaveSnapshot } from './autosaver'

import './save-status.css'

const LABELS: Record<AutosaveSnapshot['status'], string> = {
    error: "Couldn't save",
    idle: '',
    pending: 'Unsaved changes',
    saved: 'Saved',
    saving: 'Saving…',
}

/** Small Notion-style save status in the top-right corner of the note page editor. */
export const SaveStatus: React.FC<{ onRetry: () => void; snapshot: AutosaveSnapshot }> = ({ onRetry, snapshot }) => {
    const { error, status } = snapshot
    return (
        <div
            aria-live="polite"
            className={`note-save-status note-save-status--${status}`}
            data-state={status}
            data-testid="note-save-status"
            role="status"
        >
            {status === 'error' ? (
                <>
                    <span title={error ?? undefined}>{error || LABELS.error}</span>
                    <button className="note-save-status__retry" onClick={onRetry} type="button">
                        Retry
                    </button>
                </>
            ) : (
                LABELS[status]
            )}
        </div>
    )
}
