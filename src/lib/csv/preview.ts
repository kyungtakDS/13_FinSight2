export interface CsvPreview {
  encoding: "utf-8" | "cp949";
  rowCount: number;
  headerLabels: string[] | null;
  issuerHint: string | null;
}

const HEADER_TERMS = ["일자", "날짜", "가맹점", "상호", "금액", "이용", "승인"];
const ISSUER_PATTERN = /([가-힣A-Za-z ]{1,20}(?:카드|Card))/i;

export function decodeForPreview(
  bytes: ArrayBuffer,
): { text: string; encoding: "utf-8" | "cp949" } {
  try {
    return {
      text: new TextDecoder("utf-8", { fatal: true }).decode(bytes),
      encoding: "utf-8",
    };
  } catch {
    return {
      text: new TextDecoder("euc-kr").decode(bytes),
      encoding: "cp949",
    };
  }
}

function labelsFor(line: string): string[] {
  return line
    .split(",")
    .map((label) => label.trim().replace(/^['"]|['"]$/g, ""))
    .filter(Boolean);
}

export function previewCsv(text: string): CsvPreview {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/);
  while (lines.at(-1)?.trim() === "") lines.pop();

  const headerLabels =
    lines
      .slice(0, 20)
      .map(labelsFor)
      .find(
        (labels) =>
          labels.length >= 2 &&
          labels.filter((label) => HEADER_TERMS.some((term) => label.includes(term))).length >= 2,
      ) ?? null;
  const issuerHint = lines.slice(0, 20).join(" ").match(ISSUER_PATTERN)?.[1]?.trim() ?? null;

  return {
    encoding: "utf-8",
    rowCount: lines.filter((line) => line.trim() !== "").length,
    headerLabels,
    issuerHint,
  };
}
