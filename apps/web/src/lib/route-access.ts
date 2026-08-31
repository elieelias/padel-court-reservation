/** Only a single receipt-token page is public, not any future receipt subpages. */
export function isPublicReceiptPath(pathname: string) {
  return /^\/receipt\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/?$/i.test(pathname);
}

export function isPublicPath(pathname: string) {
  return pathname === "/" || pathname.startsWith("/auth/") || isPublicReceiptPath(pathname);
}
