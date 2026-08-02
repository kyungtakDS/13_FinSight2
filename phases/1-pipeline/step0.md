# Step 0: csv-normalize

## 목적

카드사 CSV 바이트를 **정규화된 거래 행**으로 바꾸는 순수 함수들을 만든다.

이것이 이 제품에서 **가장 위험한 부분**이다(ADR-012). 한국 카드사 명세서에는 표준이 없다 — 인코딩이 cp949인 경우가 흔하고, 상단에 메타 블록이 3~7행 깔리며, 컬럼명이 제각각이고, 취소 거래의 부호 표기가 카드사마다 다르다.

여기서 조용히 틀리면 **합계가 조용히 틀어진다.** 세무 자료에서 그건 사용자에게 리스크를 넘기는 것이다.

## 이전 Step과의 의존성

Phase 0 전체가 `completed`여야 한다. 직접 쓰는 것:

- **Phase 0 step 0** — `papaparse`·`iconv-lite`가 설치되어 있다
- **Phase 0 step 2 (`core-types`)** — `NormalizedTxn`·`ColumnMap` 타입

Phase 1 안에서는 첫 step이다.

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — §디렉토리 구조의 `lib/csv/normalize.ts` 한 줄 설명(인코딩 감지·헤더 행 탐지·금액 파싱·취소 부호 보존) · §데이터 흐름의 [정규화] 블록
- `/docs/ADR.md` — ADR-002(컬럼 매핑) · ADR-014(취소는 음수로 상계) · ADR-015(카드번호·승인번호 배제)
- `/docs/PRD.md` — §중복 거래 처리 · §제약(2MB / 3,000행)
- `/docs/DESIGN.md` — §8 숫자 표기 (취소는 `-₩8,900`으로 부호 보존)
- `/src/types/csv.ts` · `/src/types/transaction.ts` — step 2 산출물
- `/phases/PLAN.md` — **D-3(papaparse + iconv-lite, 인코딩 판별은 라이브러리 없이)**

## 구현 범위

`src/lib/csv/normalize.ts` 하나. **순수 함수만.** DB·네트워크·환경변수에 손대지 않는다.

```
detectEncoding(bytes)               → 'utf-8' | 'cp949'
decodeCsv(bytes, encoding)          → string          (BOM 제거)
parseRows(text)                     → string[][]
parseAmount(raw)                    → number          (원 단위 정수, 취소는 음수)
parseTxnDate(raw)                   → string | null   ('YYYY-MM-DD')
normalizeMerchant(raw)              → string
normalizeRows(rows, map, headerRowIndex) → { txns: NormalizedTxn[]; skipped: number }
```

## 수정 대상 파일

```
src/lib/csv/normalize.ts        (신규)
src/lib/csv/normalize.test.ts   (신규 — 먼저)
src/lib/csv/fixtures/           (신규 — 테스트 픽스처. 아래 참고)
```

## 먼저 작성할 테스트

`src/lib/csv/normalize.test.ts`. 픽스처는 **실제 카드사 파일을 넣지 마라** — 손으로 만든 합성 데이터를 쓴다(개인정보가 레포에 들어가면 안 된다).

### `detectEncoding`
1. UTF-8 한글 바이트 → `'utf-8'`
2. cp949 한글 바이트 → `'cp949'` (`iconv-lite`로 인코딩해 픽스처를 만든다)
3. UTF-8 BOM이 붙은 바이트 → `'utf-8'`
4. ASCII만 있는 바이트 → `'utf-8'` (모호할 땐 UTF-8이 안전한 기본값이다)

### `decodeCsv`
5. UTF-8 BOM이 결과 문자열 맨 앞에 남지 않는다 — **BOM이 남으면 첫 컬럼명이 `﻿이용일자`가 되어 매핑이 조용히 어긋난다**
6. cp949 확장 음절(예: `똠`·`뷁`)이 깨지지 않고 복원된다. `TextDecoder('euc-kr')`로는 이게 깨진다 — `iconv-lite`의 `cp949`를 써야 하는 이유다

### `parseRows`
7. 가맹점명에 콤마가 들어간 따옴표 필드(`"스타벅스 강남,2호점",10000`)가 한 셀로 파싱된다
8. 행마다 셀 수가 다른 파일(상단 메타 블록)이 깨지지 않고 그대로 들어온다
9. 마지막 빈 줄이 빈 행을 만들지 않는다

