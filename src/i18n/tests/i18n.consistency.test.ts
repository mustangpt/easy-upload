import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..', '..');
const srcDir = path.join(repoRoot, 'src');
const i18nDir = path.join(srcDir, 'i18n');

const loadYaml = (file: string): Record<string, string> =>
  YAML.parse(fs.readFileSync(path.join(i18nDir, file), 'utf8'));

const zhKeys = new Set(Object.keys(loadYaml('zh.yaml')));
const enKeys = new Set(Object.keys(loadYaml('en.yaml')));
const koKeys = new Set(Object.keys(loadYaml('ko.yaml')));

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'tests') continue;
      walk(p, out);
    } else if (
      /\.(ts|tsx)$/.test(entry.name) &&
      !/\.test\.tsx?$/.test(entry.name)
    ) {
      out.push(p);
    }
  }
  return out;
};

// Symbolic keys look like `namespace.identifier`. We extract any literal that
// matches this shape from contexts where it would land in an I18nKey slot:
//   $t('ns.key')              — translation call
//   useState<I18nKey>('ns.key')
//   'ns.key' as I18nKey       — CONFIG.ERROR_MESSAGES style
//   setXxx('ns.key')          — setters for I18nKey state (best-effort)
//   { title|des: 'ns.key' }   — conf object literals
const symbolic = `[a-z][a-zA-Z]+\\.[a-zA-Z]+`;
const patterns: RegExp[] = [
  new RegExp(`\\$t\\(\\s*['"](${symbolic})['"]`, 'g'),
  new RegExp(`useState<I18nKey>\\([\\s\\n]*['"](${symbolic})['"]`, 'g'),
  new RegExp(`['"](${symbolic})['"]\\s+as\\s+I18nKey`, 'g'),
  new RegExp(`set[A-Z][a-zA-Z]*\\(\\s*['"](${symbolic})['"]`, 'g'),
  new RegExp(`(?:title|des)\\s*:\\s*['"](${symbolic})['"]`, 'g'),
];

const collectKeysUsedInCode = (): Set<string> => {
  const used = new Set<string>();
  for (const file of walk(srcDir)) {
    const src = fs.readFileSync(file, 'utf8');
    for (const re of patterns) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(src)) !== null) {
        used.add(m[1]);
      }
    }
  }
  return used;
};

describe('i18n consistency', () => {
  it('zh/en/ko have identical key sets', () => {
    const langs = { zh: zhKeys, en: enKeys, ko: koKeys };
    for (const [aLang, aKeys] of Object.entries(langs)) {
      for (const [bLang, bKeys] of Object.entries(langs)) {
        if (aLang === bLang) continue;
        const missing = [...aKeys].filter((k) => !bKeys.has(k));
        expect(
          missing,
          `keys in ${aLang}.yaml missing from ${bLang}.yaml: ${JSON.stringify(missing)}`,
        ).toEqual([]);
      }
    }
  });

  // Missing-keys check is enforced statically by I18nKey (= keyof zh) on $t /
  // useState<I18nKey> / `as I18nKey`. Duplicating at runtime would risk false
  // positives, so we only check the inverse direction here.
  it('every key in zh.yaml is referenced from code (no dead translations)', () => {
    const used = collectKeysUsedInCode();
    const dead = [...zhKeys].filter((k) => !used.has(k));
    expect(
      dead,
      `keys in zh.yaml that no source file references: ${JSON.stringify(dead)}`,
    ).toEqual([]);
  });
});
