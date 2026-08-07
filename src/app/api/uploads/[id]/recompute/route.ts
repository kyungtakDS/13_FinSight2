import { after } from "next/server";

import { runAnalysis } from "@/lib/analysis/run-analysis";
import { getUser } from "@/lib/supabase/server";
import {
  claimUploadRecompute,
  getUploadForUser,
} from "@/lib/supabase/service";

export const runtime = "nodejs";
export const maxDuration = 300;

type RouteContext = { params: Promise<{ id: string }> };

/**
 * 분석 로직이 바뀐 뒤 completed 업로드를 다시 계산한다. retry 와 갈라 둔 이유는
 * 의미가 다르기 때문이다 — 이 경로는 실패 복구가 아니라서 retry_count 를 쓰지 않고,
 * 새 결과가 나오기 전까지 기존 결과를 그대로 둔다.
 */
export async function POST(req: Request, ctx: RouteContext): Promise<Response> {
  void req;
  try {
    const user = await getUser();
    if (!user) return Response.json({ error: "upstream" }, { status: 401 });

    const { id } = await ctx.params;
    const upload = await getUploadForUser(user.id, id);
    if (!upload) return new Response(null, { status: 404 });

    // 원본이 파기됐으면(ADR-005) 다시 계산할 재료 자체가 없다.
    if (!upload.storagePath || new Date(upload.expiresAt).getTime() <= Date.now()) {
      return Response.json({ error: "expired" }, { status: 409 });
    }
    if (upload.status !== "completed") {
      return Response.json({ error: "analysis_failed" }, { status: 409 });
    }

    // 한 업로드에 재계산은 하나뿐이다. 둘이 같이 돌면 LLM 비용이 두 번 나가고
    // 나중에 끝난 쪽이 먼저 끝난 결과를 덮어쓴다.
    const claimed = await claimUploadRecompute(user.id, id);
    if (!claimed) {
      return Response.json({ error: "analysis_failed" }, { status: 409 });
    }

    const accepted = Response.json({ recomputing: true }, { status: 202 });
    after(() => runAnalysis(user.id, id, { recompute: true }));
    return accepted;
  } catch {
    console.error(
      JSON.stringify({ event: "upload_recompute_failed", code: "upstream" }),
    );
    return Response.json({ error: "upstream" }, { status: 500 });
  }
}
