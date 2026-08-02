# Step 5: uploads-export

## 목적

`GET /api/uploads/[id]/export` — **세무사 전달용 파일** 다운로드. 유료 기능이다.

유료의 약속이 "세무사에게 넘길 정리본"이고, 그것은 전체 내역과 다운로드로 완성된다(ADR-007). 이 라우트가 그 절반이다.

**라우트 진입 직후 plan을 확인하고, 무료면 파일을 생성하기 전에 거절한다.** 비용을 태우고 거절하지 않는다(ARCHITECTURE.md).

## 이전 Step과의 의존성

- **step 0 (`gate`)** — `viewScope(plan).canExport`
- **step 3 (`uploads-detail`)** — 404 규칙, `getProfilePlan` 사용 패턴
- **Phase 0 step 2** — `ACCOUNT_CODES`의 라벨 (파일에 한글 계정과목명이 들어간다)
- **Phase 1 step 4 (`merchant-dictionary`)** — `reason`은 `merchant_dictionary`에서 조인해 온다

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — §게이트는 서버가 자른다 (마지막 문단: 파일을 **생성하기 전에** 거절) · §DB 스키마 주석("판정 근거는 상호명의 속성이므로 `merchant_dictionary`에만 둔다")
- `/docs/ADR.md` — ADR-007(유료의 약속) · ADR-011(포지셔닝) · ADR-019
- `/docs/PRD.md` — UC-09 · §구독 및 기능 게이트 표
- `/docs/DESIGN.md` — §8 숫자 표기 (취소는 음수 부호 보존)
- `/src/lib/gate.ts` · `/src/app/api/uploads/[id]/route.ts`

## 구현 범위

```
src/app/api/uploads/[id]/export/route.ts   — GET
```

```ts
export const runtime = 'nodejs';

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response>;
```

출력 형식: **CSV, UTF-8 with BOM.** 이유는 아래 지시문에.

## 수정 대상 파일

```
src/app/api/uploads/[id]/export/route.ts        (신규)
src/app/api/uploads/[id]/export/route.test.ts   (신규 — 먼저)
```

## 먼저 작성할 테스트

### 게이트 ← 이 step의 핵심
1. `free` 사용자 → **402** + `{ "error": "payment_required" }`
2. **거절 시 거래를 조회하지 않는다.** DB mock의 거래 조회 함수가 호출 0회임을 assert하라. 이게 "파일을 생성하기 전에 거절"의 검증이다
3. 거절 시 CSV 생성 함수도 호출되지 않는다
4. `plan`을 **서버가 DB에서 읽는다** — `?plan=pro`를 붙여도 402다
5. `pro` 사용자 → 200 + CSV

### 인증·소유권
6. 세션 없으면 401
7. 없는 id → 404
8. 타인의 업로드 → 404
9. **404 검사가 402보다 먼저다** — 남의 업로드 id로 402를 받으면 그 id의 존재를 알게 된다

### 상태
10. `status !== 'completed'`면 409 (분석 중이거나 실패한 것을 내보낼 수 없다)

### CSV 내용
11. **UTF-8 BOM으로 시작한다** — 없으면 Excel(한국어 Windows)에서 한글이 깨진다
12. 헤더 행에 거래일자·가맹점명·금액·계정과목·판정·근거가 있다
13. 계정과목이 **한글 라벨**이다 (`welfare`가 아니라 `복리후생비`) — 세무사가 읽는 파일이다
14. 판정이 한글이다 (`사업 경비` / `개인 지출` / `애매`)
15. **취소 거래의 음수 부호가 보존된다** (`-8900`). 버리거나 절대값으로 만들지 않는다
16. 가맹점명에 콤마가 있으면 따옴표로 감싸진다 (CSV 이스케이프)
17. 가맹점명에 따옴표가 있으면 이중 따옴표로 이스케이프된다
18. **`=`·`+`·`-`·`@`로 시작하는 셀 앞에 이스케이프가 붙는다** — CSV 인젝션 방어. 가맹점명은 사용자 파일에서 온 값이고, Excel이 수식으로 해석하면 세무사의 컴퓨터에서 실행된다
19. `reason`이 `merchant_dictionary`에서 조인돼 실린다 (`transactions`에는 없다)
20. `uncertain` 거래도 **포함된다** — 사용자가 세무사에게 물어야 할 대상이다
21. 마지막에 **세무 고지 문구**가 들어간다: "본 서비스는 세무 자문이 아니며 최종 판단은 세무대리인과 상의하십시오"

