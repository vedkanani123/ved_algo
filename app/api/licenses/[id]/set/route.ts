import { NextResponse } from "next/server";
import { requireOwnerApi } from "@/lib/auth";
import { apiError } from "@/lib/http";
import { getLicense, setFile } from "@/lib/licenses";
import { serverEnv } from "@/lib/env";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireOwnerApi();
    const { id } = await params;
    const license = await getLicense(id);
    const file = setFile({ licenseKey: license.licenseKey, apiUrl: `${serverEnv().APP_ORIGIN}/api/ea/validate` });
    return new NextResponse(file, { headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="gann-pro-${id}.set"`,
      "Cache-Control": "no-store"
    } });
  } catch (error) { return apiError(error); }
}
