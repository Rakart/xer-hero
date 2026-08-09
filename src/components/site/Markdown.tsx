import type { Block, Inline } from './markdown'
import { parseMarkdown } from './markdown'

/**
 * The block AST of `./markdown` rendered as JSX. A server component with no client
 * JavaScript at all — the legal pages carry none (§7.10).
 *
 * Typography comes from the global `.prose` rules, so a legal text, `/about` and
 * `/report`'s preamble cannot drift apart.
 */

function renderInlineNode(node: Inline, index: number): React.ReactNode {
  const key = `${node.kind}-${index}`
  switch (node.kind) {
    // A bare string, not a wrapper: a `<span>` per text run would triple the DOM of a
    // legal page for nothing.
    case 'text':
      return node.text
    case 'code':
      return <code key={key}>{node.text}</code>
    case 'strong':
      return <strong key={key}>{renderInline(node.children)}</strong>
    case 'em':
      return <em key={key}>{renderInline(node.children)}</em>
    case 'link':
      return (
        <a key={key} href={node.href}>
          {renderInline(node.children)}
        </a>
      )
    default:
      return null
  }
}

function renderInline(nodes: Inline[]): React.ReactNode {
  return nodes.map(renderInlineNode)
}

function renderBlock(block: Block, index: number): React.ReactNode {
  const key = `${block.kind}-${index}`
  switch (block.kind) {
    case 'heading': {
      const children = renderInline(block.children)
      if (block.level === 1) {
        return (
          <h1 key={key} id={block.id}>
            {children}
          </h1>
        )
      }
      if (block.level === 2) {
        return (
          <h2 key={key} id={block.id}>
            {children}
          </h2>
        )
      }
      if (block.level === 3) {
        return (
          <h3 key={key} id={block.id}>
            {children}
          </h3>
        )
      }
      return (
        <h4 key={key} id={block.id}>
          {children}
        </h4>
      )
    }
    case 'paragraph':
      return <p key={key}>{renderInline(block.children)}</p>
    case 'list': {
      const items = block.items.map((item, itemIndex) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: the AST is static, built once at build time
        <li key={itemIndex}>{renderInline(item)}</li>
      ))
      return block.ordered ? <ol key={key}>{items}</ol> : <ul key={key}>{items}</ul>
    }
    case 'quote':
      return <blockquote key={key}>{block.blocks.map(renderBlock)}</blockquote>
    case 'table':
      return (
        <div key={key} className="table-scroll">
          <table>
            <thead>
              <tr>
                {block.head.map((cell, cellIndex) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static AST
                  <th key={cellIndex}>{renderInline(cell)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIndex) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static AST
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: static AST
                    <td key={cellIndex}>{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )
    case 'rule':
      return <hr key={key} />
  }
}

export function Markdown({ source }: { source: string }) {
  return <>{parseMarkdown(source).map(renderBlock)}</>
}
