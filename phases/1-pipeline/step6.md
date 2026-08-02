# Step 6: aggregate

## 목적

**모든 산술을 여기서 한다.** 합계 · 구성비 · 계정과목 집계 · 절세 추정액 · 인사이트.

모델은 *거래별 계정과목 · 경비 판정 · 근거 한 줄*까지만 답한다. 산술을 모델에 맡기면 틀려도 그럴듯해서 검출되지 않고, 세무 자료에서 합계 오류는 사용자에게 실제 리스크를 넘긴다(ADR-004).

**순수 함수 하나다.** DB도 네트워크도 없다 — 테스트가 픽스처 배열만으로 돈다.

## 이전 Step과의 의존성

- **Phase 0 step 2 (`core-types`)** — `ClassifiedTxn`·`UploadSummary`·`AccountBreakdown`·`Insight`·`ACCOUNT_CODES`
- **step 5 (`classify-merchants`)** / **step 4 (`merchant-dictionary`)** — 분류 결과의 형태. 직접 import하지는 않는다

## 읽어야 할 파일

- `/docs/ADR.md` — **ADR-004(산술은 서버)** · ADR-013(uncertain은 추정액에서 제외) · ADR-011(포지셔닝) · ADR-014(취소 상계)
- `/docs/PRD.md` — §분류 실패 처리 · §구독 및 기능 게이트(무료는 인사이트 상위 3개)
- `/docs/ARCHITECTURE.md` — §분류 실패와 중복 처리 · §DB 스키마의 `uploads.summary`
- `/docs/DESIGN.md` — §6의 `/dashboard/uploads/:id` completed 조립 · §8 숫자 표기
- `/src/types/report.ts` · `/src/types/transaction.ts` · `/src/types/account-codes.ts`
- `/phases/PLAN.md` — **D-6(절세 추정 세율 6.6%)**

## 구현 범위

`src/lib/report/aggregate.ts` 하나.

```ts
export const ESTIMATED_TAX_RATE = 0.066;   // 소득세 최저 6% + 지방소득세 10%. 항상 하한.

export function aggregate(txns: ClassifiedTxn[]): UploadSummary;

/** 기간은 거래 날짜에서 뽑는다. 파일명이나 사용자 입력에서 오지 않는다. */
export function txnPeriod(txns: ClassifiedTxn[]): { start: string | null; end: string | null };
```

## 수정 대상 파일

```
src/lib/report/aggregate.ts        (신규)
src/lib/report/aggregate.test.ts   (신규 — 먼저)
```

## 먼저 작성할 테스트

전부 픽스처 배열로. mock이 필요 없다.

### 합계 — 취소 상계
1. `expense` 3건 합계가 정확하다
2. **취소 행(음수)이 상계된다** — `+10000`과 `-10000`이 같은 계정과목이면 그 과목 합계가 `0`이다
3. 취소 행을 버리지 않는다 (건수에 포함된다)
4. 상계 결과가 음수인 계정과목도 그대로 남는다 (숨기면 총합과 안 맞는다)

### `uncertain` 처리 ← 세무 안전성의 핵심
5. **`uncertain` 거래가 `estimatedSaving`에서 제외된다**
6. **`uncertain` 거래가 `expenseTotal`에서 제외된다**
7. `uncertainCount`가 정확하다
8. `uncertainTotal`이 별도로 집계된다 (사용자가 세무사에게 물을 금액을 알아야 한다)
9. `uncertain`이 계정과목 breakdown에 섞이지 않는다 — 도넛에 "애매" 조각이 생기면 안 된다
10. **전부 `uncertain`인 입력**: `estimatedSaving`이 `0`이고 예외가 나지 않는다

### 절세 추정액
11. `estimatedSaving === Math.floor(expenseTotal * ESTIMATED_TAX_RATE)`
12. **버림이다. 반올림·올림이 아니다** — 추정액은 항상 하한이어야 한다(ADR-013)
13. `expenseTotal`이 음수면(취소가 더 많은 파일) `estimatedSaving`이 `0`이다. 음수 절감액은 의미가 없다
14. `taxRate`가 summary에 실려 나간다 — 화면이 "무엇 기준"인지 말할 수 있어야 한다

