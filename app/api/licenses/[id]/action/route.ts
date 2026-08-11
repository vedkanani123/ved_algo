import { z } from "zod";
import { requireOwnerApi } from "@/lib/auth";
import { actionLicense, deleteLicense, updateLicense } from "@/lib/licenses";
import { apiError, noStoreJson } from "@/lib/http";

const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("suspend") }),
  z.object({ action: z.literal("revoke"), confirmation: z.literal("REVOKE") }),
  z.object({ action: z.literal("extend"), expiresAt: z.string().datetime({ offset: true }) }),
  z.object({
    action: z.literal("update"),
    label: z.string().trim().min(1).max(120),
    allowedAccount: z.string().regex(/^\d{1,18}$/),
    expiresAt: z.string().datetime({ offset: true })
  }),
  z.object({ action: z.literal("delete"), confirmation: z.literal("DELETE LICENSE") })
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const owner = await requireOwnerApi();
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    if ((body.action === "extend" || body.action === "update") && new Date(body.expiresAt).getTime() <= Date.now()) {
      return noStoreJson({ error: "Expiry must be in the future" }, { status: 400 });
    }
    if (body.action === "update") {
      const result = await updateLicense(owner.id, id, body);
      return noStoreJson({ ok: true, ...result });
    }
    if (body.action === "delete") {
      await deleteLicense(owner.id, id);
      return noStoreJson({ ok: true, deleted: true });
    }
    await actionLicense(owner.id, id, body.action, body.action === "extend" ? body.expiresAt : undefined);
    return noStoreJson({ ok: true });
  } catch (error) { return apiError(error); }
}
