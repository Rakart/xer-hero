import { describe, expect, it } from 'vitest'
import { firstSentence, inlineText, parseInline, parseMarkdown, slugify } from './markdown'

describe('slugify', () => {
  it('produces linkable heading anchors', () => {
    expect(slugify('9. No warranty')).toBe('9-no-warranty')
    expect(slugify('Your **Handle**, and what other people see')).toBe(
      'your-handle-and-what-other-people-see',
    )
    expect(slugify('`create_user` and friends')).toBe('create-user-and-friends')
  })
})

describe('parseInline', () => {
  it('reads code, strong, emphasis and links', () => {
    expect(parseInline('a `b` c')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'code', text: 'b' },
      { kind: 'text', text: ' c' },
    ])
    expect(parseInline('**bold**')).toEqual([
      { kind: 'strong', children: [{ kind: 'text', text: 'bold' }] },
    ])
    expect(parseInline('*quiet*')).toEqual([
      { kind: 'em', children: [{ kind: 'text', text: 'quiet' }] },
    ])
    expect(parseInline('[Terms](/terms)')).toEqual([
      { kind: 'link', href: '/terms', children: [{ kind: 'text', text: 'Terms' }] },
    ])
  })

  it('leaves underscores alone, because column names appear in running prose', () => {
    // `_` emphasis is deliberately unsupported (§7.11 names `create_user` and
    // `name_as_it_appears` in prose; underscore emphasis would eat them).
    expect(inlineText(parseInline('`create_user`/`update_user` as one line'))).toBe(
      'create_user/update_user as one line',
    )
    expect(parseInline('name_as_it_appears_here')).toEqual([
      { kind: 'text', text: 'name_as_it_appears_here' },
    ])
  })

  it('treats an unterminated marker as literal text', () => {
    expect(parseInline('2 * 3 = 6')).toEqual([{ kind: 'text', text: '2 * 3 = 6' }])
    expect(parseInline('a `b')).toEqual([{ kind: 'text', text: 'a `b' }])
  })
})

describe('parseMarkdown', () => {
  it('reads headings with anchor ids', () => {
    expect(parseMarkdown('## 1. Who runs this site')).toEqual([
      {
        kind: 'heading',
        level: 2,
        id: '1-who-runs-this-site',
        children: [{ kind: 'text', text: '1. Who runs this site' }],
      },
    ])
  })

  it('joins a wrapped paragraph into one block', () => {
    const blocks = parseMarkdown('one line\nand its continuation\n\nnext paragraph')
    expect(blocks).toHaveLength(2)
    const first = blocks[0]
    if (first?.kind !== 'paragraph') throw new Error('expected a paragraph')
    expect(inlineText(first.children)).toBe('one line and its continuation')
  })

  it('reads unordered and ordered lists, including wrapped items', () => {
    const blocks = parseMarkdown('- first item\n  wrapped on\n- second\n')
    expect(blocks).toHaveLength(1)
    const list = blocks[0]
    if (list?.kind !== 'list') throw new Error('expected a list')
    expect(list.ordered).toBe(false)
    expect(list.items.map(inlineText)).toEqual(['first item wrapped on', 'second'])

    const ordered = parseMarkdown('1. one\n2. two')[0]
    if (ordered?.kind !== 'list') throw new Error('expected a list')
    expect(ordered.ordered).toBe(true)
    expect(ordered.items.map(inlineText)).toEqual(['one', 'two'])
  })

  it('reads a pipe table only when the delimiter row follows', () => {
    const table = parseMarkdown('| Stored | Kept until |\n| --- | --- |\n| Handle | forever |')
    expect(table).toHaveLength(1)
    const block = table[0]
    if (block?.kind !== 'table') throw new Error('expected a table')
    expect(block.head.map(inlineText)).toEqual(['Stored', 'Kept until'])
    expect(block.rows).toHaveLength(1)
    expect(block.rows[0]?.map(inlineText)).toEqual(['Handle', 'forever'])

    const prose = parseMarkdown('a | b is prose')
    expect(prose[0]?.kind).toBe('paragraph')
  })

  it('reads a blockquote as nested blocks, which is how a LAWYER block renders', () => {
    const blocks = parseMarkdown('> **LAWYER.** Not reviewed.\n>\n> Second paragraph.')
    expect(blocks).toHaveLength(1)
    const quote = blocks[0]
    if (quote?.kind !== 'quote') throw new Error('expected a quote')
    expect(quote.blocks).toHaveLength(2)
    expect(quote.blocks.every((block) => block.kind === 'paragraph')).toBe(true)
  })

  it('reads a horizontal rule', () => {
    expect(parseMarkdown('---')).toEqual([{ kind: 'rule' }])
  })
})

describe('firstSentence', () => {
  it('takes the first sentence of the first paragraph', () => {
    const blocks = parseMarkdown('## Heading\n\nThis site is xerhero.com. It is run by one person.')
    expect(firstSentence(blocks)).toBe('This site is xerhero.com.')
  })

  it('is empty when there is no paragraph', () => {
    expect(firstSentence(parseMarkdown('## Heading only'))).toBe('')
  })
})
