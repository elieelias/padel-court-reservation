import { Resolver } from "node:dns/promises";
import { checkEmailSyntax, emailDomain, type EmailCheck } from "./email-policy";

type MailDns = Pick<Resolver, "resolveMx" | "resolve4" | "resolve6">;
const noRecords = (error: unknown) => ["ENODATA", "ENOTFOUND"].includes((error as { code?: string })?.code ?? "");

/** DNS checks only the domain, never sends a message or probes a person's mailbox. */
export async function checkMailRouting(email: string, dns: MailDns): Promise<EmailCheck> {
  const syntax = checkEmailSyntax(email);
  if (!syntax.ok) return syntax;
  const domain = emailDomain(email)!;
  try {
    let records: Awaited<ReturnType<MailDns["resolveMx"]>> = [];
    try {
      records = await dns.resolveMx(domain);
    } catch (error) {
      if ((error as { code?: string })?.code === "ENOTFOUND") return { ok: false, reason: "no_mail" };
      if (!noRecords(error)) throw error;
    }
    // A null MX explicitly says the domain does not accept email (RFC 7505).
    if (records.some((record) => record.exchange === "." || record.exchange === "")) {
      return { ok: false, reason: "no_mail" };
    }
    if (records.length) return { ok: true };

    // SMTP also permits delivery to A/AAAA when no MX exists (RFC 5321).
    const addresses = await Promise.allSettled([dns.resolve4(domain), dns.resolve6(domain)]);
    if (addresses.some((result) => result.status === "fulfilled" && result.value.length > 0)) return { ok: true };
    if (addresses.some((result) => result.status === "rejected" && !noRecords(result.reason))) {
      return { ok: false, reason: "unavailable" };
    }
    return { ok: false, reason: "no_mail" };
  } catch {
    // A DNS outage must not be mislabelled as a fake email or allowed through.
    return { ok: false, reason: "unavailable" };
  }
}

// Bounded, short-lived cache contains domains only, never full email addresses.
const cache = new Map<string, { result: EmailCheck; expires: number }>();

export async function validateSignupEmail(email: string): Promise<EmailCheck> {
  const syntax = checkEmailSyntax(email);
  if (!syntax.ok) return syntax;
  const domain = emailDomain(email)!;
  const cached = cache.get(domain);
  if (cached && cached.expires > Date.now()) return cached.result;

  const dns = new Resolver({ timeout: 700, tries: 1 });
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Auth HTTP hooks have a five-second budget; leave time for network overhead.
    const result = await Promise.race([
      checkMailRouting(email, dns),
      new Promise<EmailCheck>((resolve) => {
        timer = setTimeout(() => resolve({ ok: false, reason: "unavailable" }), 1800);
      }),
    ]);
    if (result.ok || result.reason !== "unavailable") {
      if (cache.size >= 500) cache.clear();
      cache.set(domain, { result, expires: Date.now() + 300_000 });
    }
    return result;
  } finally {
    clearTimeout(timer);
    dns.cancel();
  }
}
