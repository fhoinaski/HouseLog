import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOTS = [
  'SYSTEM_CONTEXT.md',
  'AGENTS.md',
  'HOUSELOG_EXECUTION_MASTERPLAN.md',
  'house-log-front/AGENTS.md',
  'house-log-front/DESIGN.md',
  'house-log-front/src',
  'docs',
  'packages/contracts',
];

const TEXT_FILE_PATTERN = /\.(css|js|jsx|json|md|mjs|ts|tsx)$/;
const MOJIBAKE_PATTERN =
  /[\u00c2-\u00c5][\u0080-\u00bf]|\u00e2[\u0080-\u00bf\u20ac][\u0080-\u00bf\u2018-\u201d]|\u00ef\u00bf\u00bd|\u00f0\u0178/g;

function collectFiles(path) {
  const stat = statSync(path);
  if (!stat.isDirectory()) return TEXT_FILE_PATTERN.test(path) ? [path] : [];

  return readdirSync(path)
    .filter((entry) => !['node_modules', '.next', 'dist', 'build', '.git'].includes(entry))
    .flatMap((entry) => collectFiles(join(path, entry)));
}

const findings = [];

for (const root of ROOTS) {
  for (const file of collectFiles(root)) {
    const content = readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);

    for (const [index, line] of lines.entries()) {
      const matches = line.match(MOJIBAKE_PATTERN);
      if (matches) {
        findings.push({
          file,
          line: index + 1,
          matches: [...new Set(matches)],
          preview: line.trim().slice(0, 160),
        });
      }
    }
  }
}

if (findings.length > 0) {
  console.error('Possiveis textos com encoding corrompido encontrados:');
  for (const finding of findings) {
    console.error(`${finding.file}:${finding.line} ${finding.matches.join(', ')} :: ${finding.preview}`);
  }
  process.exit(1);
}

console.log('Encoding check OK: nenhuma sequencia critica de mojibake encontrada.');
