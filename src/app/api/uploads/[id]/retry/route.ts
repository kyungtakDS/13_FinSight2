import { after } from "next/server";

import { runAnalysis } from "@/lib/analysis/run-analysis";
import { getUser } from "@/lib/supabase/server";
import {
  claimUploadRetry,
  getUploadForUser,
} from "@/lib/supabase/service";

export const runtime = "nodejs";
export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  void req;
  try {
    const user = await getUser();
    if (!user) return Response.json({ error: "upstream" }, { status: 401 });

    const { id } = await ctx.params;
    const upload = await getUploadForUser(user.id, id);
    if (!upload) return new Response(null, { status: 404 });

    if (!upload.storagePath || new Date(upload.expiresAt).getTime() <= Date.now()) {
      return Response.json({ error: "expired" }, { status: 409 });
    }
    if (upload.status !== "failed") {
      return Response.json({ error: "analysis_failed" }, { status: 409 });
    }
    if (upload.retryCount >= 2) {
      return Response.json(
        { error: "analysis_failed", retriesLeft: 0 },
        { status: 409 },
      );
    }

    const nextRetryCount = upload.retryCount + 1;
    const claimed = await claimUploadRetry(user.id, id, upload.retryCount);
    if (!claimed) {
      return Response.json({ error: "analysis_failed" }, { status: 409 });
    }
    const accepted = Response.json(
      { retriesLeft: 2 - nextRetryCount },
      { status: 202 },
    );
    after(() => runAnalysis(user.id, id));
    return accepted;
  } catch {
    console.error(JSON.stringify({ event: "upload_retry_failed", code: "upstream" }));
    return Response.json({ error: "upstream" }, { status: 500 });
  }
}
