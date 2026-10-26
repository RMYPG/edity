/// <reference types="node" />
// A web font for tests of fonts that arrive late, made here so the tests
// need no font file: a TrueType font in which every Latin character is a
// blank one em wide, much wider than any system font's, so text set in it
// takes more lines.

/** The font, as a `font/ttf` response body. */
export function wideFont(): Buffer {
  // The characters it has: Basic Latin, Latin-1 and Latin Extended-A, which
  // take in Spanish.
  const ranges = [
    [0x20, 0x7e],
    [0xa0, 0x17f],
  ] as const;
  const glyphs = 1 + ranges.reduce((sum, [from, to]) => sum + to - from + 1, 0);
  const em = 1000;

  // Glyph 0, the one for missing characters, is a box; the others are empty.
  const box = table((t) => {
    t.i16(1); // one contour
    t.i16(100).i16(0).i16(900).i16(700); // its bounds
    t.u16(3); // its last point
    t.u16(0); // no instructions
    for (let point = 0; point < 4; point++) t.u8(1); // on the curve
    t.i16(100).i16(800).i16(0).i16(-800); // x, as steps
    t.i16(0).i16(0).i16(700).i16(0); // y, as steps
  });

  const tables: Record<string, Buffer> = {
    'OS/2': table((t) => {
      t.u16(4).i16(em).u16(400).u16(5).u16(0);
      t.i16(650).i16(600).i16(0).i16(75); // subscripts
      t.i16(650).i16(600).i16(0).i16(350); // superscripts
      t.i16(50).i16(300); // strikeout
      t.i16(0);
      for (let byte = 0; byte < 10; byte++) t.u8(0); // PANOSE
      t.u32(0b111).u32(0).u32(0).u32(0); // Unicode ranges
      t.tag('NONE');
      t.u16(0x40); // regular
      t.u16(ranges[0][0]).u16(ranges.at(-1)![1]);
      t.i16(800).i16(-200).i16(0); // typographic ascender, descender, gap
      t.u16(800).u16(200); // Windows ascent and descent
      t.u32(1).u32(0); // code pages: Latin 1
      t.i16(500).i16(700).u16(0).u16(0x20).u16(1);
    }),
    cmap: table((t) => {
      // Format 4, one segment per range and the last one it requires.
      const segments = ranges.length + 1;
      const power = 2 ** Math.floor(Math.log2(segments));
      t.u16(0).u16(1).u16(3).u16(1).u32(12);
      t.u16(4)
        .u16(16 + 8 * segments)
        .u16(0)
        .u16(segments * 2);
      t.u16(power * 2)
        .u16(Math.log2(power))
        .u16(segments * 2 - power * 2);
      for (const [, to] of ranges) t.u16(to);
      t.u16(0xffff).u16(0);
      for (const [from] of ranges) t.u16(from);
      t.u16(0xffff);
      let glyph = 1;
      for (const [from, to] of ranges) {
        t.u16((glyph - from) & 0xffff);
        glyph += to - from + 1;
      }
      t.u16(1);
      for (let segment = 0; segment < segments; segment++) t.u16(0);
    }),
    glyf: box,
    head: table((t) => {
      t.u16(1).u16(0).u32(0x10000);
      t.u32(0); // checksum adjustment, set below
      t.u32(0x5f0f3cf5).u16(0b11).u16(em);
      t.u32(0).u32(0).u32(0).u32(0); // created, modified
      t.i16(0).i16(-200).i16(em).i16(800);
      t.u16(0).u16(8).i16(2);
      t.i16(0); // short offsets in loca
      t.i16(0);
    }),
    hhea: table((t) => {
      t.u16(1).u16(0).i16(800).i16(-200).i16(0);
      t.u16(em).i16(0).i16(0).i16(900);
      t.i16(1).i16(0).i16(0);
      t.i16(0).i16(0).i16(0).i16(0);
      t.i16(0).u16(1); // one advance width for every glyph
    }),
    hmtx: table((t) => {
      t.u16(em).i16(100);
      for (let glyph = 1; glyph < glyphs; glyph++) t.i16(0);
    }),
    loca: table((t) => {
      t.u16(0);
      for (let glyph = 0; glyph < glyphs; glyph++) t.u16(box.length / 2);
    }),
    maxp: table((t) => {
      t.u32(0x10000).u16(glyphs).u16(4).u16(1).u16(0).u16(0).u16(2);
      for (let field = 0; field < 8; field++) t.u16(0);
    }),
    name: table((t) => {
      const names = [
        'Edity Wide',
        'Regular',
        'Edity Wide',
        'Edity Wide',
        'Version 1.0',
        'EdityWide',
      ].map((text) => Buffer.from(text, 'utf16le').swap16());
      t.u16(0)
        .u16(names.length)
        .u16(6 + 12 * names.length);
      let offset = 0;
      names.forEach((text, at) => {
        t.u16(3)
          .u16(1)
          .u16(0x409)
          .u16(at + 1)
          .u16(text.length)
          .u16(offset);
        offset += text.length;
      });
      for (const text of names) t.bytes(text);
    }),
    post: table((t) => {
      t.u32(0x30000).u32(0).i16(-100).i16(50).u32(1);
      t.u32(0).u32(0).u32(0).u32(0);
    }),
  };

  const tags = Object.keys(tables).sort();
  const power = 2 ** Math.floor(Math.log2(tags.length));
  let offset = 12 + 16 * tags.length;
  const directory = table((t) => {
    t.u32(0x10000)
      .u16(tags.length)
      .u16(power * 16)
      .u16(Math.log2(power));
    t.u16(tags.length * 16 - power * 16);
    for (const tag of tags) {
      const data = tables[tag]!;
      t.tag(tag).u32(checksum(data)).u32(offset).u32(data.length);
      offset += padded(data.length);
    }
  });
  const font = Buffer.concat([
    directory,
    ...tags.map((tag) => {
      const data = tables[tag]!;
      return Buffer.concat([
        data,
        Buffer.alloc(padded(data.length) - data.length),
      ]);
    }),
  ]);
  const head =
    12 +
    16 * tags.length +
    tags
      .slice(0, tags.indexOf('head'))
      .reduce((sum, tag) => sum + padded(tables[tag]!.length), 0);
  font.writeUInt32BE((0xb1b0afba - checksum(font)) >>> 0, head + 8);
  return font;
}

