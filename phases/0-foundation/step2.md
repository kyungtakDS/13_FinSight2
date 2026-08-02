# Step 2: core-types

## 목적

이후 모든 step이 공유하는 **타입과 고정 어휘**를 한 곳에 박는다.

고정 어휘가 셋이다. 각각이 문서에서 "고정"이라고 못박은 것이고, 코드 여러 곳이 **같은 상수를 읽어야** 한다:

| 어휘 | 개수 | 어디서 읽나 |
|---|---|---|
| 클라이언트 에러 코드 | 7 | API 라우트 · 실패 화면 |
| 거래 판정(`verdict`) | 3 | 분류 · 집계 · 칩 색 · DB check 제약 |
| 계정과목(`account_code`) | 18 | Claude 프롬프트 · 사전 적재 검증 · 도넛 범례 |

이 셋이 코드 여러 군데에 흩어져 하드코딩되면 **어긋나는 순간을 아무도 모른다.**

## 이전 Step과의 의존성

- **step 0 (`project-setup`)** — `tsconfig.json`의 `strict: true`와 `@/*` alias, Vitest 설정
- **step 1 (`design-tokens`)** — 직접 의존은 없다. 다만 `verdict` 3값이 `design/theme.css`의 `--fs-biz`/`--fs-personal`/`--fs-unsure` 토큰과 1:1로 대응해야 하므로 그 파일을 읽는다

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — §DB 스키마 (테이블 컬럼이 곧 타입이다) · §오류 처리 (에러 어휘 7개)
- `/docs/PRD.md` — §분류 실패 처리 (3값의 의미) · §구독 및 기능 게이트
- `/docs/DESIGN.md` — §2 「판정 3값의 색은 고정이다」 표 · §7 「실패 문구는 고정 어휘 7개에서만」
- `/docs/ADR.md` — ADR-004(산술은 서버) · ADR-013(3값) · ADR-015(transactions 스키마)
- `/src/styles/theme.css` — `--fs-biz`/`--fs-personal`/`--fs-unsure`/`--fs-chart-1..6` 토큰 이름 확인
- `/phases/PLAN.md` — **D-5(계정과목 고정 목록 18개)**. 목록은 거기 있다
- `/scripts/hooks/tdd-guard.mjs` — `src/types/`가 왜 면제인지

## 구현 범위

`src/types/` 아래 타입 정의와 상수. **로직은 넣지 않는다** — 함수를 쓰고 싶어지면 그건 `src/lib/` 소관이고 다음 Phase다.

예외로 허용하는 것: 상수 배열에서 파생되는 타입 가드 1개씩 (`isVerdict`·`isAccountCode`·`isErrorCode`). 이것들은 사전 적재 검증과 zod 스키마가 실제로 호출한다.

## 수정 대상 파일

```
src/types/errors.ts             (신규 — 클라이언트 에러 어휘 7개 + 타입 가드)
src/types/account-codes.ts      (신규 — 계정과목 18개 + 라벨 + 타입 가드)
src/types/transaction.ts        (신규 — verdict 3값 · 정규화 거래 · DB 행)
src/types/upload.ts             (신규 — upload 상태 · DB 행 · 목록 항목)
src/types/report.ts             (신규 — summary · 집계 · 인사이트 · 게이트 범위)
src/types/csv.ts                (신규 — 컬럼 매핑 · 포맷 매핑 DB 행)
src/types/index.ts              (신규 — 재수출)
src/types/constants.test.ts     (신규 — 먼저)
```

`src/types/`는 tdd-guard 면제지만, **고정 어휘가 문서와 어긋나지 않는 것을 지키는 테스트는 반드시 쓴다.** 면제는 "테스트를 안 써도 훅이 막지 않는다"는 뜻이지 "테스트가 필요 없다"는 뜻이 아니다.

## 먼저 작성할 테스트

`src/types/constants.test.ts`

1. `ERROR_CODES`가 정확히 7개이고 집합이 `{parse_failed, too_large, duplicate_file, analysis_failed, upstream, expired, payment_required}`와 같다
2. `VERDICTS`가 정확히 `['expense', 'personal', 'uncertain']`이다
3. `ACCOUNT_CODES`가 18개이고, `code`에 중복이 없고, `label`에 중복이 없다
4. 모든 `account_code`가 `^[a-z]+$` (ASCII 소문자만 — DB에 스냅샷으로 들어가므로 안정적이어야 한다)
5. 타입 가드 3개가 목록 안/밖 값을 정확히 가른다 (`isVerdict('expense')` true, `isVerdict('maybe')` false 등)
6. 상수 배열이 런타임에 불변이다 (`as const` + `Object.isFrozen` 또는 push 시도가 throw)

