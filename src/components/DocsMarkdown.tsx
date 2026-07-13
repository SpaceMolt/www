import type { ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

/** Flatten a heading's rendered children back into plain text for the anchor id. */
function toText(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(toText).join('')
  if (typeof node === 'object' && 'props' in node) {
    return toText((node as { props: { children?: ReactNode } }).props.children)
  }
  return ''
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function Heading({ level, children }: { level: 2 | 3 | 4; children: ReactNode }) {
  const id = slugify(toText(children))
  const Tag = `h${level}` as 'h2' | 'h3' | 'h4'
  return (
    <Tag id={id}>
      <a href={`#${id}`} className="heading-anchor">
        {children}
        <span className="heading-anchor-hash" aria-hidden="true">
          #
        </span>
      </a>
    </Tag>
  )
}

/**
 * Markdown for the docs + guides articles: headings are self-linking and wide
 * tables scroll inside their own box instead of squeezing every column on a
 * phone. Callers keep owning the prose styling via `className`.
 */
export function DocsMarkdown({
  children,
  className,
}: {
  children: string
  className?: string
}) {
  return (
    <div className={className ? `docs-markdown ${className}` : 'docs-markdown'}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => <Heading level={2}>{children}</Heading>,
          h3: ({ children }) => <Heading level={3}>{children}</Heading>,
          h4: ({ children }) => <Heading level={4}>{children}</Heading>,
          table: ({ children }) => (
            <div className="table-scroll" tabIndex={0} role="region" aria-label="Table">
              <table>{children}</table>
            </div>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
