import { PropertyContextHeader } from '@/components/properties/property-context-header';

export default async function PropertyLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <>
      <PropertyContextHeader propertyId={id} />
      {children}
    </>
  );
}
