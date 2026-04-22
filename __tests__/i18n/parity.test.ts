import * as fs from 'fs';
import * as path from 'path';

const dictionariesPath = path.join(__dirname, '../../lib/i18n/dictionaries');
const locales = ['en', 'fr'];
const namespaces = ['common', 'booking', 'admin', 'userPanel', 'notifications', 'dashboard', 'staffNotifications'];

function getKeys(obj: unknown, prefix = ''): string[] {
  if (obj === null || obj === undefined) return [];
  if (typeof obj !== 'object') return [];

  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) {
      keys.push(fullKey);
    } else if (typeof v === 'object' && v !== null) {
      keys.push(fullKey);
      keys.push(...getKeys(v, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function getArrayLengths(obj: unknown, prefix = ''): Record<string, number> {
  if (obj === null || obj === undefined) return {};
  if (typeof obj !== 'object') return {};

  const lengths: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (Array.isArray(v)) {
      lengths[fullKey] = v.length;
    } else if (typeof v === 'object' && v !== null) {
      Object.assign(lengths, getArrayLengths(v, fullKey));
    }
  }
  return lengths;
}

describe('i18n parity', () => {
  for (const ns of namespaces) {
    describe(`${ns} namespace`, () => {
      for (const locale of locales) {
        test(`${locale}/${ns}.json exists`, () => {
          const filePath = path.join(dictionariesPath, locale, `${ns}.json`);
          expect(fs.existsSync(filePath)).toBe(true);
        });
      }

      const enFilePath = path.join(dictionariesPath, 'en', `${ns}.json`);
      const frFilePath = path.join(dictionariesPath, 'fr', `${ns}.json`);

      if (fs.existsSync(enFilePath) && fs.existsSync(frFilePath)) {
        const enData = JSON.parse(fs.readFileSync(enFilePath, 'utf-8'));
        const frData = JSON.parse(fs.readFileSync(frFilePath, 'utf-8'));

        const enKeys = new Set(getKeys(enData));
        const frKeys = new Set(getKeys(frData));

        test(`${ns}: FR has all EN keys`, () => {
          const missing = [...enKeys].filter(k => !frKeys.has(k));
          expect(missing).toHaveLength(0);
        });

        test(`${ns}: EN has all FR keys`, () => {
          const extra = [...frKeys].filter(k => !enKeys.has(k));
          expect(extra).toHaveLength(0);
        });

        const enArrayLengths = getArrayLengths(enData);
        const frArrayLengths = getArrayLengths(frData);

        const allArrayKeys = new Set([...Object.keys(enArrayLengths), ...Object.keys(frArrayLengths)]);

        for (const arrayKey of allArrayKeys) {
          test(`${ns}: array length match for ${arrayKey}`, () => {
            const enLen = enArrayLengths[arrayKey] ?? 0;
            const frLen = frArrayLengths[arrayKey] ?? 0;
            expect(enLen).toBe(frLen);
          });
        }

        test(`${ns}: both files are valid JSON`, () => {
          expect(() => JSON.parse(fs.readFileSync(enFilePath, 'utf-8'))).not.toThrow();
          expect(() => JSON.parse(fs.readFileSync(frFilePath, 'utf-8'))).not.toThrow();
        });
      }
    });
  }
});