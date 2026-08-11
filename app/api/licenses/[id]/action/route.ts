import { z } from "zod";
import { requireOwnerApi } from "@/lib/auth";
import { actionLicense } from "@/lib/licenses";
import { apiError, noStoreJson } from "@/lib/http";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suspend") }),
  z.object({ action: z.literal("revoke"), confirmation: z.literal("REVOKE") }),
  z.object({ action: z.literal("extend"), expiresAt: z.string().datetime({ offset: true }) })
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const owner = await requireOwnerApi();
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    if (body.action === "extend" && new Date(body.expiresAt).getTime() <= Date.now()) {
      return noStoreJson({ error: "Expiry must be in the future" }, { status: 400 });
    }
    await actionLicense(owner.id, id, body.action, body.action === "extend" ? body.expiresAt : undefined);
    return noStoreJson({ ok: true });
  } catch (error) { return apiError(error); }
}
