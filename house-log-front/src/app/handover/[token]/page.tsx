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

export default async function PublicHandoverPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const result = await getPublicHandoverState(token);

  if (!result.ok) return <PublicHandoverState state={result.state} />;
  return <PublicHandoverPackageView handoverPackage={result.handoverPackage} />;
}
