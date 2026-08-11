import { z } from "zod";
import { requireOwnerApi } from "@/lib/auth";
import { apiError, noStoreJson } from "@/lib/http";
import { issueLicense } from "@/lib/licenses";

const issueSchema = z.object({
  label: z.string().trim().min(1).max(120),
  expiresAt: z.string().datetime({ offset: true }),
  allowedAccount: z.string().regex(/^\d{1,18}$/)
}).refine((data) => new Date(data.expiresAt).getTime() > Date.now(), { message: "Expiry must be in the future", path: ["expiresAt"] });

export async function POST(request: Request) {
  try {
    const owner = await requireOwnerApi();
    const input = issueSchema.parse(await request.json());
    const issued = await issueLicense({ ...input, createdBy: owner.id });
    return noStoreJson(issued, { status: 201 });
  } catch (error) { return apiError(error); }
}
