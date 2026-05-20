'use client';

import { use } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PageContainer } from '@/components/layout/page-container';
import { PropertyTimelinePanel } from '@/components/properties/property-timeline-panel';
import { Button } from '@/components/ui/button';

export default function TimelinePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <PageContainer className="space-y-4">
      <Button variant="ghost" size="sm" asChild className="w-fit text-hl-text-muted">
        <Link href={`/properties/${id}?tab=history`}>
          <ArrowLeft className="h-4 w-4" />
          Voltar ao imovel
        </Link>
      </Button>

      <PropertyTimelinePanel propertyId={id} />
    </PageContainer>
  );
}
