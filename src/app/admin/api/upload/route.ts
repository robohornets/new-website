import { requireAdmin, UnauthorizedError } from "@/lib/auth";
import { getEnv } from "@/lib/cf";
import { handleUpload } from "@/lib/upload";

// On the deployed Worker, worker.ts answers POST /admin/api/upload itself
// (see src/lib/upload.ts) and this route never runs. It's here for `next dev`.
export async function POST(request: Request) {
  let user;
  try {
    user = await requireAdmin();
  } catch (e) {
    if (e instanceof UnauthorizedError) return Response.json({ error: e.message }, { status: 401 });
    throw e;
  }
  return handleUpload(request, await getEnv(), user.email);
}
