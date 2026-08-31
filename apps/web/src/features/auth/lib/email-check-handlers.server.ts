import { Webhook } from "standardwebhooks";
import type { EmailCheck } from "./email-policy";

type Validator = (email: string) => Promise<EmailCheck>;
const headers = { "Cache-Control": "no-store" };

async function readBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit) throw new Error("Body too large");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing body");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error("Body too large"); }
      chunks.push(value);
    }
    return Buffer.concat(chunks).toString("utf8");
  } finally {
    reader.releaseLock();
  }
}

export async function handleEmailCheck(request: Request, validate: Validator) {
  let email: string;
  try {
    const body = JSON.parse(await readBody(request, 2048));
    if (typeof body?.email !== "string") return Response.json({ ok: false, reason: "invalid" }, { status: 400, headers });
    email = body.email;
  } catch {
    return Response.json({ ok: false, reason: "invalid" }, { status: 400, headers });
  }
  try {
    const result = await validate(email);
    return Response.json(result, { status: result.ok ? 200 : result.reason === "unavailable" ? 503 : 400, headers });
  } catch {
    return Response.json({ ok: false, reason: "unavailable" }, { status: 503, headers });
  }
}

/** Only signed Supabase Auth requests may invoke the authoritative signup gate. */
export async function handleBeforeUserCreated(request: Request, secret: string | undefined, validate: Validator) {
  const reject = (status: number, message: string) => Response.json({ error: { http_code: status, message } }, { status, headers });
  if (!secret) return reject(503, "Signup validation is not configured.");

  let event: { user?: { email?: unknown } };
  try {
    const payload = await readBody(request, 65_536);
    const webhook = new Webhook(secret.trim().replace(/^v1,whsec_/, "").replace(/^whsec_/, ""));
    event = webhook.verify(payload, Object.fromEntries(request.headers)) as typeof event;
  } catch {
    return reject(401, "Invalid signup hook signature.");
  }

  if (typeof event?.user?.email !== "string") return reject(400, "signup_email_invalid");
  try {
    const result = await validate(event.user.email);
    if (!result.ok) return reject(result.reason === "unavailable" ? 503 : 400, `signup_email_${result.reason}`);
    return Response.json({}, { headers });
  } catch {
    return reject(503, "signup_email_unavailable");
  }
}
