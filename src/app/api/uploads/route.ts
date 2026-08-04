import { randomUUID } from "node:crypto";

import { after } from "next/server";

import { runAnalysis } from "@/lib/analysis/run-analysis";
import { fileHash } from "@/lib/csv/fingerprint";
import { createClient, getUser } from "@/lib/supabase/server";
import { storagePathFor } from "@/lib/supabase/service";

export const runtime = "nodejs";
export const maxDuration = 300;

const BUCKET = "csv-uploads";
const MAX_FILE_BYTES = 2 * 1024 * 1024;
const LIST_LIMIT = 100;
const RETENTION_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

function errorResponse(
  error:
    | "parse_failed"
    | "too_large"
    | "duplicate_file"
    | "analysis_failed"
    | "upstream"
    | "expired"
    | "payment_required",
  status: number,
  extra?: Record<string, string>,
): Response {
  return Response.json({ error, ...extra }, { status });
}

export async function POST(req: Request): Promise<Response> {
  let userId: string | undefined;
  let rowCreated = false;
  let objectUploaded = false;
  let uploadedPath: string | undefined;

  try {
    const user = await getUser();
    if (!user) return errorResponse("upstream", 401);
    userId = user.id;

    const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.startsWith("multipart/form-data")) {
      return errorResponse("parse_failed", 400);
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return errorResponse("parse_failed", 400);
    }
    const candidate = form.get("file");
    if (
      typeof candidate !== "object" ||
      candidate === null ||
      !("name" in candidate) ||
      !("size" in candidate) ||
      typeof candidate.name !== "string" ||
      typeof candidate.size !== "number"
    ) {
      return errorResponse("parse_failed", 400);
    }
    const file = candidate;
    if (!file.name.toLowerCase().endsWith(".csv")) {
      return errorResponse("parse_failed", 400);
    }
    if (file.size > MAX_FILE_BYTES) return errorResponse("too_large", 400);
    if (file.size === 0) return errorResponse("parse_failed", 400);

    const bytes = new Uint8Array(await new Response(file).arrayBuffer());
    const hash = fileHash(bytes);
    const client = await createClient();
    const { data: duplicate, error: duplicateError } = await client
      .from("uploads")
      .select("id")
      .eq("user_id", userId)
      .eq("file_hash", hash)
      .maybeSingle();
    if (duplicateError) throw new Error("duplicate lookup failed");
    if (duplicate) {
      return errorResponse("duplicate_file", 409, {
        existingUploadId: duplicate.id as string,
      });
    }

    const uploadId = randomUUID();
    uploadedPath = storagePathFor(userId, uploadId);
    const { error: uploadError } = await client.storage
      .from(BUCKET)
      .upload(uploadedPath, bytes, { contentType: "text/csv", upsert: false });
    if (uploadError) throw new Error("storage upload failed");
    objectUploaded = true;

    const expiresAt = new Date(Date.now() + RETENTION_DAYS_MS).toISOString();
    const { data: inserted, error: insertError } = await client
      .from("uploads")
      .insert({
        id: uploadId,
        user_id: userId,
        storage_path: uploadedPath,
        filename: file.name,
        file_hash: hash,
        status: "processing",
        retry_count: 0,
        expires_at: expiresAt,
      })
      .select("id")
      .single();
    if (insertError || !inserted) throw new Error("upload insert failed");
    rowCreated = true;

    const accepted = Response.json({ id: inserted.id }, { status: 202 });
    after(() => runAnalysis(userId!, inserted.id as string));
    return accepted;
  } catch {
    if (userId && uploadedPath && objectUploaded && !rowCreated) {
      try {
        await (await createClient()).storage.from(BUCKET).remove([uploadedPath]);
      } catch {
        // Compensation is best-effort and must not expose Storage details.
      }
    }
    console.error(JSON.stringify({ event: "upload_ingest_failed", code: "upstream" }));
    return errorResponse("upstream", 500);
  }
}

export async function GET(req: Request): Promise<Response> {
  void req;
  try {
    const user = await getUser();
    if (!user) return errorResponse("upstream", 401);
    const client = await createClient();
    const { data, error } = await client
      .from("uploads")
      .select("id, filename, status, error_code, period_start, period_end, row_count, expires_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(LIST_LIMIT);
    if (error) throw new Error("upload list failed");
    return Response.json({ uploads: data ?? [] });
  } catch {
    console.error(JSON.stringify({ event: "upload_list_failed", code: "upstream" }));
    return errorResponse("upstream", 500);
  }
}
