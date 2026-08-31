import { validateSignupEmail } from "@/features/auth/lib/email-domain.server";
import { handleEmailCheck } from "@/features/auth/lib/email-check-handlers.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleEmailCheck(request, validateSignupEmail);
}
