/**
 * Backfill token_hash para registros legados sem hash nas tabelas de link público.
 *
 * Execução única antes de aplicar migration 0028_redact_token_plaintext.sql.
 *
 * O que faz:
 *  1. Para cada tabela, busca registros onde token_hash IS NULL e token NOT LIKE 'hash-only:%'
 *  2. Calcula sha256(token) para cada um
 *  3. Grava token_hash
 *  4. Repete até zero registros pendentes
 *
 * Após zero pendentes em todas as tabelas: aplicar migration 0028.
 *
 * Uso (local, via wrangler):
 *   wrangler d1 execute <DB_NAME> --command "SELECT COUNT(*) ..." --env production
 *
 * Para execução programática num Worker de manutenção:
 *   import { runTokenHashBackfill } from './phase_a_token_hash_backfill';
 *   const result = await runTokenHashBackfill(env.DB);
 */

import type { D1Database } from '@cloudflare/workers-types';

const BATCH = 200;

type TableConfig = {
  table: string;
  idCol: string;
  tokenCol: string;
  hashCol: string;
};

const TABLES: TableConfig[] = [
  { table: 'audit_links',         idCol: 'id', tokenCol: 'token', hashCol: 'token_hash' },
  { table: 'service_share_links', idCol: 'id', tokenCol: 'token', hashCol: 'token_hash' },
  { table: 'property_invites',    idCol: 'id', tokenCol: 'token', hashCol: 'token_hash' },
];

async function sha256Hex(value: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

type BackfillTableResult = {
  table: string;
  processed: number;
  skipped: number;
};

async function backfillTable(db: D1Database, cfg: TableConfig): Promise<BackfillTableResult> {
  let processed = 0;
  let skipped = 0;

  while (true) {
    const { results } = await db
      .prepare(
        `SELECT ${cfg.idCol}, ${cfg.tokenCol}
         FROM ${cfg.table}
         WHERE ${cfg.hashCol} IS NULL
           AND ${cfg.tokenCol} NOT LIKE 'hash-only:%'
         LIMIT ?`
      )
      .bind(BATCH)
      .all<{ id: string; token: string }>();

    if (!results || results.length === 0) break;

    for (const row of results) {
      if (!row.token || row.token.startsWith('hash-only:')) {
        skipped++;
        continue;
      }
      try {
        const hash = await sha256Hex(row.token);
        await db
          .prepare(`UPDATE ${cfg.table} SET ${cfg.hashCol} = ? WHERE ${cfg.idCol} = ? AND ${cfg.hashCol} IS NULL`)
          .bind(hash, row.id)
          .run();
        processed++;
      } catch {
        skipped++;
      }
    }

    if (results.length < BATCH) break;
  }

  return { table: cfg.table, processed, skipped };
}

export type BackfillResult = {
  tables: BackfillTableResult[];
  totalProcessed: number;
  totalSkipped: number;
};

export async function runTokenHashBackfill(db: D1Database): Promise<BackfillResult> {
  const tables: BackfillTableResult[] = [];

  for (const cfg of TABLES) {
    const result = await backfillTable(db, cfg);
    tables.push(result);
  }

  return {
    tables,
    totalProcessed: tables.reduce((s, t) => s + t.processed, 0),
    totalSkipped:   tables.reduce((s, t) => s + t.skipped, 0),
  };
}

export async function verifyNoPlaintextRemaining(db: D1Database): Promise<{ clean: boolean; remaining: Record<string, number> }> {
  const remaining: Record<string, number> = {};

  for (const cfg of TABLES) {
    const { results } = await db
      .prepare(
        `SELECT COUNT(*) AS cnt FROM ${cfg.table}
         WHERE ${cfg.hashCol} IS NULL AND ${cfg.tokenCol} NOT LIKE 'hash-only:%'`
      )
      .all<{ cnt: number }>();
    remaining[cfg.table] = results?.[0]?.cnt ?? 0;
  }

  const clean = Object.values(remaining).every((n) => n === 0);
  return { clean, remaining };
}