### 계정과목 집계
15. `accounts`가 **금액 내림차순**으로 정렬된다 — DESIGN.md의 `--fs-chart-1..6` 램프가 "금액 내림차순 순위대로" 배정되기 때문이다
16. `ratio`의 합이 1에 수렴한다 (부동소수 오차 허용)
17. `label`이 `ACCOUNT_CODES`에서 온다 (문자열을 다시 적지 않는다)
18. `accountCode`가 `null`인 `expense` 거래는 `etc`로 가지 **않고** 별도 처리 — 실제로는 `uncertain`만 `null`이므로 이런 입력은 없어야 하고, 있으면 그 사실이 드러나야 한다

### 인사이트 — 서버가 결정적으로 만든다
19. `insights`가 **결정적**이다 — 같은 입력 두 번 호출하면 완전히 같은 배열
20. 각 인사이트에 안정적인 `id`가 있다 (게이트가 상위 3개를 자르므로 순서가 의미를 갖는다)
21. **`uncertain`이 1건 이상이면 그 인사이트가 항상 포함된다** — 애매 건수는 숨기지 않는다
22. 취소 거래가 있으면 상계 금액 인사이트가 포함된다
23. 데이터가 없으면 인사이트가 빈 배열이다 (억지로 만들지 않는다)
24. 인사이트 문구에 **단정적 지시가 없다** — `경비 처리하세요`·`환급받으세요` 같은 문자열이 없음을 검사하라

### 빈 입력
25. 빈 배열을 주면 모든 합계가 `0`이고 예외가 나지 않는다
26. `txnPeriod([])`가 `{start: null, end: null}`

### 순수성
27. 입력 배열을 변형하지 않는다 (정렬을 in-place로 하지 마라)
28. `console.*` 호출 0회

## Codex 실행 지시문

### 정수 산술

금액은 원 단위 정수(`bigint` 컬럼)다. **부동소수로 합산하지 마라.** 절감액 계산에서만 `* 0.066`이 들어가고, 그 결과를 `Math.floor`로 정수화한다.

`Math.round`·`Math.ceil`을 쓰지 마라. **이유**: 추정액은 항상 보수적인 하한이어야 한다. 세무에서 과대 추정은 사용자에게 리스크를 넘기는 행위다(ADR-013).

### `uncertain`은 어디에도 안 섞인다

- `expenseTotal`에서 제외
- `estimatedSaving`에서 제외
- `accounts` breakdown에서 제외 (도넛에 조각이 생기면 안 된다)
- 대신 `uncertainCount`·`uncertainTotal`로 **따로, 보이게** 남긴다

리포트 상단에 "애매 n건"을 표시하는 것이 DESIGN.md §7의 요구사항이다. 숫자가 없으면 화면이 못 만든다.

### 인사이트는 규칙 기반, 결정적

모델에게 인사이트를 만들게 하지 마라. 규칙 몇 개를 코드로 박는다. 예:

- 가장 큰 계정과목과 그 비중
- `uncertain` n건 — **항상 포함** (있으면)
- 취소·부분취소 상계 금액 (있으면)
- 경비 후보 비율
- 기간 내 거래가 집중된 월 (있으면)

**순서가 곧 우선순위다.** 무료 사용자는 게이트가 자른 상위 3개만 본다(PRD). 가장 설득력 있는 것부터 배열하되, `uncertain` 인사이트는 숨기면 안 되므로 **상위 3개 안에 들도록** 우선순위를 잡아라.

문구 규칙(ADR-011 · DESIGN.md §8):
- **"경비 처리 가능성이 높은 항목"** · **"예상 절감액(참고용)"**
- 단정적 지시를 쓰지 마라: `경비 처리하세요` · `환급받으세요` · `신고하세요`
- 이 서비스는 세무 자문이 아니다

### 인사이트 개수를 여기서 자르지 마라

`aggregate`는 **전체 인사이트**를 반환한다. 무료 3개 절단은 `lib/gate.ts`(Phase 2 step 0)가 한다. 여기서 자르면 유료 사용자가 3개밖에 못 본다.

### `txnPeriod`

`uploads.period_start`/`period_end`에 들어갈 값. 거래 날짜의 최소·최대다. **파일명이나 사용자 입력에서 뽑지 마라.**

### 계정과목 정렬

금액 내림차순. DESIGN.md §2: *"`--fs-chart-1`~`6` … **금액 내림차순 순위대로** 배정, 7번째부터 순환"*. 정렬이 여기서 확정돼야 차트 컴포넌트가 색을 인덱스로 고를 수 있다.

동점이면 `ACCOUNT_CODES` 선언 순서로 안정 정렬한다 — 결정적이어야 한다.

## 완료 조건