## Codex 실행 지시문

### `src/types/errors.ts`

```ts
export const ERROR_CODES = [
  'parse_failed', 'too_large', 'duplicate_file',
  'analysis_failed', 'upstream', 'expired', 'payment_required',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
export function isErrorCode(v: unknown): v is ErrorCode;
```

**이 7개 외에 코드를 추가하지 마라.** 어휘는 *사용자가 취할 수 있는 행동* 단위로 나눈 것이다 — 파싱 실패와 컬럼 매핑 실패는 사용자에게 같은 말이라 둘 다 `parse_failed`다. 진단용 세부 구분은 서버 로그에만 남긴다(ARCHITECTURE.md §오류 처리).

### `src/types/account-codes.ts`

`PLAN.md` D-5의 18개를 `{ code, label }` 배열로 박는다.

```ts
export const ACCOUNT_CODES = [
  { code: 'welfare',      label: '복리후생비' },
  { code: 'travel',       label: '여비교통비' },
  { code: 'entertainment',label: '기업업무추진비' },
  { code: 'comms',        label: '통신비' },
  { code: 'utilities',    label: '수도광열비' },
  { code: 'taxes',        label: '세금과공과' },
  { code: 'rent',         label: '지급임차료' },
  { code: 'repair',       label: '수선비' },
  { code: 'insurance',    label: '보험료' },
  { code: 'vehicle',      label: '차량유지비' },
  { code: 'shipping',     label: '운반비' },
  { code: 'training',     label: '교육훈련비' },
  { code: 'books',        label: '도서인쇄비' },
  { code: 'supplies',     label: '소모품비' },
  { code: 'fees',         label: '지급수수료' },
  { code: 'ads',          label: '광고선전비' },
  { code: 'outsourcing',  label: '외주용역비' },
  { code: 'etc',          label: '기타' },
] as const;
export type AccountCode = (typeof ACCOUNT_CODES)[number]['code'];
export function isAccountCode(v: unknown): v is AccountCode;
export function accountLabel(code: AccountCode): string;
```

코드는 ASCII, 라벨은 한글. **이유**: `transactions.account_code`는 분석 시점의 스냅샷이라(ARCHITECTURE.md) 나중에 라벨 문구를 다듬어도 과거 행이 깨지면 안 된다.

### `src/types/transaction.ts`

```ts
export const VERDICTS = ['expense', 'personal', 'uncertain'] as const;
export type Verdict = (typeof VERDICTS)[number];
export function isVerdict(v: unknown): v is Verdict;

/** CSV 정규화 결과. 아직 분류되지 않은 상태. */
export interface NormalizedTxn {
  rowIndex: number;       // 원본 행 번호. 정합성 검사용
  txnDate: string;        // 'YYYY-MM-DD'
  merchant: string;       // 정규화된 상호명
  amount: number;         // 원 단위 정수. 취소는 음수 — 부호를 보존한다
}

/** 분류까지 끝난 거래. transactions 테이블 행에 대응. */
export interface ClassifiedTxn extends NormalizedTxn {
  accountCode: AccountCode | null;
  verdict: Verdict;
}
```

**카드번호·승인번호 필드를 만들지 마라.** 정규화 단계에서 버리고 DB에도 컬럼이 없다(ADR-015 · AGENTS.md CRITICAL).

판정 근거(`reason`)를 `ClassifiedTxn`에 넣지 마라 — 상호명의 속성이라 `merchant_dictionary`에만 있고 조회 시 조인한다(ARCHITECTURE.md).

### `src/types/upload.ts`

`uploads` 테이블 행(ARCHITECTURE.md §DB 스키마)에 대응.

```ts
export const UPLOAD_STATUSES = ['processing', 'completed', 'failed'] as const;
export type UploadStatus = (typeof UPLOAD_STATUSES)[number];
```

상태는 **3개뿐이다.** 실패 사유는 상태가 아니라 `errorCode`로 구분한다. `partial`·`analyzing` 같은 상태를 추가하지 마라.

`filename`·`fileHash`·`storagePath`·`retryCount`·`periodStart`/`periodEnd`·`rowCount`·`summary`·`expiresAt`·타임스탬프를 포함한다.

### `src/types/report.ts`

`uploads.summary` jsonb의 형태 + 게이트 결과 페이로드.

