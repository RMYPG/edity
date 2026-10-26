import { describe, expect, test } from 'vitest';
import {
  fieldValue,
  isNumberText,
  numberFormat,
  numberValue,
  oneLine,
  pastedNumber,
  pastedText,
} from './values.js';

const text = { kind: 'text', limits: { maxChars: 60 } } as const;
const price = {
  kind: 'number',
  limits: { min: 0, max: 500, decimals: 2 },
} as const;
const count = {
  kind: 'number',
  limits: { min: 0, max: 1_000_000, decimals: 0 },
} as const;

describe('fieldValue of a text Field (E3)', () => {
  test('is the text on one line, with single spaces and no spaces at the ends', () => {
    expect(fieldValue(text, '  Fisioterapia\nen  casa\r\n')).toBe(
      'Fisioterapia en casa',
    );
    expect(fieldValue(text, 'Uno\u2028dos\u2029tres\tcuatro')).toBe(
      'Uno dos tres cuatro',
    );
  });

  test('turns the non-breaking spaces browsers type into plain ones', () => {
    expect(fieldValue(text, 'Hola\u00a0 mundo\u00a0')).toBe('Hola mundo');
  });

  test('keeps every other character, accents and emoji included', () => {
    expect(fieldValue(text, 'Rehabilitación tras cirugía 🦴')).toBe(
      'Rehabilitación tras cirugía 🦴',
    );
  });

  test('is empty for a Field left blank', () => {
    expect(fieldValue(text, '')).toBe('');
    expect(fieldValue(text, ' \u00a0 ')).toBe('');
  });
});

describe('fieldValue of a number Field (E5)', () => {
  test('is the number, read with a comma or a dot as the decimal separator', () => {
    expect(fieldValue(price, '40,5')).toBe(40.5);
    expect(fieldValue(price, '40.5')).toBe(40.5);
    expect(fieldValue(price, '40,')).toBe(40);
    expect(fieldValue(price, ',5')).toBe(0.5);
    expect(fieldValue(count, '0012000')).toBe(12000);
  });

  test('is the text itself when it is not a number', () => {
    expect(fieldValue(price, '')).toBe('');
    expect(fieldValue(price, ',')).toBe(',');
  });

  test('is the text itself when it has more digits after the separator than the Field allows', () => {
    // A Client in Spain who types 13.000 means thirteen thousand.
    expect(fieldValue(count, '13.000')).toBe('13.000');
    expect(fieldValue(count, '13,5')).toBe('13,5');
    expect(fieldValue(price, '1.000')).toBe('1.000');
    expect(fieldValue(price, '19,990')).toBe('19,990');
    expect(fieldValue(count, '13,')).toBe(13);
  });
});

describe('numberValue', () => {
  test('is undefined for text that is not a number with at most the decimals given', () => {
    expect(numberValue('', 2)).toBeUndefined();
    expect(numberValue('.', 2)).toBeUndefined();
    expect(numberValue('1,2,3', 2)).toBeUndefined();
    expect(numberValue('-1', 2)).toBeUndefined();
    expect(numberValue('1e3', 2)).toBeUndefined();
    expect(numberValue('12,34', 2)).toBe(12.34);
  });

  test('is undefined for digits too many for a number, which would be Infinity', () => {
    expect(numberValue('9'.repeat(309), 0)).toBeUndefined();
    expect(numberValue('9'.repeat(308), 0)).toBe(Number('9'.repeat(308)));
  });
});

describe('fieldValue of a number Field', () => {
  test('keeps digits too many for a number as the text typed, which JSON can hold', () => {
    const typed = '9'.repeat(309);

    expect(fieldValue(count, typed)).toBe(typed);
    expect(
      JSON.parse(JSON.stringify({ after: fieldValue(count, typed) })),
    ).toEqual({
      after: typed,
    });
  });
});

describe('isNumberText (E5)', () => {
  test('accepts digits with at most one comma or dot, on the way to a number', () => {
    for (const ok of ['', '1', '12,', ',5', '12.5', '12,345', '.']) {
      expect(isNumberText(ok), ok).toBe(true);
    }
  });

  test('rejects anything else', () => {
    for (const bad of ['12,3.4', '1a', '-1', ' 1', '1 000', '1e3', 'á']) {
      expect(isNumberText(bad), bad).toBe(false);
    }
  });
});

