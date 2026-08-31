import { validateSignupEmail } from "@/features/auth/lib/email-domain.server";
import { handleBeforeUserCreated } from "@/features/auth/lib/email-check-handlers.server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  return handleBeforeUserCreated(request, process.env.SUPABASE_BEFORE_USER_CREATED_HOOK_SECRET, validateSignupEmail);
}
