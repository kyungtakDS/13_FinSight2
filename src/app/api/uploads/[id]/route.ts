import { gateReport, viewScope } from "@/lib/gate";
import { createClient, getUser } from "@/lib/supabase/server";
import {
  deleteOriginalForUser,
  getProfilePlan,
  getUploadForUser,
  isRecomputing,
} from "@/lib/supabase/service";
import type { ClassifiedTxn } from "@/types/transaction";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function unauthorized(): Response {
  return Response.json({ error: "upstream" }, { status: 401 });
}

function notFound(): Response {
  return new Response(null, { status: 404 });
}

async function fetchTransactionsForUser(
  userId: string,
  uploadId: string,
): Promise<ClassifiedTxn[]> {
  const client = await createClient();
  const { data, error } = await client
    .from("transactions")
    .select("row_index, txn_date, merchant, amount, account_code, verdict")
    .eq("user_id", userId)
    .eq("upload_id", uploadId)
    .order("row_index", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    rowIndex: row.row_index as number,
    txnDate: row.txn_date as string,
    merchant: row.merchant as string,
    amount: row.amount as number,
    accountCode: row.account_code as ClassifiedTxn["accountCode"],
    verdict: row.verdict as ClassifiedTxn["verdict"],
  }));
}

async function deleteUploadRow(userId: string, uploadId: string): Promise<void> {
  const client = await createClient();
  const { error } = await client
    .from("uploads")
    .delete()
    .eq("user_id", userId)
    .eq("id", uploadId);
  if (error) throw error;
}

export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  void req;
  try {
    const user = await getUser();
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    const upload = await getUploadForUser(user.id, id);
    if (!upload) return notFound();

    if (upload.status === "processing") {
      return Response.json({ id: upload.id, status: upload.status });
    }
    if (upload.status === "failed") {
      return Response.json({
        id: upload.id,
        status: upload.status,
        error_code: upload.errorCode,
      });
    }
    if (!upload.summary) throw new Error("completed upload missing summary");

    const plan = await getProfilePlan(user.id);
    const scope = viewScope(plan);
    const transactions = scope.canViewTransactions
      ? await fetchTransactionsForUser(user.id, id)
      : [];
    const report = gateReport(plan, upload.summary, transactions);
    if (!scope.canViewTransactions) {
      report.lockedTxnCount = upload.rowCount ?? 0;
    }

    return Response.json({
      id: upload.id,
      status: upload.status,
      report,
      canRetry: Boolean(upload.storagePath) && new Date(upload.expiresAt).getTime() > Date.now(),
      // 재계산이 도는 동안에도 status 는 completed 다. 화면이 폴링을 언제 멈출지
      // 알려면 이 플래그가 있어야 한다.
      recomputing: isRecomputing(upload.recomputeStartedAt),
      recomputed_at: upload.recomputedAt,
    });
  } catch {
    console.error(JSON.stringify({ event: "upload_detail_failed", code: "upstream" }));
    return Response.json({ error: "upstream" }, { status: 500 });
  }
}

export async function DELETE(req: Request, ctx: RouteContext): Promise<Response> {
  void req;
  try {
    const user = await getUser();
    if (!user) return unauthorized();
    const { id } = await ctx.params;
    const upload = await getUploadForUser(user.id, id);
    if (!upload) return notFound();

    if (upload.storagePath) {
      await deleteOriginalForUser(user.id, upload.storagePath);
    }
    await deleteUploadRow(user.id, id);
    return new Response(null, { status: 204 });
  } catch {
    console.error(JSON.stringify({ event: "upload_delete_failed", code: "upstream" }));
    return Response.json({ error: "upstream" }, { status: 500 });
  }
}
