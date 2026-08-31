export type EmailCheck = { ok: true } | {
  ok: false;
  reason: "invalid" | "reserved" | "no_mail" | "unavailable";
};

const reservedDomains = [
  "example.com", "example.net", "example.org", "example", "test", "invalid",
  "localhost", "local", "internal", "home.arpa",
];

/** Format checks are shared by the form and server, not used as proof of ownership. */
export function emailDomain(value: string): string | null {
  const email = value.trim();
  const parts = email.split("@");
  if (parts.length !== 2 || email.length > 254) return null;
  const [local, rawDomain] = parts;
  if (!local || local.length > 64 || !/^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local)
    || local.startsWith(".") || local.endsWith(".") || local.includes("..")) return null;
  if (!rawDomain || /[\s/:\\?#%\[\]]/.test(rawDomain) || rawDomain.endsWith(".")) return null;

  try {
    // URL normalizes internationalized domain names to their DNS (punycode) form.
    const domain = new URL(`https://${rawDomain}`).hostname.toLowerCase();
    const labels = domain.split(".");
    if (domain.length > 253 || labels.length < 2 || /^\d+$/.test(labels.at(-1) ?? "")) return null;
    if (labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
    return domain;
  } catch {
    return null;
  }
}

export function checkEmailSyntax(value: string): EmailCheck {
  const domain = emailDomain(value);
  if (!domain) return { ok: false, reason: "invalid" };
  if (reservedDomains.some((reserved) => domain === reserved || domain.endsWith(`.${reserved}`))) {
    return { ok: false, reason: "reserved" };
  }
  return { ok: true };
}