describe('oneLine', () => {
  test('turns each line break into a space, one for one, so offsets keep', () => {
    expect(oneLine('a\nb\r\nc\u2028d\u2029e')).toBe('a b  c d e');
    expect(oneLine('sin saltos')).toBe('sin saltos');
  });
});

describe('pastedText (E3)', () => {
  test('puts pasted lines on one line with single spaces', () => {
    expect(pastedText('Uno\nDos  tres')).toBe('Uno Dos tres');
    expect(pastedText('\r\nUno\r\n\r\nDos\n')).toBe('Uno Dos');
  });

  test('keeps a space at the ends, where it separates words', () => {
    expect(pastedText(' dos ')).toBe(' dos ');
  });
});

describe('pastedNumber (E5)', () => {
  test('keeps only digits and a decimal separator', () => {
    expect(pastedNumber('35 €', 2)).toBe('35');
    expect(pastedNumber('Precio: 19,99 €', 2)).toBe('19,99');
    expect(pastedNumber('-5', 0)).toBe('5');
    expect(pastedNumber('Uno', 0)).toBe('');
  });

  test('drops thousands separators, in either convention', () => {
    expect(pastedNumber('1.234,56', 2)).toBe('1234,56');
    expect(pastedNumber('1,234.56', 2)).toBe('1234.56');
    expect(pastedNumber('1.234.567', 0)).toBe('1234567');
    expect(pastedNumber('12\u202f000,50', 2)).toBe('12000,50');
  });

  test('reads one separator before three digits as thousands when the Field has fewer decimals', () => {
    expect(pastedNumber('12.000', 0)).toBe('12000');
    expect(pastedNumber('12,000', 2)).toBe('12000');
    expect(pastedNumber('1.234', 3)).toBe('1.234');
    expect(pastedNumber('3.5', 1)).toBe('3.5');
  });
});

describe('numberFormat', () => {
  test('formats like the template did, found from a value it showed', () => {
    const euros = numberFormat('es-ES', { text: '35,00', value: 35 });
    expect(euros.format(40.5)).toBe('40,50');
    expect(euros.format(40)).toBe('40,00');
    expect(euros.format(19.99)).toBe('19,99');

    const patients = numberFormat('es-ES', { text: '12.000', value: 12000 });
    expect(patients.format(13000)).toBe('13.000');
    expect(patients.format(120005)).toBe('120.005');
  });

  test('never rounds away digits the Client typed', () => {
    const euros = numberFormat('es-ES', { text: '35,00', value: 35 });
    expect(euros.format(40.555)).toBe('40,555');
    expect(euros.format(0.1 + 0.2)).toBe('0,30000000000000004');
  });

  test('works for templates that print the number as it is, or in another locale', () => {
    const raw = numberFormat('es-ES', { text: '19.99', value: 19.99 });
    expect(raw.format(20.5)).toBe('20.50');

    const dollars = numberFormat('en-US', { text: '1,234.50', value: 1234.5 });
    expect(dollars.format(12.5)).toBe('12.50');
    expect(dollars.editable('1,234.50')).toBe('1234.50');

    const french = numberFormat('fr-FR', { text: '12\u202f000', value: 12000 });
    expect(french.format(13000)).toBe('13\u202f000');
    expect(french.editable('12\u202f000')).toBe('12000');
  });

  test('edits the shown text without thousands separators', () => {
    expect(
      numberFormat('es-ES', { text: '12.000', value: 12000 }).editable(
        '12.000',
      ),
    ).toBe('12000');
    expect(
      numberFormat('es-ES', { text: '35,00', value: 35 }).editable('35,00'),
    ).toBe('35,00');
  });

  test('without a match, uses the locale with no thousands separators', () => {
    const unknown = numberFormat('es-ES', { text: '35 €', value: 35 });
    expect(unknown.format(1234.5)).toBe('1234,5');
    expect(numberFormat('es', undefined).format(12000)).toBe('12000');
    expect(numberFormat('not a locale', undefined).format(1.5)).toBe('1.5');
  });
});
