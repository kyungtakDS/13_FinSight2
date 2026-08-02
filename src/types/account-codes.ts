export const ACCOUNT_CODES = Object.freeze([
  Object.freeze({ code: "welfare", label: "복리후생비" }),
  Object.freeze({ code: "travel", label: "여비교통비" }),
  Object.freeze({ code: "entertainment", label: "기업업무추진비" }),
  Object.freeze({ code: "comms", label: "통신비" }),
  Object.freeze({ code: "utilities", label: "수도광열비" }),
  Object.freeze({ code: "taxes", label: "세금과공과" }),
  Object.freeze({ code: "rent", label: "지급임차료" }),
  Object.freeze({ code: "repair", label: "수선비" }),
  Object.freeze({ code: "insurance", label: "보험료" }),
  Object.freeze({ code: "vehicle", label: "차량유지비" }),
  Object.freeze({ code: "shipping", label: "운반비" }),
  Object.freeze({ code: "training", label: "교육훈련비" }),
  Object.freeze({ code: "books", label: "도서인쇄비" }),
  Object.freeze({ code: "supplies", label: "소모품비" }),
  Object.freeze({ code: "fees", label: "지급수수료" }),
  Object.freeze({ code: "ads", label: "광고선전비" }),
  Object.freeze({ code: "outsourcing", label: "외주용역비" }),
  Object.freeze({ code: "etc", label: "기타" }),
] as const);

export type AccountCode = (typeof ACCOUNT_CODES)[number]["code"];

export function isAccountCode(value: unknown): value is AccountCode {
  return (
    typeof value === "string" &&
    ACCOUNT_CODES.some(({ code }) => code === value)
  );
}

export function accountLabel(code: AccountCode): string {
  return ACCOUNT_CODES.find((account) => account.code === code)!.label;
}