### `parseAmount` ← 여기가 조용히 틀리는 곳이다
10. `"10,000"` → `10000`
11. `"₩10,000"` · `"10,000원"` → `10000`
12. `"-8,900"` → `-8900` (선행 마이너스 보존)
13. `"(8,900)"` → `-8900` (괄호 음수 표기)
14. `"△8,900"` · `"▲8,900"` → `-8900` (한국 회계 관행의 음수 표기)
15. `"10,000.00"` → `10000` (소수점 절사, 원 단위 정수)
16. 공백·빈 문자열·`"-"` → `null` 또는 skip 대상 (throw하지 마라 — 한 행이 분석 전체를 죽이면 안 된다)
17. 값이 `Number.isSafeInteger` 범위를 넘으면 skip

### `parseTxnDate`
18. `2025.03.14` · `2025-03-14` · `2025/03/14` · `20250314` 전부 `'2025-03-14'`
19. `2025.03.14 13:22:01` (시각이 붙은 형태) → `'2025-03-14'`
20. 파싱 불가 → `null`

### `normalizeMerchant`
21. 앞뒤 공백 제거, 연속 공백 1칸으로
22. **카드번호 패턴(`1234-56**-****-7890` 같은 것)이 상호명에 섞여 있으면 제거한다**
23. 원문 대소문자·한글은 보존한다 (사전 조회 키이므로 과하게 정규화하면 히트율이 떨어진다)

### `normalizeRows` ← 통합
24. `headerRowIndex` 위쪽의 메타 블록 행이 전부 무시된다
25. 헤더 행 자체가 거래로 들어가지 않는다
26. `ColumnMap`에 없는 컬럼은 **읽지 않는다** — 카드번호·승인번호 컬럼이 원본에 있어도 결과 객체에 흔적이 없다
27. 취소 행의 음수가 보존된다 (버리지도, 절대값으로 만들지도 않는다)
28. 날짜·금액 파싱 실패 행은 skip되고 `skipped` 카운트에 잡힌다. **예외를 던지지 않는다**
29. `rowIndex`가 **원본 파일 기준 행 번호**다 (skip된 행이 있어도 번호가 밀리지 않는다) — `transactions.row_index`가 원본과의 정합성 검사용이기 때문이다
30. 3,000행을 넘으면 `RowLimitExceeded`를 던진다 (상한은 비용 노브가 아니라 안전 파라미터다 — ARCHITECTURE.md)

## Codex 실행 지시문

### 인코딩 판별 — 라이브러리를 쓰지 마라

```ts
// UTF-8 로 strict 디코드를 시도해서 throw 하면 cp949 로 본다. 결정적이고 의존성이 안 는다.
new TextDecoder('utf-8', { fatal: true }).decode(bytes);
```

`chardet`·`jschardet` 같은 통계적 판별기를 넣지 마라 — 확률로 답하는 도구는 여기서 필요 없다. 한국 카드사 CSV는 사실상 UTF-8 아니면 cp949 둘 중 하나다.

### 디코딩은 `iconv-lite`의 `cp949`

`TextDecoder('euc-kr')`을 쓰지 마라. **이유**: cp949는 euc-kr의 상위집합이고, 확장 음절 구간(`똠`·`뷁` 등)이 euc-kr 테이블에 없어 조용히 `?`가 된다.

BOM(`﻿`)은 디코드 직후 제거한다.

### 파싱은 `papaparse`

```ts
Papa.parse(text, { skipEmptyLines: 'greedy' });   // header: false — 헤더 위치를 우리가 안다
```

`header: true`를 쓰지 마라 — 헤더 행이 0번이 아닌 경우가 흔하고, 위치는 `ColumnMap`과 함께 온다.

직접 `split(',')` 하지 마라. **이유**: 가맹점명에 콤마가 들어간 따옴표 필드가 조용히 두 셀로 쪼개진다.

### 금액 파싱

제거 대상: `,` · `₩` · `원` · 공백 · 통화 기호. 음수 표기 3종을 인식한다: 선행 `-`, 괄호 `(...)`, 한국 회계 관행의 `△`/`▲`.

**음수를 버리거나 절대값으로 만들지 마라.** 취소·부분취소는 상계돼야 하고, 버리면 합계가 조용히 틀어진다(ADR-014 · DESIGN.md §8).

원 단위 정수로 반환한다 — DB 컬럼이 `bigint`다. 소수점은 절사한다(반올림하면 합계가 몇 원씩 어긋난다).

