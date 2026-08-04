import { viewScope } from "@/lib/gate";
import { createClient, getUser } from "@/lib/supabase/server";
import { getProfilePlan, getUploadForUser } from "@/lib/supabase/service";
import { accountLabel, type AccountCode } from "@/types/account-codes";
import type { Verdict } from "@/types/transaction";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

type ExportTransaction = {
  row_index: number;
  txn_date: string;
  merchant: string;
  amount: number;
  account_code: AccountCode | null;
  verdict: Verdict;
};

const VERDICT_LABELS: Record<Verdict, string> = {
  expense: "사업 경비",
  personal: "개인 지출",
  uncertain: "애매",
};

const DISCLAIMER =
  "본 서비스는 세무 자문이 아니며 최종 판단은 세무대리인과 상의하십시오.";
const BOM = "\ufeff";

function csvCell(value: string | number): string {
  let cell = String(value);
  // CSV injection defense: Excel must not execute user-originated cells as formulas.
  if (/^[=+\-@\t\r]/.test(cell)) cell = `'${cell}`;
  return /[",\r\n]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell;
}

function createCsv(
  transactions: ExportTransaction[],
  reasons: ReadonlyMap<string, string>,
): string {
  const rows: Array<Array<string | number>> = [
    ["거래일자", "가맹점명", "금액", "계정과목", "판정", "근거"],
    ...transactions.map((transaction) => [
      transaction.txn_date,
      transaction.merchant,
      transaction.amount,
      transaction.account_code ? accountLabel(transaction.account_code) : "",
      VERDICT_LABELS[transaction.verdict],
      reasons.get(transaction.merchant) ?? "",
    ]),
    [],
    [DISCLAIMER],
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
}

export const csvGenerator = { create: createCsv };

function unauthorized(): Response {
  return Response.json({ error: "upstream" }, { status: 401 });
}

function notFound(): Response {
  return new Response(null, { status: 404 });
}

async function fetchExportData(
  userId: string,
  uploadId: string,
): Promise<{ transactions: ExportTransaction[]; reasons: Map<string, string> }> {
  const client = await createClient();
  const { data: transactionData, error: transactionError } = await client
    .from("transactions")
    .select("row_index, txn_date, merchant, amount, account_code, verdict")
    .eq("user_id", userId)
    .eq("upload_id", uploadId)
    .order("row_index", { ascending: true });
  if (transactionError) throw transactionError;

  const transactions = (transactionData ?? []) as ExportTransaction[];
  const merchantKeys = [...new Set(transactions.map(({ merchant }) => merchant))];
  if (merchantKeys.length === 0) return { transactions, reasons: new Map() };

  const { data: dictionaryData, error: dictionaryError } = await client
    .from("merchant_dictionary")
    .select("merchant_key, reason")
    .in("merchant_key", merchantKeys);
  if (dictionaryError) throw dictionaryError;

  const reasons = new Map<string, string>();
  for (const row of dictionaryData ?? []) {
    if (typeof row.reason === "string") reasons.set(row.merchant_key as string, row.reason);
  }
  return { transactions, reasons };
}

export async function GET(req: Request, ctx: RouteContext): Promise<Response> {
  void req;
  try {
    const user = await getUser();
    if (!user) return unauthorized();

    const { id } = await ctx.params;
    const upload = await getUploadForUser(user.id, id);
    if (!upload) return notFound();

    const plan = await getProfilePlan(user.id);
    if (!viewScope(plan).canExport) {
      return Response.json({ error: "payment_required" }, { status: 402 });
    }
    if (upload.status !== "completed") {
      return Response.json({ error: "analysis_failed" }, { status: 409 });
    }

    const { transactions, reasons } = await fetchExportData(user.id, id);
    const csv = csvGenerator.create(transactions, reasons);
    const periodStart = upload.periodStart ?? "unknown";
    const periodEnd = upload.periodEnd ?? "unknown";
    const filename = `finsight_${id}_${periodStart}_${periodEnd}.csv`;

    return new Response(BOM + csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    console.error(JSON.stringify({ event: "upload_export_failed", code: "upstream" }));
    return Response.json({ error: "upstream" }, { status: 500 });
  }
}