- `aggregate`·`txnPeriod`·`ESTIMATED_TAX_RATE`가 존재하고 28개 테스트가 전부 통과한다
- `uncertain`이 `expenseTotal`·`estimatedSaving`·`accounts` 어디에도 안 섞인다
- 절감액이 `Math.floor`다
- 인사이트가 결정적이고 단정적 지시 문구가 없다
- 인사이트를 여기서 3개로 자르지 않는다
- 입력 배열을 변형하지 않는다
- DB·네트워크·env 접근 없음, `console.*` 호출 0회
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/lib/report/aggregate.test.ts
```

직접 확인:

```bash
grep -nE "Math\.round|Math\.ceil" src/lib/report/aggregate.ts && echo "FAIL: 하한이 아님" || echo "OK"
grep -nE "경비 처리하세요|환급받으세요|신고하세요" src/lib/report/aggregate.ts && echo "FAIL: 단정적 지시" || echo "OK"
grep -nE "process\.env|supabase|fetch\(|slice\(0, ?3\)" src/lib/report/aggregate.ts && echo "확인 필요" || echo "OK"
grep -n "console\." src/lib/report/aggregate.ts && echo "FAIL" || echo "OK"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md §디렉토리 구조의 `lib/report/aggregate.ts` 한 파일인가?
   - ADR-004 — 모든 산술이 여기 있고 모델이 관여하지 않는가?
   - ADR-013 — `uncertain`이 추정액에서 제외되고 건수는 보이는가?
   - ADR-014 — 취소가 상계되고 버려지지 않는가?
   - ADR-011 / DESIGN.md §8 — 단정적 지시 문구가 없는가?
   - DESIGN.md §2 — 계정과목이 금액 내림차순인가?
   - 순수 함수인가? (DB·네트워크·env 없음)
3. 결과에 따라 `phases/1-pipeline/index.json`의 step 6을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "lib/report/aggregate.ts — aggregate(txns) → UploadSummary. 취소 상계, uncertain은 expenseTotal/estimatedSaving/accounts에서 제외하고 count·total로 별도 노출, 절감액은 floor(expenseTotal*0.066) 하한, accounts는 금액 내림차순, insights는 규칙 기반 결정적 전체 목록(절단은 gate 소관). 순수 함수")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단

**이 step이 끝나면 Phase 1이 완료된다.** `summary`에 「Phase 1 검토 지점: 실제 카드사 CSV 2~3개로 파싱 수동 검증 필요」를 덧붙여라(`phases/PLAN.md` D-9).

## commit 기준

`feat(1-pipeline): step 6 — aggregate`

포함: `src/lib/report/aggregate.{ts,test.ts}`

## 금지사항

- **`Math.round`·`Math.ceil`로 절감액을 계산하지 마라.** 이유: 추정액은 항상 하한이어야 한다. 과대 추정은 사용자에게 리스크를 넘긴다(ADR-013).
- **`uncertain`을 추정액이나 계정과목 집계에 넣지 마라.** 이유: 도넛에 "애매" 조각이 생기고 추정액이 하한이 아니게 된다.
- **`uncertain` 건수를 숨기지 마라.** 이유: 사용자가 그 n건을 세무사에게 따로 물을 수 있어야 한다(PRD).
- **취소 행을 버리거나 절대값으로 만들지 마라.** 이유: 합계가 조용히 틀어진다(ADR-014).
- **인사이트를 여기서 3개로 자르지 마라.** 이유: 절단은 `lib/gate.ts`의 일이고, 여기서 자르면 유료 사용자도 3개밖에 못 본다.
- **인사이트를 모델에게 만들게 하지 마라.** 이유: 산술과 문구가 모델 출력에 얹히는 순간 ADR-004가 무너지고 재현성이 사라진다.
- **단정적 지시 문구를 쓰지 마라** (`경비 처리하세요`·`환급받으세요`). 이유: 무자격 세무자문으로 해석될 여지가 생기고 오판 책임이 우리에게 온다(ADR-011).
- **여러 업로드를 가로지르는 집계 함수를 만들지 마라.** 이유: 리포트의 단위는 업로드 1건이고, 합산을 만드는 순간 파일 간 중복 거래 문제가 따라온다(ADR-014).
- **사용자별 세율 입력을 받지 마라.** 이유: 요청되지 않았고, 세율을 사용자가 정하게 하면 "참고용 추정"이 아니라 세무 계산이 된다.
- **DB·네트워크·`process.env`를 건드리지 마라.**
- **입력 배열을 in-place로 정렬하지 마라.**
- 기존 테스트를 깨뜨리지 마라.
