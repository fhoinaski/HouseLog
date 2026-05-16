import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const WRANGLER_PATH = 'house-log-back/apps/api/wrangler.toml';
const PRODUCTION_READY = process.argv.includes('--production-ready');
const STAGING_READY = process.argv.includes('--staging-ready');
const DEV_READY = process.argv.includes('--dev-ready');
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
const stagingStart = content.search(/^\[env\.staging\]/m);
const devSection = devStart < 0
  ? ''
  : content.slice(devStart, stagingStart > devStart ? stagingStart : undefined);
const stagingSection = stagingStart < 0 ? '' : content.slice(stagingStart);

const prodDatabaseId = matchOne(/database_name\s*=\s*"houselog-db"\s*\n\s*database_id\s*=\s*"([^"]+)"/m, 'database_id de producao');
const devDatabaseId = matchOne(/\[\[env\.dev\.d1_databases\]\][\s\S]*?database_id\s*=\s*"([^"]+)"/m, 'database_id de dev');
const stagingDatabaseId = matchOne(/\[\[env\.staging\.d1_databases\]\][\s\S]*?database_id\s*=\s*"([^"]+)"/m, 'database_id de staging');
const prodKvId = matchOne(/\[\[kv_namespaces\]\][\s\S]*?id\s*=\s*"([^"]+)"/m, 'KV id de producao');
const devKvId = matchOne(/\[\[env\.dev\.kv_namespaces\]\][\s\S]*?id\s*=\s*"([^"]+)"/m, 'KV id de dev');
const stagingKvId = matchOne(/\[\[env\.staging\.kv_namespaces\]\][\s\S]*?id\s*=\s*"([^"]+)"/m, 'KV id de staging');
const prodR2Bucket = matchOne(/\[\[r2_buckets\]\][\s\S]*?bucket_name\s*=\s*"([^"]+)"/m, 'R2 bucket de producao');
const devR2Bucket = matchOne(/\[\[env\.dev\.r2_buckets\]\][\s\S]*?bucket_name\s*=\s*"([^"]+)"/m, 'R2 bucket de dev');
const stagingR2Bucket = matchOne(/\[\[env\.staging\.r2_buckets\]\][\s\S]*?bucket_name\s*=\s*"([^"]+)"/m, 'R2 bucket de staging');

function ensureDistinct(label, entries) {
  const seen = new Map();
  for (const [envName, value] of entries) {
    if (!value) continue;
    const previous = seen.get(value);
    if (previous) {
      errors.push(`${label} de ${envName} reutiliza o mesmo valor de ${previous}.`);
    }
    seen.set(value, envName);
  }
}

ensureDistinct('D1 database_id', [
  ['production', prodDatabaseId],
  ['dev', devDatabaseId],
  ['staging', stagingDatabaseId],
]);

ensureDistinct('KV namespace id', [
  ['production', prodKvId],
  ['dev', devKvId],
  ['staging', stagingKvId],
]);

ensureDistinct('R2 bucket', [
  ['production', prodR2Bucket],
  ['dev', devR2Bucket],
  ['staging', stagingR2Bucket],
]);

if (content.includes('COLE_AQUI_O_ID_DO_KV_PRODUCAO')) {
  errors.push('KV de producao ainda usa o placeholder antigo COLE_AQUI_O_ID_DO_KV_PRODUCAO.');
}

const sectionsByEnv = [
  ['production', prodSection],
  ['dev', devSection],
  ['staging', stagingSection],
];

for (const secretKey of [
  'JWT_SECRET',
  'CREDENTIALS_ENCRYPTION_KEY',
  'R2_PUBLIC_URL',
  'R2_ACCOUNT_ID',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'RESEND_API_KEY',
  'VAPID_PRIVATE_KEY',
]) {
  for (const [envName, section] of sectionsByEnv) {
    if (new RegExp(`^${secretKey}\\s*=`, 'm').test(section)) {
      errors.push(`${secretKey} nao deve ficar em wrangler.toml (${envName}); use wrangler secret put.`);
    }
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

const stagingProducers = queueNames(stagingSection, 'env.staging.queues.producers');
const stagingConsumers = queueNames(stagingSection, 'env.staging.queues.consumers');

if (stagingStart < 0) {
  errors.push('Ambiente staging nao esta declarado no wrangler.toml.');
}

for (const queue of stagingProducers) {
  if (!stagingConsumers.includes(queue)) {
    errors.push(`Fila de staging "${queue}" tem producer sem consumer correspondente.`);
  }
  if (prodProducers.includes(queue)) {
    errors.push(`Fila de staging "${queue}" reutiliza nome de fila de producao.`);
  }
  if (devProducers.includes(queue)) {
    errors.push(`Fila de staging "${queue}" reutiliza nome de fila de dev.`);
  }
}

if (content.includes('houselog-queue')) {
  errors.push('Nome legado/invalido "houselog-queue" encontrado. Use "houselog-jobs" por ambiente.');
}

const expectedQueuesByEnv = [
  ['production', prodProducers, ['houselog-jobs', 'houselog-document-ingestion']],
  ['dev', devProducers, ['houselog-jobs-dev', 'houselog-document-ingestion-dev']],
  ['staging', stagingProducers, ['houselog-jobs-staging', 'houselog-document-ingestion-staging']],
];

for (const [envName, actualQueues, expectedQueues] of expectedQueuesByEnv) {
  for (const expectedQueue of expectedQueues) {
    if (!actualQueues.includes(expectedQueue)) {
      errors.push(`Fila esperada "${expectedQueue}" nao esta configurada em ${envName}.`);
    }
  }
}

const trackedWrangler = trackedWranglerFiles();
if (trackedWrangler.length > 0) {
  errors.push(`Arquivos locais do Wrangler ainda estao versionados: ${trackedWrangler.join(', ')}`);
}

const invalidResourcePlaceholders = [
  ['production', 'D1 database_id', prodDatabaseId, '00000000-0000-0000-0000-000000000001', PRODUCTION_READY],
  ['production', 'KV namespace id', prodKvId, '00000000000000000000000000000001', PRODUCTION_READY],
  ['staging', 'D1 database_id', stagingDatabaseId, '00000000-0000-0000-0000-000000000002', STAGING_READY],
  ['staging', 'KV namespace id', stagingKvId, '00000000000000000000000000000002', STAGING_READY],
  ['dev', 'D1 database_id', devDatabaseId, '00000000-0000-0000-0000-000000000101', DEV_READY],
  ['dev', 'KV namespace id', devKvId, '00000000000000000000000000000101', DEV_READY],
];

for (const [envName, label, actual, invalidPlaceholder, isReadyCheck] of invalidResourcePlaceholders) {
  if (actual === invalidPlaceholder) {
    const message = `${label} de ${envName} ainda usa placeholder invalido intencional. ${envName} nao esta pronto para deploy.`;
    if (isReadyCheck) errors.push(message);
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