### 실패 처리 — 한 행이 분석을 죽이면 안 된다

행 단위 파싱 실패는 **skip하고 센다.** 예외를 던져 올리지 마라. 파이프라인 실패로 승격되는 것은 파일 전체를 못 읽는 경우뿐이다(ADR-013).

단, `RowLimitExceeded`(3,000행 초과)는 던진다 — 이건 행 문제가 아니라 파일 문제다.

### PII

이 파일의 어떤 함수도 **로그를 남기지 않는다.** 가맹점명·금액·CSV 내용 전부 PII다. 디버깅이 필요하면 호출부가 행 수만 남긴다.

에러 객체 메시지에도 셀 값을 넣지 마라 — 그 메시지가 로그로 흘러간다.

## 완료 조건

- `normalize.ts`의 함수 7개가 존재하고 30개 테스트 항목이 전부 통과한다
- 결과 `NormalizedTxn`에 카드번호·승인번호 흔적이 없다
- 취소 행의 음수가 보존된다
- 3,000행 초과 시 `RowLimitExceeded`
- 어떤 함수도 `console.*`을 호출하지 않는다
- DB·네트워크·`process.env`에 손대지 않는다
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/lib/csv/normalize.test.ts
```

직접 확인:

```bash
grep -n "console\." src/lib/csv/normalize.ts && echo "FAIL: 로깅" || echo "OK"
grep -nE "process\.env|supabase|fetch\(" src/lib/csv/normalize.ts && echo "FAIL: 순수하지 않음" || echo "OK"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md §디렉토리 구조의 `lib/csv/normalize.ts` 한 파일인가?
   - 순수 로직이 `src/lib/`에 있는가? (`src/services/`에 흘리지 않았는가)
   - AGENTS.md CRITICAL — 카드번호·승인번호를 정규화 단계에서 제거하는가?
   - AGENTS.md CRITICAL — 로그에 PII를 남기지 않는가?
   - ADR-014 — 취소 부호를 보존하는가?
3. 결과에 따라 `phases/1-pipeline/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "lib/csv/normalize.ts — detectEncoding(UTF-8 strict 실패 시 cp949)·decodeCsv(iconv-lite, BOM 제거)·parseRows(papaparse)·parseAmount(음수 3표기)·parseTxnDate(4형식)·normalizeMerchant·normalizeRows(rowIndex는 원본 기준, 실패 행 skip+카운트, 3000행 초과 시 RowLimitExceeded)")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단

## commit 기준

`feat(1-pipeline): step 0 — csv-normalize`

포함: `src/lib/csv/normalize.{ts,test.ts}` · `src/lib/csv/fixtures/**`

## 금지사항

- **직접 `split(',')`으로 CSV를 쪼개지 마라.** 이유: 가맹점명에 콤마가 들어간 따옴표 필드가 조용히 두 셀이 된다.
- **`TextDecoder('euc-kr')`로 cp949를 디코드하지 마라.** 이유: cp949는 euc-kr의 상위집합이라 확장 음절이 `?`로 깨진다.
- **`chardet`류 통계적 인코딩 판별기를 넣지 마라.** 이유: 확률로 답할 문제가 아니고 의존성만 는다.
- **취소 금액을 버리거나 절대값으로 만들지 마라.** 이유: 상계가 안 되면 합계가 조용히 틀어진다(ADR-014).
- **카드번호·승인번호를 결과에 담지 마라.** 이유: 스키마에 컬럼 자체가 없고, 담기는 순간 저장 경로가 생긴다(ADR-015).
- **행 단위 파싱 실패에 예외를 던지지 마라.** 이유: 거래 하나 때문에 300건짜리 분석을 통째로 버리게 된다(ADR-013).
- **`console.*`을 쓰지 마라.** 이유: 이 함수들이 다루는 값이 전부 PII다.
- **DB·네트워크·`process.env`를 건드리지 마라.** 이유: 순수 함수여야 테스트가 키 없이 돈다(ADR-018).
- **컬럼 매핑을 여기서 추론하지 마라** — 그건 LLM이 하고(step 3), 결과는 `ColumnMap`으로 들어온다. 헤더 이름 휴리스틱을 넣기 시작하면 ADR-002가 무의미해진다.
- **레포에 실제 카드사 CSV를 커밋하지 마라.** 픽스처는 손으로 만든 합성 데이터여야 한다.
- 기존 테스트를 깨뜨리지 마라.
