// CP1252 output encoding.
//
// A .xer is CP1252, not UTF-8 (see docs/wayfinder/tickets/assets/xer-format.md).
// Generated text is ASCII apart from deliberate landmines, so the encoder only has
// to handle Latin-1 plus the CP1252 0x80-0x9F block, and pass raw bytes through
// where a fixture wants a byte that is *not* a valid CP1252 character (0x81 is the
// case that matters — real files carry it and strict decoders throw on it).

// CP1252 0x80-0x9F. Undefined slots (0x81, 0x8D, 0x8F, 0x90, 0x9D) are null.
const HIGH = [
  '€', null, '‚', 'ƒ', '„', '…', '†', '‡',
  'ˆ', '‰', 'Š', '‹', 'Œ', null, 'Ž', null,
  null, '‘', '’', '“', '”', '•', '–', '—',
  '˜', '™', 'š', '›', 'œ', null, 'ž', 'Ÿ',
];

const reverse = new Map();
HIGH.forEach((ch, i) => {
  if (ch) reverse.set(ch, 0x80 + i);
});

/**
 * Encode a JS string to CP1252 bytes.
 *
 * Characters U+0000-U+00FF map to the same byte value (this is where the
 * deliberately-invalid 0x81 gets through: write it as ''). Characters in the
 * CP1252 high block map through the table. Anything else throws rather than being
 * silently replaced — a generator that quietly mangles its own fixture is worse
 * than one that stops.
 */
export function encodeCp1252(str) {
  const out = Buffer.allocUnsafe(str.length);
  for (let i = 0; i < str.length; i++) {
    const code = str.codePointAt(i);
    if (code <= 0xff) {
      out[i] = code;
    } else if (reverse.has(str[i])) {
      out[i] = reverse.get(str[i]);
    } else {
      throw new Error(
        `not encodable as CP1252 at ${i}: U+${code.toString(16).padStart(4, '0')}`,
      );
    }
  }
  return out;
}
