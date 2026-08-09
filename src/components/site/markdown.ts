/**
 * A markdown reader for exactly the subset the legal texts are written in.
 *
 * §4.1 fixes the dependency list, so this is not a build choice: the alternative to
 * ~200 lines here is a spec decision. The subset is small because the input is not
 * arbitrary — `docs/legal/*.md` is authored in this repo against this reader, and a
 * shipped legal file is never edited afterwards (§7.10), so the input can never drift
 * away from what is parsed here.
 *
 * Supported, and nothing else: ATX headings `#`–`####`, paragraphs, `---` rules,
 * `-` and `1.` lists, `>` blockquotes, GFM pipe tables, and inline `code`, **strong**,
 * *emphasis* and [links](…).
 *
 * Underscore emphasis is deliberately NOT supported: the legal texts name database
 * columns (`create_user`, `name_as_it_appears`) in running prose, and `_` emphasis
 * would eat them.
 *
 * This module is pure — no React, no filesystem — so it is testable in `node`.
 */

export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'code'; text: string }
  | { kind: 'strong'; children: Inline[] }
  | { kind: 'em'; children: Inline[] }
  | { kind: 'link'; href: string; children: Inline[] }

export type Block =
  | { kind: 'heading'; level: 1 | 2 | 3 | 4; id: string; children: Inline[] }
  | { kind: 'paragraph'; children: Inline[] }
  | { kind: 'list'; ordered: boolean; items: Inline[][] }
  | { kind: 'quote'; blocks: Block[] }
  | { kind: 'table'; head: Inline[][]; rows: Inline[][][] }
  | { kind: 'rule' }

/**
 * Heading anchors, so a paragraph can be linked to — which §7.18's lawyer questions and
 * the operator's takedown correspondence both need (§7.10).
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[`*[\]()]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/** The flattened text of an inline run — used for anchor ids and for OG descriptions. */
export function inlineText(children: Inline[]): string {
  return children
    .map((node) => {
      switch (node.kind) {
        case 'text':
        case 'code':
          return node.text
        default:
          return inlineText(node.children)
      }
    })
    .join('')
}

export function parseInline(source: string): Inline[] {
  const out: Inline[] = []
  let pending = ''
  let i = 0

  const flush = () => {
    if (pending) {
      out.push({ kind: 'text', text: pending })
      pending = ''
    }
  }

  while (i < source.length) {
    const char = source[i]

    if (char === '`') {
      const end = source.indexOf('`', i + 1)
      if (end > i) {
        flush()
        out.push({ kind: 'code', text: source.slice(i + 1, end) })
        i = end + 1
        continue
      }
    }

    if (char === '*' && source[i + 1] === '*') {
      const end = source.indexOf('**', i + 2)
      if (end > i) {
        flush()
        out.push({ kind: 'strong', children: parseInline(source.slice(i + 2, end)) })
        i = end + 2
        continue
      }
    }

    if (char === '*') {
      const end = source.indexOf('*', i + 1)
      if (end > i + 1) {
        flush()
        out.push({ kind: 'em', children: parseInline(source.slice(i + 1, end)) })
        i = end + 1
        continue
      }
    }

    if (char === '[') {
      const close = source.indexOf(']', i + 1)
      if (close > i && source[close + 1] === '(') {
        const paren = source.indexOf(')', close + 2)
        if (paren > close) {
          flush()
          out.push({
            kind: 'link',
            href: source.slice(close + 2, paren),
            children: parseInline(source.slice(i + 1, close)),
          })
          i = paren + 1
          continue
        }
      }
    }

    pending += char
    i += 1
  }

  flush()
  return out
}

const HEADING = /^(#{1,4})\s+(.*)$/
const RULE = /^-{3,}\s*$/
const UNORDERED = /^[-*]\s+(.*)$/
const ORDERED = /^\d+[.)]\s+(.*)$/
const TABLE_DELIMITER = /^\|?[\s:|-]+\|[\s:|-]*$/