interface Writer {
  u8(value: number): Writer;
  u16(value: number): Writer;
  i16(value: number): Writer;
  u32(value: number): Writer;
  tag(value: string): Writer;
  bytes(value: Buffer): Writer;
}

/** The bytes `write` writes, big-endian as fonts are. */
function table(write: (writer: Writer) => void): Buffer {
  const parts: Buffer[] = [];
  const push = (size: number, set: (buffer: Buffer) => void) => {
    const buffer = Buffer.alloc(size);
    set(buffer);
    parts.push(buffer);
    return writer;
  };
  const writer: Writer = {
    u8: (value) => push(1, (b) => b.writeUInt8(value)),
    u16: (value) => push(2, (b) => b.writeUInt16BE(value)),
    i16: (value) => push(2, (b) => b.writeInt16BE(value)),
    u32: (value) => push(4, (b) => b.writeUInt32BE(value >>> 0)),
    tag: (value) => push(4, (b) => b.write(value, 'latin1')),
    bytes: (value) => push(value.length, (b) => value.copy(b)),
  };
  write(writer);
  return Buffer.concat(parts);
}

function padded(length: number): number {
  return Math.ceil(length / 4) * 4;
}

function checksum(data: Buffer): number {
  const words = Buffer.concat([
    data,
    Buffer.alloc(padded(data.length) - data.length),
  ]);
  let sum = 0;
  for (let at = 0; at < words.length; at += 4) {
    sum = (sum + words.readUInt32BE(at)) >>> 0;
  }
  return sum;
}