### 응답 헤더
22. `Content-Type: text/csv; charset=utf-8`
23. `Content-Disposition: attachment; filename="…"`
24. **파일명이 서버가 만든 값이다** — 사용자 원본 파일명을 그대로 쓰지 않는다 (헤더 인젝션 + PII)

### 로깅
25. 가맹점명·CSV 내용이 로그에 없다

## Codex 실행 지시문

### plan 확인이 가장 먼저 (404 다음)

```ts
// 1. 인증
// 2. userId 스코프 조회 → 없으면 404          ← 402 보다 먼저. 남의 id로 402를 받으면 존재가 새어나간다
// 3. plan 확인 → free 면 402, 여기서 return   ← 거래 조회·CSV 생성 전
// 4. status === 'completed' 확인 → 아니면 409
// 5. 거래 조회 + reason 조인
// 6. CSV 생성
```

ARCHITECTURE.md: *"라우트 진입 직후 plan을 확인하고, 무료면 파일을 **생성하기 전에** 거절한다(비용을 태우고 거절하지 않는다)."*

### CSV 인젝션을 막아라

```ts
// 가맹점명은 사용자가 올린 파일에서 온 값이다.
// '=cmd|...' 로 시작하는 셀을 Excel 이 수식으로 실행한다.
// 세무사가 여는 파일이므로 우리 쪽 사고가 아니라 상대 쪽 사고가 된다.
if (/^[=+\-@\t\r]/.test(cell)) cell = "'" + cell;
```

이건 방어적 코드가 아니라 **실제 위협 모델**이다. 우리가 만든 파일을 제3자(세무사)가 Excel로 연다.

### UTF-8 BOM

```ts
const BOM = '﻿';
return new Response(BOM + csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', ... } });
```

BOM이 없으면 한국어 Windows Excel이 cp949로 읽어 한글이 전부 깨진다. **세무사에게 넘길 파일이라 이게 안 되면 기능이 성립하지 않는다.**

### 파일명은 서버가 만든다

```
finsight_{uploadId}_{periodStart}_{periodEnd}.csv
```

사용자 원본 파일명을 `Content-Disposition`에 넣지 마라 — 헤더 인젝션 표면이고, 파일명 자체가 PII일 수 있다(`김철수_신한카드_2025.csv`).

### `reason`은 조인해서 가져온다

`transactions`에 `reason` 컬럼이 없다. **판정 근거는 상호명의 속성이므로 `merchant_dictionary`에만 둔다**(ARCHITECTURE.md §DB 스키마 주석). `merchant_key`로 조인하라.

조인 결과가 없으면(`uncertain`이라 사전에 없는 경우) 빈 문자열.

### 한글 라벨

계정과목은 `ACCOUNT_CODES`의 `label`, 판정은 3값의 한글 라벨(DESIGN.md §2 표: `사업 경비` / `개인 지출` / `애매`)을 쓴다. **라벨 문자열을 여기 다시 적지 마라** — 상수에서 가져온다.

### 세무 고지

파일 마지막 행에 넣는다: *"본 서비스는 세무 자문이 아니며 최종 판단은 세무대리인과 상의하십시오."*

ADR-011. 화면·PDF·약관에 명시하기로 했고, 세무사에게 넘어가는 파일이 그 대상에서 빠지면 안 된다.

### PDF·XLSX를 만들지 마라

CSV 하나다. PDF 생성기·엑셀 라이브러리를 도입하지 마라 — 요청되지 않았고 의존성이 크다.