function splitRow(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  return trimmed.split('|').map((cell) => cell.trim())
}

/**
 * HTML comments are stripped, never rendered. The legal sources carry their provenance
 * (which spec section fixed a sentence, which ticket amended it) in a comment at the top
 * of the file — in the source markdown, not in the rendered page.
 */
const HTML_COMMENT = /<!--[\s\S]*?-->/g

export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(HTML_COMMENT, '').replace(/\r\n?/g, '\n').split('\n')
  const blocks: Block[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i] ?? ''

    if (line.trim() === '') {
      i += 1
      continue
    }

    const heading = HEADING.exec(line)
    if (heading) {
      const level = heading[1]?.length as 1 | 2 | 3 | 4
      const children = parseInline((heading[2] ?? '').trim())
      blocks.push({ kind: 'heading', level, id: slugify(inlineText(children)), children })
      i += 1
      continue
    }

    if (RULE.test(line)) {
      blocks.push({ kind: 'rule' })
      i += 1
      continue
    }

    if (line.startsWith('>')) {
      const quoted: string[] = []
      while (i < lines.length && (lines[i] ?? '').startsWith('>')) {
        quoted.push((lines[i] ?? '').replace(/^>\s?/, ''))
        i += 1
      }
      blocks.push({ kind: 'quote', blocks: parseMarkdown(quoted.join('\n')) })
      continue
    }

    // A pipe table is only a table when the *second* line is the delimiter row; a lone
    // line with a `|` in it is prose.
    if (line.includes('|') && TABLE_DELIMITER.test(lines[i + 1] ?? '')) {
      const head = splitRow(line).map(parseInline)
      i += 2
      const rows: Inline[][][] = []
      while (i < lines.length && (lines[i] ?? '').includes('|')) {
        rows.push(splitRow(lines[i] ?? '').map(parseInline))
        i += 1
      }
      blocks.push({ kind: 'table', head, rows })
      continue
    }

    const listMatch = UNORDERED.exec(line) ?? ORDERED.exec(line)
    if (listMatch) {
      const ordered = UNORDERED.exec(line) === null
      const items: string[] = []
      while (i < lines.length) {
        const current = lines[i] ?? ''
        const match = ordered ? ORDERED.exec(current) : UNORDERED.exec(current)
        if (match) {
          items.push(match[1] ?? '')
          i += 1
          continue
        }
        // An indented non-empty line continues the item above — the legal texts are
        // wrapped at 100 columns, so most items are more than one source line.
        if (current.trim() !== '' && /^\s{2,}/.test(current) && items.length > 0) {
          items[items.length - 1] = `${items[items.length - 1]} ${current.trim()}`
          i += 1
          continue
        }
        break
      }
      blocks.push({ kind: 'list', ordered, items: items.map(parseInline) })
      continue
    }

    const paragraph: string[] = []
    while (i < lines.length) {
      const current = lines[i] ?? ''
      if (
        current.trim() === '' ||
        HEADING.test(current) ||
        RULE.test(current) ||
        current.startsWith('>') ||
        UNORDERED.test(current) ||
        ORDERED.test(current) ||
        (current.includes('|') && TABLE_DELIMITER.test(lines[i + 1] ?? ''))
      ) {
        break
      }
      paragraph.push(current.trim())
      i += 1
    }
    blocks.push({ kind: 'paragraph', children: parseInline(paragraph.join(' ')) })
  }

  return blocks
}

/**
 * The document's first sentence, which is what §7.16.5 puts in `og:description` for the
 * static pages. Taken from the first paragraph so the rule holds without anyone authoring
 * a second string that could drift from the page.
 */
export function firstSentence(blocks: Block[]): string {
  const paragraph = blocks.find((block) => block.kind === 'paragraph')
  if (!paragraph) return ''
  const text = inlineText(paragraph.children)
  const stop = text.search(/\.(\s|$)/)
  return stop === -1 ? text : text.slice(0, stop + 1)
}
