import { PropertyWarrantiesReadonly } from '@/components/properties/premium-readonly-sections';

export default async function PropertyWarrantiesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PropertyWarrantiesReadonly propertyId={id} />;
}
