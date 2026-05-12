import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const WRANGLER_PATH = 'house-log-back/apps/api/wrangler.toml';
const PRODUCTION_READY = process.argv.includes('--production-ready');
const content = readFileSync(WRANGLER_PATH, 'utf8');

const errors = [];
const warnings = [];

function matchOne(pattern, label) {
  const match = content.match(pattern);
  if (!match?.[1]) {
    errors.push(`Nao foi possivel localizar ${label} em ${WRANGLER_PATH}.`);
    return '';
  }
  return match[1];
}

function sectionBetween(startPattern, endPattern) {
  const startMatch = content.match(startPattern);
  const start = startMatch?.index ?? -1;
  if (start < 0) return '';
  const rest = content.slice(start + (startMatch?.[0].length ?? 0));
  const end = rest.search(endPattern);
  return end < 0 ? rest : rest.slice(0, end);
}

function quotedValue(section, key) {
  const match = section.match(new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, 'm'));
  return match?.[1] ?? '';
}

function hasQuotedKey(section, key) {
  return new RegExp(`^${key}\\s*=\\s*"([^"]*)"`, 'm').test(section);
}

function queueNames(section, table) {
  const names = [];
  const escaped = table.replaceAll('.', '\\.');
  const blockPattern = new RegExp(`\\[\\[${escaped}\\]\\]([\\s\\S]*?)(?=\\n\\[\\[|\\n\\[env\\.|\\n\\[[a-z]|$)`, 'g');
  for (const match of section.matchAll(blockPattern)) {
    const queue = match[1]?.match(/queue\s*=\s*"([^"]+)"/)?.[1];
    if (queue) names.push(queue);
  }
  return names;
}

function trackedWranglerFiles() {
  try {
    const output = execFileSync('git', ['ls-files', '**/.wrangler/**', '**/wrangler.log'], {
      encoding: 'utf8',
    }).trim();
    return output ? output.split(/\r?\n/) : [];
  } catch {
    warnings.push('Nao foi possivel consultar git ls-files para arquivos locais do Wrangler.');
    return [];
  }
}

const prodSection = sectionBetween(/^# --- CONFIGURACAO GLOBAL \/ PRODUCAO ---/m, /^\[env\.dev\]/m);
const devStart = content.search(/^\[env\.dev\]/m);
const devSection = devStart < 0 ? '' : content.slice(devStart);

const prodDatabaseId = matchOne(/database_name\s*=\s*"houselog-db"\s*\n\s*database_id\s*=\s*"([^"]+)"/m, 'database_id de producao');
const devDatabaseId = matchOne(/\[\[env\.dev\.d1_databases\]\][\s\S]*?database_id\s*=\s*"([^"]+)"/m, 'database_id de dev');
const prodKvId = matchOne(/\[\[kv_namespaces\]\][\s\S]*?id\s*=\s*"([^"]+)"/m, 'KV id de producao');
const devKvId = matchOne(/\[\[env\.dev\.kv_namespaces\]\][\s\S]*?id\s*=\s*"([^"]+)"/m, 'KV id de dev');
const prodR2Bucket = matchOne(/\[\[r2_buckets\]\][\s\S]*?bucket_name\s*=\s*"([^"]+)"/m, 'R2 bucket de producao');
const devR2Bucket = matchOne(/\[\[env\.dev\.r2_buckets\]\][\s\S]*?bucket_name\s*=\s*"([^"]+)"/m, 'R2 bucket de dev');

if (prodDatabaseId && devDatabaseId && prodDatabaseId === devDatabaseId) {
  errors.push('D1 dev e producao usam o mesmo database_id.');
}

if (prodKvId && devKvId && prodKvId === devKvId) {
  errors.push('KV dev e producao usam o mesmo namespace id.');
}

if (prodR2Bucket && devR2Bucket && prodR2Bucket === devR2Bucket) {
  errors.push('R2 dev e producao usam o mesmo bucket.');
}

if (content.includes('COLE_AQUI_O_ID_DO_KV_PRODUCAO')) {
  errors.push('KV de producao ainda usa o placeholder antigo COLE_AQUI_O_ID_DO_KV_PRODUCAO.');
}

for (const secretKey of ['JWT_SECRET', 'CREDENTIALS_ENCRYPTION_KEY', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'RESEND_API_KEY']) {
  if (new RegExp(`^${secretKey}\\s*=`, 'm').test(prodSection)) {
    errors.push(`${secretKey} nao deve ficar em wrangler.toml; use wrangler secret put.`);
  }
}

const prodProducers = queueNames(prodSection, 'queues.producers');
const prodConsumers = queueNames(prodSection, 'queues.consumers');
for (const queue of prodProducers) {
  if (!prodConsumers.includes(queue)) {
    errors.push(`Fila de producao "${queue}" tem producer sem consumer correspondente.`);
  }
}

const devProducers = queueNames(devSection, 'env.dev.queues.producers');
const devConsumers = queueNames(devSection, 'env.dev.queues.consumers');
for (const queue of devProducers) {
  if (!devConsumers.includes(queue)) {
    errors.push(`Fila de dev "${queue}" tem producer sem consumer correspondente.`);
  }
  if (prodProducers.includes(queue)) {
    errors.push(`Fila de dev "${queue}" reutiliza nome de fila de producao.`);
  }
}

const trackedWrangler = trackedWranglerFiles();
if (trackedWrangler.length > 0) {
  errors.push(`Arquivos locais do Wrangler ainda estao versionados: ${trackedWrangler.join(', ')}`);
}

const invalidProductionPlaceholders = [
  ['D1 production database_id', prodDatabaseId, '00000000-0000-0000-0000-000000000001'],
  ['KV production namespace id', prodKvId, '00000000000000000000000000000001'],
];

for (const [label, actual, invalidPlaceholder] of invalidProductionPlaceholders) {
  if (actual === invalidPlaceholder) {
    const message = `${label} ainda usa placeholder invalido intencional. Producao nao esta pronta para deploy.`;
    if (PRODUCTION_READY) errors.push(message);
    else warnings.push(message);
  }
}

for (const key of ['R2_ACCOUNT_ID', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'RESEND_API_KEY']) {
  if (hasQuotedKey(prodSection, key) && quotedValue(prodSection, key) === '') {
    errors.push(`${key} esta vazio em producao; remova do toml ou configure como secret.`);
  }
}

if (errors.length > 0) {
  console.error('Deploy config check falhou:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

if (warnings.length > 0) {
  console.warn('Deploy config check avisos:');
  for (const warning of warnings) console.warn(`- ${warning}`);
}

console.log(PRODUCTION_READY
  ? 'Deploy config check OK para producao.'
  : 'Deploy config check OK para CI/local.');
