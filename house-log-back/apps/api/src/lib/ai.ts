// Wrappers for Workers AI (env.AI) with ai_cache integration.
// - diagnose: image → { category, severity, summary, suggested_title, checklist }
// - transcribe: audio → { text }
// - classify: document text → { kind, fields }

import type { Bindings } from './types';
import { eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { aiCache } from '../db/schema';

type AiBinding = Bindings['AI'];

async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const buf =
    typeof data === 'string'
      ? new TextEncoder().encode(data)
      : data instanceof Uint8Array
        ? data
        : new Uint8Array(data);
  const hash = await crypto.subtle.digest('SHA-256', buf as unknown as ArrayBuffer);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function cacheGet<T>(db: D1Database, key: string): Promise<T | null> {
  const drizzle = getDb(db);
  const [row] = await drizzle
    .select({ result: aiCache.result })
    .from(aiCache)
    .where(eq(aiCache.cacheKey, key))
    .limit(1);
  if (!row) return null;
  try {
    return JSON.parse(row.result) as T;
  } catch {
    return null;
  }
}

async function cacheSet(db: D1Database, key: string, kind: string, result: unknown): Promise<void> {
  const drizzle = getDb(db);
  await drizzle
    .insert(aiCache)
    .values({ cacheKey: key, kind, result: JSON.stringify(result) })
    .onConflictDoUpdate({
      target: aiCache.cacheKey,
      set: {
        kind,
        result: JSON.stringify(result),
        createdAt: new Date().toISOString(),
      },
    });
}

const SEVERITY = ['low', 'medium', 'high', 'critical'] as const;
type Severity = (typeof SEVERITY)[number];

export type DiagnoseResult = {
  category: string;
  severity: Severity;
  summary: string;
  suggested_title: string;
  checklist: string[];
};

// Tenta extrair JSON de um bloco possivelmente embrulhado em markdown.
function extractJson(text: string): unknown | null {
  const trimmed = text.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1]! : trimmed;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function clampSeverity(x: unknown): Severity {
  const s = String(x ?? '').toLowerCase();
  return (SEVERITY as readonly string[]).includes(s) ? (s as Severity) : 'medium';
}

// Diagnóstico por foto: usa modelo de visão (llava) e pede JSON estruturado em PT-BR.
export async function diagnoseImage(
  ai: AiBinding,
  db: D1Database,
  imageBytes: Uint8Array,
  context?: string
): Promise<DiagnoseResult> {
  const cacheKey = `diagnose:${await sha256Hex(imageBytes)}:${await sha256Hex(context ?? '')}`;
  const cached = await cacheGet<DiagnoseResult>(db, cacheKey);
  if (cached) return cached;

  const prompt = [
    'Você é um diagnosticador de problemas prediais/residenciais em PT-BR.',
    'Analise a imagem e responda APENAS com um JSON com as chaves:',
    '{ "category": string (hidráulica|elétrica|estrutural|acabamento|eletrodoméstico|jardim|outro),',
    '  "severity": "low"|"medium"|"high"|"critical",',
    '  "summary": string (até 280 chars, PT-BR),',
    '  "suggested_title": string (até 60 chars, imperativo),',
    '  "checklist": string[] (3-6 passos de correção sugeridos) }',
    context ? `Contexto adicional: ${context}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = (await (ai as any).run('@cf/llava-hf/llava-1.5-7b-hf', {
    image: Array.from(imageBytes),
    prompt,
    max_tokens: 512,
  })) as { description?: string; response?: string };

  const text = res.description ?? res.response ?? '';
  const parsed = (extractJson(text) ?? {}) as Partial<DiagnoseResult>;

  const out: DiagnoseResult = {
    category: String(parsed.category ?? 'outro'),
    severity: clampSeverity(parsed.severity),
    summary: String(parsed.summary ?? text.slice(0, 280)),
    suggested_title: String(parsed.suggested_title ?? 'Revisão necessária').slice(0, 80),
    checklist: Array.isArray(parsed.checklist)
      ? parsed.checklist.map(String).slice(0, 8)
      : [],
  };
  await cacheSet(db, cacheKey, 'diagnose', out);
  return out;
}

export type TranscribeResult = { text: string };

// Transcreve áudio com whisper.
export async function transcribeAudio(
  ai: AiBinding,
  db: D1Database,
  audioBytes: Uint8Array
): Promise<TranscribeResult> {
  const cacheKey = `transcribe:${await sha256Hex(audioBytes)}`;
  const cached = await cacheGet<TranscribeResult>(db, cacheKey);
  if (cached) return cached;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = (await (ai as any).run('@cf/openai/whisper', {
    audio: Array.from(audioBytes),
  })) as { text?: string };

  const out: TranscribeResult = { text: String(res.text ?? '').trim() };
  await cacheSet(db, cacheKey, 'transcribe', out);
  return out;
}

export type ClassifyResult = {
  kind: string; // nfe | recibo | garantia | manual | contrato | outro
  fields: Record<string, string>;
  summary: string;
};

// Classifica texto de documento (OCR já feito upstream).
export async function classifyDocument(
  ai: AiBinding,
  db: D1Database,
  text: string
): Promise<ClassifyResult> {
  const cacheKey = `classify:${await sha256Hex(text)}`;
  const cached = await cacheGet<ClassifyResult>(db, cacheKey);
  if (cached) return cached;

  const prompt = [
    'Você classifica documentos residenciais/prediais em PT-BR.',
    'Responda APENAS com JSON válido:',
    '{ "kind": "nfe"|"recibo"|"garantia"|"manual"|"contrato"|"outro",',
    '  "summary": string (até 280 chars),',
    '  "fields": object (chaves: emitente, valor_total, data, cnpj, produto, validade_meses — quando aplicável) }',
    '',
    'Texto do documento:',
    text.slice(0, 4000),
  ].join('\n');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = (await (ai as any).run('@cf/meta/llama-3.1-8b-instruct', {
    messages: [
      { role: 'system', content: 'Você responde somente com JSON válido.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 512,
  })) as { response?: string };

  const parsed = (extractJson(res.response ?? '') ?? {}) as Partial<ClassifyResult>;
  const out: ClassifyResult = {
    kind: String(parsed.kind ?? 'outro'),
    summary: String(parsed.summary ?? '').slice(0, 280),
    fields:
      parsed.fields && typeof parsed.fields === 'object'
        ? Object.fromEntries(Object.entries(parsed.fields).map(([k, v]) => [k, String(v)]))
        : {},
  };
  await cacheSet(db, cacheKey, 'classify', out);
  return out;
}