```ts
export interface AccountBreakdown { code: AccountCode; label: string; total: number; count: number; ratio: number; }
export interface Insight { id: string; title: string; body: string; }   // 서버가 결정적으로 생성. 모델이 만들지 않는다
export interface UploadSummary {
  expenseTotal: number;      // 경비 후보 합계 (취소 상계 반영)
  personalTotal: number;
  uncertainCount: number;    // 숨기지 않고 표시한다
  uncertainTotal: number;
  estimatedSaving: number;   // 서버 산술. uncertain 제외한 하한
  taxRate: number;           // 추정에 쓴 세율. 화면이 "무엇 기준"인지 말할 수 있어야 한다
  accounts: AccountBreakdown[];
  insights: Insight[];       // 전체. 무료 절단은 gate 가 한다
  txnCount: number;
}

/** 게이트를 통과해 클라이언트로 나가는 형태. */
export interface GatedReport {
  summary: Omit<UploadSummary, 'insights'> & { insights: Insight[] };  // 무료면 3개로 잘려 있다
  transactions: ClassifiedTxn[];   // 무료면 길이 0 — 잘린 게 아니라 애초에 안 담는다
  lockedTxnCount: number;          // 무료가 "무엇이 잠겼는지" 표시하는 데만 쓴다
  canExport: boolean;
}
```

### `src/types/csv.ts`

```ts
export interface ColumnMap {
  date: number;        // 컬럼 인덱스
  merchant: number;
  amount: number;
  /** 취소/승인 구분 컬럼이 따로 있는 양식용. 없으면 null */
  txnType: number | null;
}
export interface CsvFormatMapping {
  headerFingerprint: string;
  columnMap: ColumnMap;
  headerRowIndex: number;
  encoding: 'utf-8' | 'cp949';
}
```

`ColumnMap`에 **카드번호·승인번호 컬럼을 넣지 마라.** 그 컬럼을 "알아야" 버릴 수 있는 게 아니다 — 매핑에 없는 컬럼은 전부 안 읽으므로 그냥 안 넣으면 된다.

## 완료 조건

- 위 7개 타입 파일 + 테스트가 존재한다
- `constants.test.ts` 6개 항목이 전부 통과한다
- `ERROR_CODES` 7개 · `VERDICTS` 3개 · `ACCOUNT_CODES` 18개
- 어디에도 카드번호·승인번호 필드가 없다
- `npm run build`가 통과한다 (아직 아무도 이 타입을 쓰지 않으므로 unused 경고가 나지 않게 `index.ts`에서 재수출한다)

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/types/constants.test.ts
```

민감 필드가 안 들어갔는지 확인:

```bash
grep -rniE "card_?number|카드번호|approval_?no|승인번호" src/types/ || echo "OK: 민감 필드 없음"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `src/types/`에만 두었는가? (`src/lib/`·`src/services/`에 상수를 흘리지 않았는가)
   - ARCHITECTURE.md §DB 스키마의 컬럼과 타입 필드가 일치하는가?
   - AGENTS.md CRITICAL — 카드번호·승인번호 필드가 없는가?
   - `verdict` 3값이 DESIGN.md §2 표(`--fs-biz`/`--fs-personal`/`--fs-unsure`)와 1:1인가?
3. 결과에 따라 `phases/0-foundation/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "src/types/ 7개 파일. ERROR_CODES(7)·VERDICTS(3)·ACCOUNT_CODES(18, ASCII code+한글 label)와 타입가드 3개. NormalizedTxn/ClassifiedTxn/UploadSummary/GatedReport/ColumnMap 정의")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단

## commit 기준

`feat(0-foundation): step 2 — core-types`

포함: `src/types/**`

## 금지사항

- **`src/types/`에 로직을 넣지 마라.** 허용되는 것은 상수 배열에서 파생되는 타입 가드뿐이다. 파싱·집계·포맷팅 함수를 여기 두지 마라 — `src/lib/` 소관이고 다음 Phase다.
- **카드번호·승인번호 필드를 만들지 마라.** 이유: 정규화 단계에서 제거하며 DB 스키마에 컬럼 자체가 없다(ADR-015). 타입에 두면 언젠가 채워진다.
- **에러 코드를 7개보다 늘리지 마라.** 이유: 어휘는 사용자가 취할 행동 단위이고, 진단용 구분은 서버 로그에만 남긴다.
- **`uploads` 상태를 3개보다 늘리지 마라.** 이유: 파이프라인 실패와 개별 거래 불확실을 같은 축에 놓으면 "80% 성공한 실패" 같은 상태가 생긴다(ARCHITECTURE.md).
- **`ClassifiedTxn`에 `reason`을 넣지 마라.** 이유: 근거는 상호명의 속성이라 `merchant_dictionary`에만 두고 조인한다.
- **계정과목을 마음대로 늘리거나 줄이지 마라.** 이유: 이 목록이 Claude 프롬프트에 그대로 박히고 사전 적재 검증 기준이 된다. 바꿔야 한다면 `phases/PLAN.md` D-5부터 고쳐라.
- 기존 테스트를 깨뜨리지 마라.
