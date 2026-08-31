import { defaultSiteUrl, siteUrl } from "@/lib/config";

/** A receipt is scanned on another device, so never encode the development server. */
export function reservationReceiptUrl(token: string, configuredUrl = siteUrl) {
  let origin = defaultSiteUrl;

  try {
    const url = new URL(configuredUrl);
    const hostname = url.hostname.toLowerCase();
    const isLocal =
      !hostname.includes(".") ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      hostname.endsWith(".internal") ||
      /^[\d.]+$/.test(hostname) ||
      hostname.includes(":");

    if (url.protocol === "https:" && !isLocal && !url.username && !url.password) {
      origin = url.origin;
    }
  } catch {
    // A missing or malformed deployment setting must not break the receipt.
  }

  return `${origin}/receipt/${encodeURIComponent(token)}`;
}
