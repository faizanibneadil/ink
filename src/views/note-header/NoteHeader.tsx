import type { NoteHeaderData } from './header-data'

// Notion-style page header styles (cover, icon, responsive alignment)
import './note-header.css'

const cx = (...classes: (false | null | string | undefined)[]) => classes.filter(Boolean).join(' ')

/**
 * Notion-style page header: a full-width cover photo and a rounded-square icon that overlaps its bottom edge.
 * The icon is centred on phones and left-aligned with the text on tablets and desktops (note-header.css).
 * Renders nothing when the note has neither a cover nor an icon.
 */
export const NoteHeader: React.FC<{ header: NoteHeaderData }> = ({ header }) => {
    const { cover, coverPosition, icon } = header
    if (!cover && !icon) {
        return null
    }
    return (
        <header
            className={cx('note-header', cover && 'note-header--has-cover', icon && 'note-header--has-icon')}
            data-testid="note-header"
        >
            {cover ? (
                <div className="note-header__cover" data-testid="note-cover">
                    {/* Decorative, like Notion's cover: the icon and the text carry the meaning */}
                    {/* eslint-disable-next-line @next/next/no-img-element -- media is served by Payload (local disk / R2), not next/image */}
                    <img
                        alt=""
                        className="note-header__cover-image"
                        decoding="async"
                        fetchPriority="high"
                        height={cover.height ?? undefined}
                        src={cover.url}
                        style={{ objectPosition: `center ${coverPosition}%` }}
                        width={cover.width ?? undefined}
                    />
                </div>
            ) : null}
            {icon ? (
                <div className="note-header__body">
                    <div className="note-header__icon" data-testid="note-icon">
                        {/* eslint-disable-next-line @next/next/no-img-element -- media is served by Payload (local disk / R2), not next/image */}
                        <img
                            alt={icon.alt}
                            className="note-header__icon-image"
                            decoding="async"
                            height={icon.height ?? undefined}
                            src={icon.url}
                            width={icon.width ?? undefined}
                        />
                    </div>
                </div>
            ) : null}
        </header>
    )
}
