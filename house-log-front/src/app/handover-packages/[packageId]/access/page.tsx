import { PublicHandoverPackageView } from '@/components/handover/public-handover-package-view';
import { PublicHandoverState } from '@/components/handover/public-handover-state';
import { publicHandoverApi, PublicHandoverError } from '@/lib/api/handover-public';

function resolveState(error: PublicHandoverError): 'invalid' | 'expired' | 'revoked' | 'error' {
  if (error.code === 'LINK_EXPIRED') return 'expired';
  if (error.code === 'PACKAGE_REVOKED') return 'revoked';
  if (error.status === 404 || error.code === 'NOT_FOUND') return 'invalid';
  return 'error';
}

async function getPublicHandoverState(token: string) {
  try {
    const data = await publicHandoverApi.getByToken(token);
    return { ok: true as const, handoverPackage: data.package };
  } catch (error) {
    if (error instanceof PublicHandoverError) {
      return { ok: false as const, state: resolveState(error) };
    }

    return { ok: false as const, state: 'error' as const };
  }
}

export default async function PublicHandoverAccessPage({
  searchParams,
}: {
  params: Promise<{ packageId: string }>;
  searchParams: Promise<{ token?: string | string[] }>;
}) {
  const { token } = await searchParams;
  const publicToken = Array.isArray(token) ? token[0] : token;

  if (!publicToken) {
    return <PublicHandoverState state="invalid" />;
  }

  const result = await getPublicHandoverState(publicToken);

  if (!result.ok) return <PublicHandoverState state={result.state} />;
  return <PublicHandoverPackageView token={publicToken} handoverPackage={result.handoverPackage} />;
}
