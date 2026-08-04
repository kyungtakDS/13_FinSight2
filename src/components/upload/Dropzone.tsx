"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { decodeForPreview, previewCsv, type CsvPreview } from "@/lib/csv/preview";

import { DetectCard } from "./DetectCard";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

export const ERROR_MESSAGES = {
  parse_failed: "CSV 파일을 읽지 못했습니다. 파일 형식을 확인해 주세요.",
  too_large: "파일은 최대 2MB까지 올릴 수 있습니다.",
  duplicate_file: "이미 분석한 파일입니다",
  analysis_failed: "분석을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  upstream: "요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
  expired: "원본 보관 기간이 지나 다시 분석할 수 없습니다.",
  payment_required: "이 기능은 Pro 구독이 필요합니다.",
} as const;

type ErrorCode = keyof typeof ERROR_MESSAGES;

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === "string" && value in ERROR_MESSAGES;
}

export function Dropzone() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [existingUploadId, setExistingUploadId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function inspectFile(candidate: File | undefined) {
    setError(null);
    setExistingUploadId(null);
    setFile(null);
    setPreview(null);
    if (!candidate) return;
    if (!candidate.name.toLowerCase().endsWith(".csv")) {
      setError("CSV 파일만 지원합니다. 엑셀에서 ‘다른 이름으로 저장’을 선택해 CSV 형식으로 저장해 주세요.");
      return;
    }
    if (candidate.size > MAX_FILE_BYTES) {
      setError(ERROR_MESSAGES.too_large);
      return;
    }
    try {
      const decoded = decodeForPreview(await candidate.arrayBuffer());
      setFile(candidate);
      setPreview({ ...previewCsv(decoded.text), encoding: decoded.encoding });
    } catch {
      setError(ERROR_MESSAGES.parse_failed);
    }
  }

  async function submit() {
    if (!file || uploading) return;
    setUploading(true);
    setError(null);
    setExistingUploadId(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body: form });
      const body: unknown = await response.json().catch(() => null);
      const record = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
      if (response.status === 202 && typeof record.id === "string") {
        router.push(`/dashboard/uploads/${record.id}`);
        return;
      }
      if (response.status === 409 && typeof record.existingUploadId === "string") {
        setError(ERROR_MESSAGES.duplicate_file);
        setExistingUploadId(record.existingUploadId);
        return;
      }
      setError(ERROR_MESSAGES[isErrorCode(record.error) ? record.error : "upstream"]);
    } catch {
      setError(ERROR_MESSAGES.upstream);
    } finally {
      setUploading(false);
    }
  }

  return (
    <section id="csv-upload" aria-labelledby="upload-title">
      <span className="fs-eyebrow">CSV 업로드</span>
      <h2 id="upload-title" className="fs-page-title">카드 명세서를 선택하세요</h2>
      <p className="fs-muted">선택한 파일을 먼저 확인한 뒤 분석을 시작할 수 있습니다.</p>
      <label
        className={`fs-drop${dragging ? " drag" : ""}`}
        onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          void inspectFile(event.dataTransfer.files[0]);
        }}
      >
        <span className="fs-h">파일을 끌어다 놓거나 클릭해 선택</span>
        <span className="fs-muted">CSV 전용 · 최대 2MB / 3,000행</span>
        <input
          aria-label="카드 명세서 CSV 파일 선택"
          type="file"
          accept=".csv,text/csv"
          onChange={(event) => void inspectFile(event.target.files?.[0])}
        />
      </label>

      {error && <p role="alert">{error}</p>}
      {existingUploadId && (
        <p><Link href={`/dashboard/uploads/${existingUploadId}`}>기존 분석 보기</Link></p>
      )}
      {file && preview && (
        <>
          <DetectCard filename={file.name} {...preview} />
          <button type="button" className="fs-google" disabled={uploading} onClick={() => void submit()}>
            {uploading ? "업로드 중" : "분석 시작"}
          </button>
          <button type="button" className="fs-google" disabled={uploading} onClick={() => void inspectFile(undefined)}>
            다른 파일 선택
          </button>
        </>
      )}
    </section>
  );
}
