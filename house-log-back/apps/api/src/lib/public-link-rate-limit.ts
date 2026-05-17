import { applyRateLimit } from '../middleware/rateLimit';

export type PublicLinkFlow = 'audit' | 'share' | 'invite' | 'handover';
export type PublicLinkAction = 'read' | 'mutate';

const WINDOW_SECONDS = 60;
const HASH_PREFIX_LENGTH = 16;

const MAX_REQUESTS: Record<PublicLinkAction, number> = {
  read: 30,
  mutate: 10,
};

export function getPublicLinkRateLimitKey(input: {
  flow: PublicLinkFlow;
  action: PublicLinkAction;
  ip: string;
  tokenHash: string;
}): string {
  const tokenHashPrefix = input.tokenHash.slice(0, HASH_PREFIX_LENGTH);
  return `rl:public:${input.flow}:${input.action}:${input.ip}:${tokenHashPrefix}`;
}

export async function applyPublicLinkRateLimit(input: {
  kv: KVNamespace;
  flow: PublicLinkFlow;
  action: PublicLinkAction;
  ip: string;
  tokenHash: string;
}): Promise<boolean> {
  const maybeKv = input.kv as Partial<KVNamespace> | undefined;
  if (typeof maybeKv?.get !== 'function' || typeof maybeKv.put !== 'function') {
    return true;
  }

  return applyRateLimit(
    input.kv,
    getPublicLinkRateLimitKey(input),
    MAX_REQUESTS[input.action],
    WINDOW_SECONDS
  );
}
