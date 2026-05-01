const PROPERTY_CONTEXT_RE =
  /^\/properties\/([^/]+)(?:$|\/(rooms|inventory(?:\/.*)?|services(?:\/(?!new$)[^/]+)?|service-requests(?:\/.*)?|documents|maintenance|financial|timeline|report|credentials|access|team)(?:\/.*)?)$/;

export function getPropertyContext(pathname: string): { propertyId: string } | null {
  const match = pathname.match(PROPERTY_CONTEXT_RE);
  const propertyId = match?.[1];
  if (!propertyId || propertyId === 'new') return null;
  return { propertyId };
}

export function shouldShowPropertyContextHeader(pathname: string): boolean {
  return /^\/properties\/[^/]+\/(rooms|inventory|services|service-requests|documents|maintenance|financial|timeline|report|credentials|access)$/.test(
    pathname
  );
}
