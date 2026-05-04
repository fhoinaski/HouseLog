const PROPERTY_CONTEXT_RE =
  /^\/properties\/([^/]+)(?:$|\/(map|systems|rooms|inventory(?:\/.*)?|services(?:\/(?!new$)[^/]+)?|service-requests(?:\/.*)?|documents|maintenance|renovations|financial|timeline|report|warranties|handover|credentials|access|team)(?:\/.*)?)$/;

export function getPropertyContext(pathname: string): { propertyId: string } | null {
  const match = pathname.match(PROPERTY_CONTEXT_RE);
  const propertyId = match?.[1];
  if (!propertyId || propertyId === 'new') return null;
  return { propertyId };
}

export function shouldShowPropertyContextHeader(pathname: string): boolean {
  return /^\/properties\/[^/]+\/(map|systems|rooms|inventory|services|service-requests|documents|maintenance|renovations|financial|timeline|report|warranties|handover|credentials|access)$/.test(
    pathname
  );
}