## 완료 조건

- `GET`이 있고 25개 테스트가 전부 통과한다
- **free 거절 시 거래 조회·CSV 생성이 일어나지 않는다**
- 404가 402보다 먼저다
- UTF-8 BOM이 있다
- CSV 인젝션 이스케이프가 있다
- 취소 음수 부호가 보존된다
- 세무 고지 문구가 있다
- 파일명이 서버 생성이다
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run "src/app/api/uploads/[id]/export/route.test.ts"
```

직접 확인:

```bash
grep -n "FEFF\|\\\\ufeff" "src/app/api/uploads/[id]/export/route.ts" || echo "FAIL: BOM 없음"
grep -nE "\[=\+\\-@|CSV injection|인젝션" "src/app/api/uploads/[id]/export/route.ts" || echo "FAIL: 인젝션 방어 없음"
grep -n "세무 자문" "src/app/api/uploads/[id]/export/route.ts" || echo "FAIL: 고지 없음"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md §게이트 — 파일 생성 전에 거절하는가? `plan`을 서버가 읽는가?
   - §DB 스키마 — `reason`을 `merchant_dictionary`에서 조인하는가?
   - ADR-011 — 세무 고지가 있고 단정적 지시 문구가 없는가?
   - ADR-014 / DESIGN.md §8 — 취소 음수가 보존되는가?
   - AGENTS.md CRITICAL — 에러가 고정 어휘인가? 로그에 PII 없는가?
3. 결과에 따라 `phases/2-api/index.json`의 step 5를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "app/api/uploads/[id]/export/route.ts — GET: 401→404→402(payment_required, 거래 조회·생성 전)→409(미완료)→CSV. UTF-8 BOM, CSV 인젝션 이스케이프, 한글 계정과목/판정 라벨, reason은 merchant_dictionary 조인, 취소 음수 보존, 세무 고지 행, 파일명 서버 생성")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단

**이 step이 끝나면 Phase 2가 완료된다.** `summary`에 「Phase 2 검토 지점: ANTHROPIC_API_KEY로 LLM 호출 2곳 실측 필요 (mock과 실제 SDK 괴리 확인)」을 덧붙여라(`phases/PLAN.md` D-9).

## commit 기준

`feat(2-api): step 5 — uploads-export`

포함: `src/app/api/uploads/[id]/export/route.{ts,test.ts}`

## 금지사항

- **파일을 만든 뒤에 plan을 확인하지 마라.** 이유: 비용을 태우고 거절하는 것이다(ARCHITECTURE.md).
- **404 검사보다 402를 먼저 하지 마라.** 이유: 남의 업로드 id로 402를 받으면 그 id의 존재를 알게 된다.
- **요청에서 `plan`을 읽지 마라.** 이유: ADR-020.
- **UTF-8 BOM을 빼지 마라.** 이유: 한국어 Windows Excel에서 한글이 전부 깨진다. 세무사에게 넘길 파일이라 이게 안 되면 기능이 성립하지 않는다.
- **CSV 인젝션 이스케이프를 생략하지 마라.** 이유: 가맹점명은 사용자 파일에서 온 값이고, 우리가 만든 파일을 세무사가 Excel로 연다.
- **사용자 원본 파일명을 `Content-Disposition`에 넣지 마라.** 이유: 헤더 인젝션 표면이고 파일명 자체가 PII일 수 있다.
- **취소 금액을 절대값으로 바꾸거나 빼지 마라.** 이유: 세무사가 받는 합계가 조용히 틀어진다.
- **`uncertain` 거래를 빼지 마라.** 이유: 사용자가 세무사에게 따로 물어야 할 바로 그 항목들이다.
- **PDF·XLSX 생성기를 도입하지 마라.** 이유: 요청되지 않았고 의존성이 크다. CSV 하나다.
- **단정적 지시 문구를 쓰지 마라** (`경비 처리하세요`). 이유: ADR-011.
- **세무 고지를 빼지 마라.**
- 기존 테스트를 깨뜨리지 마라.
