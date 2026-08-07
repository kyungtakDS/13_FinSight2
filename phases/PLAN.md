# FinSight2 전체 구현 계획

source of truth: `docs/PRD.md` · `docs/DESIGN.md` · `docs/ARCHITECTURE.md` · `docs/ADR.md` · `AGENTS.md`

6개 실행 Phase / 33개 Step + 하네스 밖에서 수행된 완료 기록 1개(`6-integrity`).
Phase 순서는 **ADR-012**(코어 루프 먼저, 랜딩·결제 나중)를 그대로 따른다.

각 Step은 `phases/{phase}/step{N}.md` 파일 하나로 자기완결적이다 — 별도 세션·다음 날에 이어서 실행해도 이전 대화가 필요 없다. 실행은 phase 단위:

```bash
python scripts/execute.py 0-foundation
python scripts/execute.py 0-foundation --push
```

---

## Phase 개요

| Phase | dir | steps | 상태 | 무엇을 만드나 | 끝나면 확인 가능한 것 |
|---|---|---|---|---|---|
| 0 | `0-foundation` | 6 | **completed** (2026-07-31) | 스캐폴딩 · 디자인 토큰 · 타입 · DB 스키마 · Supabase 클라이언트 · 인증 | Google 로그인 후 빈 `/dashboard` 진입 |
| 1 | `1-pipeline` | 7 | **completed** (2026-07-31) | CSV 정규화·지문 · Claude 호출 2곳 · 전역 사전 · 서버 집계 | 픽스처 CSV → 리포트 요약 객체 (전부 유닛테스트) |
| 2 | `2-api` | 6 | **completed** (2026-08-04) | 게이트 · 분석 오케스트레이션 · uploads 라우트 5개 | curl로 업로드 → 폴링 → 리포트 JSON |
| 3 | `3-app-ui` | 6 | **completed** (2026-08-04) | 앱 셸 · 업로드 화면 · 리포트 3상태 · 잠금 | 브라우저에서 업로드→리포트 전 과정 |
| 4 | `4-marketing` | 3 | **completed** (2026-08-04) | 마케팅 컴포넌트 · 랜딩 · `/legal` | 랜딩 → 가입 진입 |
| — | `6-integrity` | 15 (기록) | **completed** (2026-08-07) | 실사용에서 드러난 결함 15건 — GRANT 누락 · 취소 거래 · 한국어 날짜 · 재계산 | 실제 명세서가 끝까지 통과 |
| 5 | `5-billing` | 5 | **pending** | Polar 클라이언트 · **DB 계약** · checkout/portal · 웹훅 · `/upgrade` | 결제 → Pro 잠금 해제 |

**`6-integrity`는 번호가 6이지만 `5-billing`보다 먼저 실행됐다.** 하네스(`execute.py`)가 아니라
GitHub 이슈·PR로 진행돼 `step{N}.md`가 없고 **재실행 대상이 아니다** — `phases/6-integrity/README.md` 참고.

**Phase 간 순서는 강제다.** Phase N의 step은 Phase N-1이 전부 `completed`인 상태를 전제한다. Phase 내부에서도 step 순서는 강제다 (각 step의 「이전 Step과의 의존성」 참고).

**Phase 5는 추가로 「Phase 5 시작 게이트」(아래)를 통과해야 시작할 수 있다.**

> 위 표는 **사람이 읽는 요약**이다. 기계가 읽는 상태의 권위는 `phases/index.json`과
> `phases/{phase}/index.json`이고, 그쪽은 `execute.py`가 갱신한다. 둘이 어긋나면 JSON이 맞다.

---

## 진행 현황

### Phase 0 — 완료 (2026-07-31 08:53:36 → 09:24:17, 30분 41초)

6개 step 전부 `completed`. 각 step에 `started_at` · `completed_at` · `summary`가 기록돼 있다
(`phases/0-foundation/index.json`). 브랜치 `feat-0-foundation`, Draft PR #10.

| # | name | 소요 | 산출물 |
|---|---|---|---|
| 0 | `project-setup` | 6m34s | Next 16.2.12 / React 19.2.8 / TS strict / Tailwind v4 / ESLint 9 flat / Vitest 4 |
| 1 | `design-tokens` | 4m26s | 토큰 5개 + `theme.css` → `src/styles/` (바이트 동일), `@theme inline`, `next/font` 3종, `ThemeToggle` |
| 2 | `core-types` | 4m07s | `src/types/` 7개. `ERROR_CODES`(7) · `VERDICTS`(3) · `ACCOUNT_CODES`(18) |
| 3 | `db-schema` | 5m11s | `migrations/0001~0004` — 테이블 6 · 인덱스 · RLS · Storage 정책 · pg_cron |
| 4 | `supabase-clients` | 5m42s | `client`/`server`/`service`. 헬퍼 6개 전부 `userId` 필수 첫 인자 |
| 5 | `auth-flow` | 4m37s | `middleware.ts`(+테스트) · `/auth/callback` · Google 로그인/로그아웃 |

**검증 결과** (하네스와 별개로 직접 실행):

```
npm run lint    exit 0
npm run build   exit 0 — 4 routes + middleware. .env 없이 통과 → lazy env 실증(ADR-018)
npm run test    56 passed / 11 files
```

CRITICAL 규칙 11항목 감사 통과: service role 헬퍼 `userId` 첫 인자 · `client.ts`에 service role 미참조 ·
lazy env · 카드번호/승인번호 컬럼 부재 · 전역 사전 2개 테이블에 사용자 식별자 부재 · `subscriptions` 테이블 부재 ·
파괴적 DDL 부재 · `src/middleware.test.ts` 선작성 · `src/__tests__/` 우회 부재 · raw hex/px/이모지 0건 ·
`tailwind.config.*` 부재 및 `fonts.css` 미복사.

### Phase 1 — 완료 (2026-07-31 09:48:20 → 10:16:23, 28분 03초)

7개 step 전부 `completed`, **재시도 0회**. 브랜치 `feat-1-pipeline`(base `feat-0-foundation`).

| # | name | 소요 | 산출물 |
|---|---|---|---|
| 0 | `csv-normalize` | 3m39s | UTF-8 strict 실패 시 cp949 · iconv-lite · BOM 제거 · papaparse · 취소 부호 보존 · 원본 `rowIndex` · 실패 행 skip 카운트 · 3,000행 상한 |
| 1 | `csv-fingerprint` | 3m02s | `fileHash`(sha256) · `headerFingerprint`(상위 20행, 숫자→`#` 마스킹, 데이터 행은 셀 수만 기여) |
| 2 | `claude-client` | 5m06s | `callStructured<T>`. `stop_reason` 3분기를 `content` 접근 **전에**. 스트리밍+`finalMessage`, system 캐싱, `maxRetries: 0` |
| 3 | `map-columns` | 3m46s | LLM ①. 상위 20행만 전송, zod 뒤 인덱스 범위·중복 배정 검증, 폴백 휴리스틱 없음 |
| 4 | `merchant-dictionary` | 3m53s | 전역 사전 조회/적재. 항목 단위 검증, 사전 쓰기의 **유일한 경로** |
| 5 | `classify-merchants` | 4m09s | LLM ②. 상호명만 전송, 계정과목은 `ACCOUNT_CODES`에서 프롬프트 생성, 길이·인덱스 불일치는 실패(정렬 복원 안 함) |
| 6 | `aggregate` | 4m23s | 서버 산술 전부. 취소 상계, `uncertain` 제외, `floor(expenseTotal × 0.066)` |

**검증 결과** (하네스와 별개로 직접 실행):

```
npm run lint    exit 0
npm run build   exit 0
npm run test    exit 0 — 214 passed / 18 files  (Phase 1 이 158개 추가)
```

파일별 신규: `normalize` 34 · `aggregate` 29 · `dictionary` 26 · `classify-merchants` 22 ·
`client` 17 · `map-columns` 16 · `fingerprint` 14.

**감사 통과 항목**: 7개 모듈 전부 `console.*` 0회 · `lib/csv`·`lib/report`가 DB/네트워크/env 미참조(순수) ·
`ESTIMATED_TAX_RATE = 0.066` + `Math.floor`(`round`/`ceil` 미사용) · 단정적 지시 문구 0건 ·
`aggregate`가 인사이트를 자르지 않음 · 계정과목 한글명 프롬프트 하드코딩 0건 · sha256 전용 ·
교차 파일 중복 판정(`is_duplicate`·거래 지문) 미구현 · 전역 사전에 사용자 식별자 미참조.

**ADR-003 경계 — 구조로 막혔다**: `mapColumns(topRows: string[][])`와
`classifyMerchants(names: string[])`가 각각 배열 하나만 받는다. 금액·날짜·카드번호·사용자 식별자를
**인자로 받지 않으므로 실수로도 보낼 수 없다.** `userData`는 각각 상위 20행 CSV와
`JSON.stringify(names)`뿐이다.

**ADR-022 확인**: `model: "claude-opus-5"` · `output_config: { effort: "medium" }`.
step 파일이 "SDK 파라미터 이름을 추측하지 마라"고 요구했고, `output_config`가
`node_modules/@anthropic-ai/sdk`의 `.d.ts` 10곳에 실재함을 확인했다 — 지어낸 이름이 아니다.

### Phase 2 — 완료 (2026-08-04 15:23:35 → 15:49:32, 25분 57초)

6개 step 전부 `completed`. 브랜치 `feat-2-api`, PR #16.

| # | name | 소요 | 산출물 |
|---|---|---|---|
| 0 | `gate` | 3m48s | `lib/gate.ts` — `viewScope(plan)` · `gateReport()`. free는 `transactions` 길이 0 + `lockedTxnCount`, 인사이트 앞 3개. 알 수 없는 plan은 free |
| 1 | `analysis-pipeline` | 4m50s | `lib/analysis/run-analysis.ts` — Storage→파싱→지문→포맷 캐시→정규화→사전 캐시→저장→집계. 절대 reject하지 않고 고정 에러 코드로 매핑 |
| 2 | `uploads-ingest` | 6m15s | `POST /api/uploads` 202 + `after(runAnalysis)`. 중복 409, INSERT 실패 시 Storage 보상 삭제. `GET` 목록 100건 |
| 3 | `uploads-detail` | 3m28s | `GET`은 부재·타인을 동일한 404로. `DELETE`는 Storage→DB 순서 |
| 4 | `uploads-retry` | 3m17s | 만료 우선 거절 · 재시도 상한 · 원자적 전이 · 202 + `retriesLeft` |
| 5 | `uploads-export` | 4m17s | 401→404→**402(거래 조회 전)**→409→CSV. UTF-8 BOM · CSV 인젝션 이스케이프 · 세무 고지 행 |

### Phase 3 — 완료 (2026-08-04 16:39:19 → 17:11:39, 32분 20초)

6개 step 전부 `completed`. 브랜치 `feat-3-app-ui`, PR #17.

| # | name | 소요 | 산출물 |
|---|---|---|---|
| 0 | `app-shell` | 3m50s | `components/app/{AppShell,Sidebar,Topbar}` + `dashboard/layout.tsx`. nav 2개(`/dashboard`·`/upgrade`) |
| 1 | `upload-dropzone` | 4m30s | `lib/csv/preview.ts`(의존성 0) + 드롭존·판별 카드·빈 상태. 에러 문구 고정 어휘 매핑 |
| 2 | `uploads-history` | 4m24s | `UploadList`(props 전용) + `dashboard/page.tsx` 서버 조립 |
| 3 | `analysis-status` | 6m36s | `ProcessingPanel`·`FailedPanel`·`StatusPoller`. indeterminate 진행바, 2초 폴링·10분 상한 |
| 4 | `report-summary` | 7m20s | 히어로·지표·애매 배너·인사이트·SVG 도넛(3건 이하면 표) + `format.ts` |
| 5 | `report-table-lock` | 5m35s | `TransactionTable` + `LockedTable`(`lockedCount`만 받는 시그니처 — 거래 prop 없음). CTA → `/upgrade` |

### Phase 4 — 완료 (2026-08-04 19:14:10 → 19:30:29, 16분 19초)

3개 step 전부 `completed`. 브랜치 `feat-4-marketing`, PR #18.

| # | name | 소요 | 산출물 |
|---|---|---|---|
| 0 | `marketing-components` | 6m02s | 7개 컴포넌트. DESIGN.md §4 표의 prop만 수용(rest spread 없음) |
| 1 | `landing` | 5m54s | `app/page.tsx` — 마퀴·히어로·ColorBlock 3개·4단계·가격 2티어(`₩9,900` 상수 한 곳)·고지·푸터 |
| 2 | `legal` | 4m20s | `app/legal/page.tsx` 한 페이지 세 절. "법률 전문가 검토 전 초안" 명시 |

### `6-integrity` — 완료 (2026-08-04 → 2026-08-07)

**하네스 밖에서 실행된 완료 기록이다.** 15개 PR(#20~#39). 상세는 `phases/6-integrity/README.md`.

Phase 4까지 끝난 코드를 **실제 카드사 명세서로 돌리자 드러난 결함**을 고쳤다. 유닛테스트는
전부 초록이었는데 실물은 통과하지 못했다 — 합성 픽스처가 덮지 못한 지점(B-3이 경고한 그것)이다.

가장 큰 것 셋:

- **테이블 GRANT 전면 누락 (#21)** — `0001`~`0004`가 RLS 정책은 만들었지만 GRANT를 한 번도
  주지 않아 모든 롤이 `42501`을 맞고 있었다. **`uploads` 0행 — 업로드가 한 번도 성공한 적이 없었다.**
  RLS는 "어느 행을 볼 수 있나"이고 그 이전에 "이 롤이 이 테이블을 건드릴 수 있나"가 통과해야 한다.
  `0005_grants.sql`이 여기서 나왔다.
- **취소 거래 (#25)** — 취소 19건이 양수로 합산돼 절감액이 부풀었다. 상태값 의미대로 제외·상계로.
- **재계산 (#30 / PR #39)** — 분석 로직이 바뀌어도 `completed` 업로드는 옛 결과를 들고 있었다.
  `replace_upload_result()` plpgsql로 delete→insert→update를 한 트랜잭션에.
  **`0007`의 이 함수가 Phase 5의 `apply_polar_event`가 따를 형판이다.**

남긴 마이그레이션 3개(`0005`·`0006`·`0007`) 때문에 **Phase 5 계획서가 예약해 뒀던
`0005_polar_event_fn.sql` 번호가 충돌했다.** → D-17로 `0008` 고정.

---

## 미해결 항목 (2026-08-07 기준 · main `d7f9a54`)

**blocker**는 해당 Phase를 **시작하기 전에** 처리해야 하는 것이고, **후속 작업**은 병렬로 진행해도
Phase 진행을 막지 않는 것이다. 이 구분이 곧 "지금 Phase 1을 시작해도 되는가"의 답이다.

| # | 항목 | 구분 | 언제 | 막는 것 |
|---|---|---|---|---|
| B-1 | `middleware` → `proxy` 전환 결정 | ~~blocker~~ → **해결 (2026-08-04)** | — | 없음. **현행 유지로 결정** (아래 참고) |
| B-2 | Supabase DB 마이그레이션 적용 · Google OAuth provider 설정 | ~~blocker~~ → **해결 (2026-08-05~07)** | — | 없음. `0001`~`0007` live 적용 완료 |
| B-3 | **실제 카드사 CSV로 파싱 검증** | ~~blocker~~ → **해결 (2026-08-07)** | — | 없음. `6-integrity` 15건이 그 결과다. 재계산 실검증 12/12 |
| B-4 | **Polar 상품의 통화·금액 확정 (KRW ₩9,900 지원 여부)** | **blocker (외부 확인)** | **Phase 5 시작 전** | `/upgrade`·랜딩의 가격 문구. → **D-20, 미결** |
| B-5 | **`POLAR_WEBHOOK_SECRET` 미설정** | **blocker (외부 설정)** | **step 3 검증 전** | 값이 없으면 모든 웹훅이 401. Polar dashboard에서 발급 |
| F-1 | `0004_expiry_cron.sql` 실제 동작 확인 | 후속 | 아무 때나 | 없음 (Phase 진행을 막지 않음) |
| F-2 | `execute.py` 경과 시간 표시 버그 | 후속 | 아무 때나 | 없음 (표시만의 문제) |
| F-3 | `tdd-guard.test.mjs` 픽스처 충돌 | ~~후속~~ → **해결 (2026-08-04)** | — | 없음. 32 passed / 0 failed |

Phase 0·1은 위 항목들에 막히지 않고 완료됐다 — 순수 로직과 mock뿐이라
DB·OAuth·미들웨어와 무관하다(ADR-018).

**남은 blocker는 B-4·B-5 둘뿐이고 둘 다 외부(Polar dashboard) 작업이다.** 코드로 풀 수 없다.

### B-2 · B-3 — **해결됨 (2026-08-07)**

> **B-2**: Supabase 프로젝트가 만들어졌고 마이그레이션 `0001`~`0007`이 live DB에 적용됐다.
> Google OAuth provider도 설정됐다. 실제로 업로드→분석→리포트가 브라우저에서 돈다.
>
> 적용 과정에서 **GRANT가 통째로 빠져 있었다는 사실이 드러났다**(#21) — SQL 파일만 보고는
> 알 수 없었고 실제로 붙여 보고서야 `42501`이 나왔다. D-8("적용은 사람이 한다")의 대가가
> 정확히 이것이었다. `supabase/migrations.test.ts`는 텍스트 불변식만 검사하므로
> **권한 부재를 잡을 수 없었다.**
>
> **B-3**: 실제 카드사 명세서로 검증했다. 결과가 `6-integrity`의 15개 PR이다.
> 재계산 실검증 **12/12 통과**. 레포에 커밋된 `.csv`는 여전히 0개이고, 이 문서에도
> 가맹점명·금액을 적지 않았다.

아래 B-2·B-3의 원래 기록은 당시 배경으로 남긴다.

### B-3. 실제 카드사 CSV 파싱 검증 — **미수행. 사람만 할 수 있다**

D-9가 「Phase 1 후」 검토 지점으로 지정한 항목이다. **수행하지 못했고, 결과를 지어내지 않았다.**

수행하지 못한 이유: 실제 카드사 명세서는 사용자의 개인 금융 문서다. 에이전트가 구할 수 없고,
구해서도 안 되며, 레포에 커밋해서도 안 된다(step 파일이 명시적으로 금지한다).

**대신 무엇이 검증됐나** — `src/lib/csv/normalize.test.ts`의 34개 테스트가 **손으로 만든 합성
픽스처**로 위험 지점을 덮는다. 커밋된 `.csv` 파일은 0개이고 픽스처는 전부 테스트 코드 안의 인라인
문자열이다:

- 인코딩: UTF-8 · cp949 · BOM · ASCII 기본값
- **cp949 확장 음절이 깨지지 않는 것** (`TextDecoder('euc-kr')`로는 깨지는 구간)
- 가맹점명에 콤마가 든 따옴표 필드가 한 셀로 유지
- 행마다 셀 수가 다른 상단 메타 블록
- 헤더 위쪽 메타 무시 · 헤더 행 자체가 거래로 안 들어감
- **취소 부호 보존** · 매핑되지 않은 컬럼 미판독 · 카드번호 패턴 제거
- 실패 행 skip + 카운트, `rowIndex`는 원본 기준 유지
- 3,000행 초과 시 `RowLimitExceeded`

**합성 픽스처가 덮지 못하는 것**: 실제 카드사가 쓰는 *예상 밖의* 양식 — 상단 메타 블록의 실제 행 수,
컬럼명의 실제 표기, 취소 거래의 실제 부호 관행, 파일 끝의 합계 행 유무. ADR-012가
*"이 제품에서 가장 위험한 부분은 카드사 CSV 파싱"*이라고 한 지점이 정확히 여기다.

**검증 방법** (레포에 파일을 넣지 말 것):

```bash
# 임시 스크립트로 로컬에서만. 결과 수치만 기록하고 파일과 스크립트는 커밋하지 않는다.
npx tsx -e "
  import { readFileSync } from 'node:fs';
  import { detectEncoding, decodeCsv, parseRows } from './src/lib/csv/normalize';
  const b = new Uint8Array(readFileSync(process.argv[1]));
  const enc = detectEncoding(b);
  const rows = parseRows(decodeCsv(b, enc));
  console.log({ enc, rows: rows.length, head: rows.slice(0, 8).map(r => r.length) });
" /경로/명세서.csv
```

확인할 것: ① 인코딩 판정이 맞는가 ② 한글이 안 깨지는가 ③ 헤더 행이 상위 20행 안에 있는가
④ 취소 거래가 음수로 읽히는가. 카드사 2~3곳에서 각각 본다.

**결과는 이 문서에 수치로만 기록한다** — 가맹점명·금액을 적지 마라.

### B-1. `middleware` → `proxy` 전환 결정 — **결정됨: (a) 현행 유지 (2026-08-04)**

> **결정: `src/middleware.ts`를 그대로 둔다. `src/proxy.ts`를 만들지 않는다.**
>
> 근거: 빌드·동작 모두 정상이고 깨지는 것이 없다. 전환하면 `ARCHITECTURE.md` §디렉토리 구조 ·
> `AGENTS.md`의 tdd-guard 예외 문구 · `tdd-guard.mjs`의 면제 규칙까지 **문서 3곳을 함께** 고쳐야 하는데,
> 그 대가로 얻는 것은 deprecation 경고 하나가 사라지는 것뿐이다. Next가 실제로 `middleware` 관례를
> 제거할 때 옮긴다.
>
> 따라서 아래 「선택지」는 (a)로 확정됐고, `AGENTS.md`의 *"`src/middleware.ts`는 tdd-guard 면제가
> 아니다"* 규칙과 `ARCHITECTURE.md`의 `src/middleware.ts` 표기는 **그대로 유효하다.**
>
> 남는 것: `next build`·`next dev`가 계속 deprecation 경고를 출력한다. 이건 알려진 잡음이며
> 빌드 실패가 아니다. Next 메이저 업그레이드 시 이 항목을 다시 연다.

아래는 결정 당시의 배경이다.


`next build`가 경고를 낸다:

```
⚠ The "middleware" file convention is deprecated. Please use "proxy" instead.
```

Next 16.2.12에서 `src/middleware.ts` 관례가 deprecated 됐다. **빌드는 통과하고 동작도 정상이다** —
지금 당장 깨지는 것은 없다.

문제는 `docs/ARCHITECTURE.md` §디렉토리 구조가 `src/middleware.ts` + `src/middleware.test.ts`를
명시하고, `AGENTS.md`가 *"`src/middleware.ts`는 tdd-guard 면제가 아니다"*를 못박고 있다는 점이다.
**문서와 프레임워크가 갈렸다.**

Phase 2 시작 전에 정해야 하는 이유: Phase 2의 게이트·라우트가 미들웨어와 같은 인증 경계를 공유하고,
전환을 나중에 하면 그때 작성된 테스트·문서를 다시 고쳐야 한다.

선택지:
- **(a) 현행 유지** — 경고를 받아들이고 Next가 제거할 때 옮긴다. 문서 수정 0.
- **(b) `proxy`로 전환** — `src/proxy.ts` + `src/proxy.test.ts`로 옮기고 `ARCHITECTURE.md`·`AGENTS.md`·
  `tdd-guard.mjs`의 면제 규칙까지 함께 고친다. 파일명이 바뀌므로 tdd-guard가 `proxy.ts`를
  면제로 착각하지 않는지 확인해야 한다.

~~**결정 주체는 사람이다.** 결정 전에는 Phase 2를 시작하지 마라.~~ → 위 결정 블록으로 종결.

### B-2. Supabase 적용 · Google OAuth — 환경 설정

`phases/PLAN.md` D-8의 설계대로 Phase 0은 **SQL 파일을 커밋하는 데서 끝냈다.** DB에는 아무것도
적용되지 않았다. `supabase/README.md`에 절차가 있다.

해야 할 일:
1. Supabase 프로젝트 생성
2. `supabase/migrations/0001~0004`를 순서대로 적용
3. `pg_cron` 확장 활성화 (콘솔에서 별도 필요할 수 있다)
4. Storage 버킷 `csv-uploads`가 **비공개**로 생성됐는지 확인
5. Google OAuth provider 활성화 + redirect URL에 `{SITE_URL}/auth/callback` 등록
6. `.env`에 `NEXT_PUBLIC_SUPABASE_URL` · `NEXT_PUBLIC_SUPABASE_ANON_KEY` · `SUPABASE_SERVICE_ROLE_KEY` 채우기

**이것이 안 돼도 Phase 1·2의 테스트는 전부 통과한다** — 전부 mock이기 때문이다(ADR-018).
막히는 것은 브라우저로 실제 로그인·업로드를 확인하는 일뿐이고, 그건 Phase 3 검증 시점에 필요하다.

### F-1. `0004_expiry_cron.sql` 실제 동작 확인 — B-2 완료 후

SQL로 `storage.objects` 행을 삭제했을 때 **오브젝트 스토리지의 바이트까지 정리되는지**는
Supabase 프로젝트 설정에 따라 다르다. 90일 만료 정책(ADR-005)의 집행이 여기 걸려 있다.

확인 방법: 테스트 업로드 1건의 `expires_at`을 과거로 바꾸고 잡을 수동 실행한 뒤,
Storage 콘솔에서 객체가 실제로 사라졌는지 **눈으로** 본다. `uploads.storage_path`가 `null`이 되고
`transactions`·`summary`는 남아 있어야 한다.

사라지지 않으면 pg_cron에서 Storage API를 호출하는 방식(Edge Function 등)으로 바꿔야 하며,
그건 ADR-005의 "새 인프라가 늘지 않는다"는 근거를 재검토하게 만든다.

### F-3. `tdd-guard.test.mjs` 픽스처 충돌 — **해결됨 (2026-08-04)**

> **결과: 32 passed / 0 failed.** Phase 4 종료 시점에 실패가 3건에서 **6건**까지 늘어 있었다
> (`normalize.ts` · `route.ts` · `middleware.ts` + `apply_patch` 변형 3종) — Phase 2가
> `route.test.ts`를, Phase 0 step 5가 `middleware.test.ts`를 정당하게 만들었기 때문이다.
>
> **고친 것은 테스트뿐이고 `tdd-guard.mjs`는 한 줄도 바꾸지 않았다.** 아래 진단대로 낡은 것은
> 가드가 아니라 기대값이었고, 구현을 고쳤다면 오히려 올바른 동작을 깨뜨렸을 것이다.
>
> 채택한 방법은 아래 「고치는 법」(고정 더미 파일명)이 아니라 **빈 임시 루트에서 돌리기**다.
> 더미 파일명은 "그 이름이 영원히 안 생긴다"는 약속에 기대지만, 임시 루트는 테스트가 스스로
> 만든 빈 디렉토리라 레포가 어떻게 자라든 영향을 받지 않는다. 검증하려는 것도 정확히
> *"이 경로 모양이 면제 목록에 없다"*이지 *"레포에 테스트가 없다"*가 아니다.
>
> 회귀 방지 확인 — 수정 후 실제 레포에 대고 훅을 직접 호출해 동작이 그대로임을 확인했다:
> 테스트 없는 새 경로 → DENY · 테스트 있는 경로 → ALLOW · `middleware.ts` → ALLOW(테스트 존재) ·
> 테스트 없는 새 라우트 → DENY · `page.tsx` → ALLOW(면제) · 레포 밖 → ALLOW.

아래는 진단 당시의 기록이다.

Phase 1 이후 `node scripts/hooks/tdd-guard.test.mjs`가 **25 passed, 3 failed**가 됐다
(Phase 0 시점에는 28/28 통과).

**가드 자체는 정상이다.** 훅 파일(`scripts/hooks/tdd-guard.mjs`)은 Phase 1에서 한 줄도 바뀌지 않았고,
직접 호출해 확인했다:

```
테스트 없는 새 경로(src/lib/brandnew/thing.ts)  → DENY  ✓
테스트가 생긴 경로(src/lib/csv/normalize.ts)    → ALLOW ✓ (이게 정답이다)
```

원인은 **테스트 픽스처의 경로 선택**이다. `tdd-guard.test.mjs:70`이 "테스트 없는 새 구현 파일"
픽스처로 **상대경로** `src/lib/csv/normalize.ts`를 쓴다:

```js
const addPatch = "*** Begin Patch\n*** Add File: src/lib/csv/normalize.ts\n+export const x = 1;\n*** End Patch";
```

Phase 1 step 0이 `src/lib/csv/normalize.test.ts`를 정당하게 만들었으므로 가드가 이제 ALLOW를 낸다.
**낡은 것은 가드가 아니라 테스트의 기대값이다.** 같은 파일 61번째 줄의 절대경로 픽스처
(`D:\p\src\lib\csv\normalize.ts`)는 존재하지 않는 경로라 그대로 DENY로 통과한다 — 실패한 3개가
전부 상대경로를 쓰는 `apply_patch` 변형인 이유다.

고치는 법: 픽스처 경로를 **레포에 절대 생기지 않을 이름**으로 바꾼다.

```js
// src/lib/csv/normalize.ts → 실제 파일이 생기면 픽스처가 무력화된다
const addPatch = "*** Begin Patch\n*** Add File: src/lib/__fixture_never_exists__.ts\n+export const x = 1;\n*** End Patch";
```

**이번 Phase에서 고치지 않은 이유**: 사용자 조건 6(「Phase 1 범위를 벗어난 기능은 수정하지 않기」).
`scripts/hooks/`는 하네스 인프라이고 Phase 1 산출물이 아니다. 다만 이 테스트가 빨간 상태로 남으면
Phase 2에서 **진짜 회귀와 이 잡음을 구분할 수 없으므로** Phase 2 전에 고치는 것을 권한다.

### F-2. `execute.py` 경과 시간 표시 버그 — 아무 때나

Phase 0 실행 중 모든 step이 `[0s]`로 찍혔다. 실제로는 30분 40초 걸렸다.

원인 (`scripts/execute.py` `_execute_single_step`):

```python
with progress_indicator(tag) as pi:
    self._invoke_codex(step, preamble)
    elapsed = int(pi.elapsed)      # ← with 블록 '안'에서 읽는다
```

`progress_indicator`는 `info.elapsed`를 `finally`에서 설정하는데, `finally`는 `with` 블록이
**끝난 뒤에** 실행된다. 따라서 위 줄은 항상 초기값 `0.0`을 읽는다.

고치려면 `elapsed = int(pi.elapsed)`를 `with` 블록 **밖으로** 빼면 된다.

**표시만의 문제다.** step 실행·재시도·커밋·상태 기록은 전부 정상이었고,
정확한 소요 시간은 `index.json`의 `started_at`/`completed_at`으로 계산할 수 있다
(위 「진행 현황」 표의 소요 열이 그렇게 뽑은 값이다).

---

## 이 계획이 전제하는 기술 결정

문서에 없어서 이 계획이 **새로 정한 것들**이다. 동의하지 않으면 step 파일을 고치기 전에 여기부터 고쳐라.

### D-1. 테스트 러너는 Vitest

Jest 대신 Vitest. 이유: ESM·TS를 변환 설정 없이 돌리고, `vi.mock`으로 `@anthropic-ai/sdk`·`@supabase/supabase-js`를 모듈 단위로 갈아끼우기 쉽다(ADR-018 mock-first의 전제). `npm run test` = `vitest run` (watch 아님 — Stop 훅이 매 세션 끝에 돌리므로 watch면 훅이 영원히 안 끝난다).

기본 environment는 `jsdom` 하나로 통일한다. Vitest의 jsdom 환경은 Node 전역(`TextDecoder`·`Buffer`)을 그대로 남겨두므로 순수 로직 테스트도 같은 환경에서 돈다. `environmentMatchGlobs`는 쓰지 않는다 — Vitest 3에서 deprecated다.

### D-2. Tailwind v4

DESIGN.md §1의 1차 예시가 v4(`@theme inline`)다. v4로 스캐폴딩하고 토큰을 `var()`로만 매핑한다. `tailwind.config.ts`를 만들지 않는다.

### D-3. CSV 의존성 — `papaparse` + `iconv-lite`

- 한국 카드사 CSV는 가맹점명에 콤마가 들어가고 따옴표 이스케이프가 섞인다. 직접 split 하면 조용히 틀린다 → `papaparse`.
- cp949는 euc-kr의 상위집합이라 Node의 `TextDecoder('euc-kr')`로는 확장 음절이 깨진다 → `iconv-lite`의 `cp949`.
- **인코딩 판별은 라이브러리 없이 한다**: `TextDecoder('utf-8', {fatal:true})`로 디코드해보고 throw하면 cp949로 본다. 결정적이고 의존성이 늘지 않는다.

브라우저 쪽 미리보기(`src/lib/csv/preview.ts`)는 이 둘을 **쓰지 않는다** — 브라우저 내장 `TextDecoder('euc-kr')`만 쓴다. 이유: `iconv-lite`는 `Buffer`에 의존해 클라이언트 번들에 폴리필을 끌고 들어온다.

### D-4. 헤더 지문은 "상위 20행의 자릿수 마스킹 해시"

`csv_format_mappings.header_fingerprint`를 계산하려면 헤더 행이 어디인지 알아야 하는데, 헤더 행 위치를 판정하는 게 LLM이다(ADR-002) — 순환이다.

풀이: 지문을 **헤더 행이 아니라 상위 20행 전체의 모양**에서 뽑는다. 각 행의 셀 수 + 셀 텍스트에서 숫자를 `#`로 치환한 것을 이어붙여 sha256. 같은 카드사의 다른 달 명세서는 날짜·금액이 마스킹되어 같은 지문이 되고, 다른 카드사는 상단 메타 블록 모양이 달라 갈린다. 캐시 히트 후에는 저장된 `header_row_index`가 헤더 위치를 알려준다.

### D-5. 계정과목 고정 목록 (18개) — **확정됨 (2026-07-31 승인)**

문서에 "고정 목록"이라고만 있고 목록 자체가 없다. `src/types/account-codes.ts`에 아래를 박는다. ASCII 코드 + 한글 라벨 쌍으로 두는 이유: `transactions.account_code`가 스냅샷이라 라벨 문구가 바뀌어도 과거 데이터가 안 깨져야 한다.

```
welfare 복리후생비 · travel 여비교통비 · entertainment 기업업무추진비 · comms 통신비
utilities 수도광열비 · taxes 세금과공과 · rent 지급임차료 · repair 수선비
insurance 보험료 · vehicle 차량유지비 · shipping 운반비 · training 교육훈련비
books 도서인쇄비 · supplies 소모품비 · fees 지급수수료 · ads 광고선전비
outsourcing 외주용역비 · etc 기타
```

이 목록은 ① Claude 프롬프트에 그대로 박히고 ② `merchant_dictionary` 적재 검증 기준이 되고 ③ 도넛 범례가 된다. **세 곳이 같은 상수를 읽는다.**

### D-6. 절세 추정 세율 6.6% — **확정됨 (2026-07-31 승인)**

PRD는 "예상 절감액(참고용)"이라고만 한다. 추정액은 항상 하한이어야 하므로(ADR-013) **종합소득세 최저 구간 6% + 지방소득세 10% = 6.6%**를 상수로 박는다. 화면에는 "최저 세율 기준 보수적 추정"이라고 쓴다.

`src/lib/report/aggregate.ts`의 `ESTIMATED_TAX_RATE` 상수 하나이며, 사용자별 세율 입력 UI는 만들지 않는다.

### D-7. 문서 디렉토리 구조에 없는 파일 3개를 추가한다

ARCHITECTURE.md §디렉토리 구조에 없지만 필요한 것들. 이유를 붙여 명시적으로 승인한다.

| 파일 | 왜 필요한가 | 왜 기존 파일에 못 넣나 |
|---|---|---|
| `src/services/claude/client.ts` | `stop_reason` 검사 · 스트리밍 · 프롬프트 캐싱은 LLM 호출 2곳이 **똑같이** 해야 한다 | `map-columns.ts`와 `classify-merchants.ts`에 복붙하면 한쪽만 고쳐지는 날이 온다 |
| `src/lib/analysis/run-analysis.ts` | `after()` 안에서 도는 파이프라인 오케스트레이션 | 라우트 핸들러에 넣으면 유닛테스트가 HTTP를 거쳐야 한다 |
| `src/lib/csv/preview.ts` | 업로드 화면의 자동 판별 카드(브라우저 실행) | `normalize.ts`는 `iconv-lite`(Buffer 의존)를 import한다 |

### D-8. 마이그레이션은 SQL 파일까지만 만들고 적용은 사람이 한다

`supabase/migrations/*.sql`을 커밋하는 데서 step이 끝난다. **DB에 적용하지 못했다고 `blocked` 처리하지 마라** — Supabase 프로젝트 자격증명은 하네스가 갖고 있지 않고, 모든 테스트는 SDK를 mock하므로 적용 여부와 무관하게 통과한다(ADR-018).

대신 마이그레이션 SQL을 **텍스트로 읽어 불변식을 검사하는 테스트**(`supabase/migrations.test.ts`)를 둔다: `DROP TABLE` 없음 · `transactions`에 카드번호 컬럼 없음 · 전역 사전 2개 테이블에 사용자 식별자 없음 · RLS 활성화 · `uploads(user_id, file_hash)` 유니크. DB 없이 도는 회귀 방어다.

### D-9. 검토 지점 — 하네스가 대신할 수 없는 것

아래는 **사람이 수동으로** 해야 하고, step을 `blocked` 시키는 대신 Phase 완료 후 체크리스트로 남긴다.

| 시점 | 무엇 | 상태 | 왜 자동화 못 하나 |
|---|---|---|---|
| Phase 0 후 | Supabase 프로젝트 생성 · 마이그레이션 적용 · Google OAuth provider 설정 | **완료 (2026-08-05~07)** — B-2 | 외부 콘솔 |
| Phase 1 후 | 실제 카드사 CSV로 파싱 검증 | **완료 (2026-08-07)** — B-3 → `6-integrity` 15건 | 실물 파일이 필요하고, 이 제품에서 가장 위험한 부분이다(ADR-012) |
| Phase 2 후 | `ANTHROPIC_API_KEY`로 LLM 호출 2곳 실측 (mock과 실제 SDK 괴리 확인 — ADR-018 트레이드오프) | **완료** — 괴리가 실제로 있었다: #37(JSON 경계) · #28(529 백오프) · #27(URL 길이) | 키 필요 |
| Phase 3 후 | 라이트/다크 · 880px 이하 · 빈 상태 · 잠긴 상태 육안 확인 | 완료 | 시각 |
| **Phase 5 전** | **Polar 상품의 통화·금액 확정 (KRW ₩9,900)** | **미결 — B-4 / D-20** | 외부 콘솔 |
| **Phase 5 전** | **`POLAR_WEBHOOK_SECRET` 발급** | **미결 — B-5** | 외부 콘솔 |
| Phase 5 중 | **`0008`을 live DB에 적용** — 웹훅 URL 등록보다 **먼저** | 대기 | 외부 콘솔. 순서가 뒤집히면 이벤트가 유실된다 |
| Phase 5 후 | Polar 샌드박스 결제 → 웹훅 → `profiles.plan` 전이 (§Phase 5 완료 기준 F) | 대기 | 외부 결제 |

### D-10. `/auth/callback`은 6번째 화면이 아니다

DESIGN.md는 라우트 5개 고정을 말한다. `src/app/auth/callback/route.ts`는 **화면이 아니라 OAuth 리다이렉트를 받는 라우트 핸들러**다. 렌더링 결과가 없고 즉시 리다이렉트한다. 이 예외 외에 새 라우트를 만들지 마라.

---

## Phase 5 결정 — D-11 ~ D-20 (2026-08-07 승인)

Phase 5 계획서를 실제 SDK·마이그레이션과 대조하다 **문서끼리 갈린 지점 10개**가 나왔다.
전부 "결정하지 않으면 코드가 갈린다"는 성질이라 실행 전 승인 게이트로 올렸다.
**D-11 ~ D-19는 승인됐고, D-20만 미결이다.**

근거가 된 실측은 전부 `node_modules`의 설치본에서 확인한 것이다 — 추측이 아니다.

### D-11. `canceled`는 잠그지 않는다. `revoked`가 잠근다 — **승인**

> **결정: `subscription.canceled` 이벤트는 `plan`을 `free`로 내리지 않는다. `pro`를 유지한다.
> 실제 종료는 `subscription.revoked`다.**

옛 step 파일은 *"`revoked`/`canceled` 확정 → `plan: 'free'`"*로 둘을 묶고 있었다.
Polar에서 `canceled`는 **해지 예약**이고 결제한 기간 끝까지 접근이 유지된다.
그대로 구현하면 **이번 달 요금을 낸 사용자를 해지 버튼 누른 즉시 잠근다.**

ADR-008의 "구독 종료는 화면을 잠글 뿐"이라는 문장에서 '종료'가 언제인지가 불명확했던 것이
원인이다. → ADR-008에 한 줄을 박았다.

**이중 안전장치**: `canceled` 이벤트가 도착할 때 `data.status`가 `active`인지 `canceled`인지는
Polar 구현에 달렸고 우리가 확정할 수 없다. 그래서 (1) status에서 plan을 파생하고
(2) **이벤트 타입이 `subscription.canceled`면 파생 결과를 무시하고 `pro`를 유지**한다.
어느 쪽으로 오든 결과가 같아진다.

### D-12. `unpaid`는 이벤트가 아니라 status 필드다 — **승인**

`@polar-sh/sdk@0.49.0` 실측:

- `SubscriptionStatus` enum: `incomplete` · `incomplete_expired` · `trialing` · `active` · `past_due` · `canceled` · **`unpaid`** · `paused`
- 웹훅 페이로드 컴포넌트 9개: `subscription.{created,updated,active,canceled,uncanceled,past_due,paused,resumed,revoked}`

**`subscription.unpaid` 이벤트는 존재하지 않는다.** `unpaid`는 `subscription.updated`의
`data.status`로만 온다. 옛 step 파일과 ARCHITECTURE.md가 둘 다 이벤트인 것처럼 쓰고 있었고,
그대로 구현하면 `unpaid` 처리가 **영원히 안 돈다** — 미납 사용자가 계속 Pro다.

> **결정: `subscription.updated`의 `data.status === 'unpaid'`에서 `free`로 내린다.**

### D-13. `paused` → free, `trialing` → pro — **승인**

`SubscriptionStatus` 8값 중 옛 계획이 언급조차 하지 않은 것들이다. 파생 함수가 8값 전부를
덮어야 하고, 테이블 주도 테스트로 8건을 검사한다.

| status | plan | 근거 |
|---|---|---|
| `active` · `trialing` | `pro` | 체험 중에도 제품을 써 봐야 전환된다 |
| `past_due` | `pro` | 유예 타이머를 우리가 만들지 않는다 |
| `unpaid` · `paused` · `canceled` · `incomplete` · `incomplete_expired` | `free` | |

### D-14. `Webhooks` 헬퍼를 쓰지 않고 `validateEvent`를 직접 부른다 — **승인**

`@polar-sh/nextjs@0.9.6`의 `Webhooks`는 raw body 검증 자체는 **올바르다**
(`await request.text()` → `validateEvent`, 헤더 `webhook-id`·`webhook-timestamp`·`webhook-signature`).

쓰지 않는 이유는 **응답 코드를 통제할 수 없다는 것 하나다**: 검증 실패에 **403**을 강제하고
성공 시 `{received:true}` 200을 강제한다. 우리 계약은 401이고, 무엇보다 RPC 실패에
**5xx를 우리가 반환해야** Polar가 재전송한다.

> **결정: `@polar-sh/sdk/webhooks`의 `validateEvent`·`WebhookVerificationError`를 직접 쓴다.**

### D-15. `Checkout`·`CustomerPortal` 헬퍼 금지 — **승인**

`node_modules/@polar-sh/nextjs/dist/index.js:18-45` — `Checkout`이 **쿼리 파라미터에서** 읽는 값:

```
products · customerId · customerExternalId · customerEmail · customerName
customerBillingAddress · customerTaxId · customerIpAddress · discountId · metadata · seats
```

`?products=<남의-상품>&customerExternalId=<피해자-uid>` 가 그대로 통과한다.
**ARCHITECTURE.md §Polar 결제 첫 줄("요청의 product ID·user ID·return URL을 신뢰하지 않는다")을
문자 그대로 위반한다.**

같은 파일 `:54`·`:89`·`:107`의 `console.error(error)`는 SDK 원본 에러 객체를 그대로 찍는다 —
고객 식별자·이메일·URL이 들어갈 수 있다. **AGENTS.md CRITICAL(로그 PII 금지) 위반이다.**

> **결정: `@polar-sh/nextjs`를 어디서도 import하지 않는다. `@polar-sh/sdk`만 쓴다.**
> → ADR-023으로 승격.

### D-16. `apply_polar_event`는 `security definer` + `service_role` EXECUTE만 — **승인**

`0005_grants.sql`이 남긴 공백: *"getProfilePlan() — plan 조회만. **plan 갱신은 Phase 5 웹훅의
몫이라 아직 없다**"*. 채우는 방법이 두 가지였다.

| | (a) `grant update on profiles to service_role` | (b) `security definer` 함수 + EXECUTE만 |
|---|---|---|
| 동작 | 됨 | 됨 |
| `apply_polar_event` 밖에서 `plan` 변경 | **가능** | **불가능 (권한 없음)** |
| ADR-020의 "유일한 경로" | 규율로 지킨다 | **권한이 막는다** |

> **결정: (b). `service_role`에 `profiles` UPDATE를 주지 않는다. `webhook_events`에도 GRANT를 주지 않는다.**
> `0007_upload_recompute.sql`의 `replace_upload_result()`가 이미 같은 형태다 — 형판이 있다.

`create or replace`가 EXECUTE를 PUBLIC에 자동으로 주므로 **`revoke`가 반드시 뒤에 와야 한다.**
순서를 뒤집으면 PostgREST의 `/rest/v1/rpc/`로 미로그인 호출이 열린다(0007 주석이 같은 함정을 기록했다).

### D-17. 마이그레이션 번호는 `0008` — **승인**

옛 step 파일이 `0005_polar_event_fn.sql`을 예약했지만 **`0005`는 `0005_grants.sql`이 가져갔다**(#21).
`0006`(#26) · `0007`(#39)도 `6-integrity`에서 나왔다.

> **결정: `0008_polar_event_fn.sql`. 기존 `0001`~`0007`은 live DB에 적용됐으므로 수정하지 않는다.**

재발 방지: AGENTS.md에 *"마이그레이션 번호는 `ls supabase/migrations | tail -1`의 다음 번호다.
계획 문서에 적힌 번호를 믿지 마라"*를 넣었고, `migrations.test.ts`에 번호 연속·중복 검사를 추가한다.

### D-18. `POLAR_SERVER`는 두 값만 받고 기본값이 없다 — **승인**

`.env`에는 `POLAR_SERVER`가 있는데 **`.env.example`에는 없다.** SDK의 `server` 옵션은
`'sandbox' | 'production'`이다(타입 정의 확인).

> **결정: `getPolarServer()`가 `'sandbox'`·`'production'`만 받고, 미설정·오타는 `PolarError(kind:'config')`로 던진다. 기본값을 두지 않는다.**

기본값이 안전하지 않은 이유가 양쪽 다 있다:

- `?? 'production'` — 환경변수를 깜빡한 로컬·CI가 **실 결제 서버**에 붙는다
- `?? 'sandbox'` — 프로덕션 배포에서 깜빡하면 결제가 조용히 샌드박스로 가고,
  **돈이 안 들어오는데 사용자는 Pro가 된다**

`.env.example`에 `POLAR_SERVER`를 추가한다(step 0).

### D-19. `NEXT_PUBLIC_APP_URL`을 삭제한다 — **승인**

`.env`에 `NEXT_PUBLIC_APP_URL`과 `NEXT_PUBLIC_SITE_URL`이 **둘 다** 있는데, 코드가 참조하는 것은
`NEXT_PUBLIC_SITE_URL` 하나뿐이다(`src/app/auth/callback/route.ts:5`). `APP_URL`은 참조 0곳이다.

> **결정: `NEXT_PUBLIC_APP_URL`을 `.env.example`에서 삭제한다. `NEXT_PUBLIC_SITE_URL`만 남긴다.**

이름이 비슷한 키가 둘이면 Polar return URL을 구성할 때 어느 쪽을 쓸지 헷갈리고,
틀린 쪽을 쓰면 **결제 후 엉뚱한 도메인으로 돌아온다.**

### D-20. Polar 상품의 통화·금액 — **미결 (B-4)**

랜딩과 `/upgrade`가 `₩9,900 / 월`을 말한다(`src/components/marketing/Pricing.tsx`에 상수 한 곳).
**Polar가 KRW를 지원하는지, 그 금액으로 월 구독 상품을 만들 수 있는지 확인되지 않았다.**

- 지원하면 → 지금 문구 그대로. 결정 없음.
- 지원하지 않으면 → 통화·금액을 바꿔야 하고 **랜딩·`/upgrade`·`/legal`의 문구가 함께 움직인다.**

PRD상 **청구의 source of truth는 Polar 상품 설정**이지 우리 화면이 아니다. 화면이 상품을
따라가야 한다.

> **미결 상태로 Phase 5를 시작해도 된다.** step 4가 가격 숫자를 새로 하드코딩하지 않고
> 기존 상수를 import하도록 지시해 뒀으므로, 확정되면 **고칠 곳이 한 곳이다.**
> 단 **결제 실검증(완료 기준 F) 전에는 반드시 확정돼야 한다.**

---

## Phase 5 시작 게이트

Phase 5는 Phase 0~4 `completed` 외에 **아래를 추가로 통과해야** 시작한다.
`python scripts/execute.py 5-billing`을 돌리기 전에 이 절을 확인하라.

### 승인 게이트 — 결정 (전부 통과해야 한다)

- [x] D-11 `canceled`는 잠그지 않는다 — 승인 (2026-08-07)
- [x] D-12 `unpaid`는 `subscription.updated`의 status — 승인
- [x] D-13 `paused`→free · `trialing`→pro — 승인
- [x] D-14 `validateEvent` 직접 호출 — 승인
- [x] D-15 `Checkout`·`CustomerPortal` 헬퍼 금지 — 승인
- [x] D-16 `security definer` + `service_role` EXECUTE만 — 승인
- [x] D-17 마이그레이션 번호 `0008` — 승인
- [x] D-18 `POLAR_SERVER` 두 값 · 기본값 없음 — 승인
- [x] D-19 `NEXT_PUBLIC_APP_URL` 삭제 — 승인
- [ ] **D-20 Polar 통화·금액 (KRW ₩9,900) — 미결.** step 0~4는 진행 가능, **완료 기준 F 전에 확정 필요**

### 외부 게이트 — Polar dashboard (코드로 풀 수 없다)

코드 변경과 **분리한다.** 6번의 순서가 특히 중요하다.

- [ ] 1. Polar sandbox 조직 생성 / 로그인
- [ ] 2. 월 구독 상품 1개 생성 — 통화·금액 확정 (**D-20**)
- [ ] 3. `POLAR_PRODUCT_ID` 확인 — `.env`에 값은 있으나 **sandbox 상품의 것인지 미확인**
- [ ] 4. Access Token 발급 → `POLAR_ACCESS_TOKEN` (스코프 확인)
- [ ] 5. `POLAR_SERVER=sandbox` 확인
- [ ] 6. **Webhook endpoint 등록: `{NEXT_PUBLIC_SITE_URL}/api/webhook/polar`**
      → **step 3 배포 + `0008` 적용 후에 등록한다.** 먼저 등록하면 404/500 재전송이 쌓이고
        Polar의 재시도 상한을 소진해 이벤트를 잃는다
- [ ] 7. 구독 이벤트 9종 전부 체크 — 특히 **`subscription.updated`**(`unpaid`가 여기로만 온다)
- [ ] 8. **Webhook secret 복사 → `POLAR_WEBHOOK_SECRET`** ← **현재 `.env`에서 비어 있다 (B-5).**
        없으면 모든 웹훅이 401이다
- [ ] 9. Vercel 환경변수에 5개 동기화 — 로컬 `.env`는 배포에 가지 않는다

### DB 게이트 — 적용 순서

```
step 1 (billing-schema) 머지 — 0008 SQL 커밋, DB 적용 없음
   ↓
0008 을 live DB 에 적용                    ← 사람. Supabase SQL Editor
   ↓
적용 확인:
  select proname from pg_proc where proname = 'apply_polar_event';
  \df+ public.apply_polar_event      -- EXECUTE 가 service_role 에만 있는지
   ↓
step 2 (billing-routes) · step 3 (polar-webhook) 머지 · 배포
   ↓
Polar dashboard 웹훅 URL 등록              ← 위 외부 게이트 6번
   ↓
step 4 (upgrade-page)
   ↓
샌드박스 결제 실검증 (완료 기준 F)
```

**`0008` 적용 전에 웹훅 URL을 등록하지 마라.** RPC가 없으니 500이 나고, 재전송이 상한에 닿으면
그 이벤트는 영원히 잃는다.

### 보안 게이트 G1 ~ G6

각 게이트를 **유닛 테스트와 SQL 텍스트 불변식 두 층에서** 잠근다. 유닛 테스트만으로는
"RPC를 한 번 불렀다"는 확인할 수 있어도 **그 RPC의 SQL이 실제로 원자적인지**는 확인할 수 없다.
`supabase/migrations.test.ts`가 그 구멍을 막는다 — `0007`이 이미 쓰는 패턴이다.

| # | 게이트 | ADR | 유닛 테스트 | SQL 불변식 (`migrations.test.ts`) | step |
|---|---|---|---|---|---|
| G1 | `webhook_events` INSERT + `profiles` UPDATE 원자 | **ADR-021** | `rpc()` 정확히 1회 · `.from('profiles').update` 0회 | 함수 본문에 INSERT와 UPDATE가 **둘 다** | 1 · 3 |
| G2 | 웹훅이 `uploads`·`transactions` 불변 | **ADR-008** | 두 테이블 mock 호출 0회 (free 전이 포함) | 함수 본문에 두 테이블 DELETE/UPDATE **0건** | 1 · 3 |
| G3 | checkout·portal·upgrade가 `plan` 미변경 | **ADR-020** | `profiles` 쓰기 mock 0회 | — (코드 계층) | 2 · 4 |
| G4 | 서명 검증이 최우선 | ARCH §Polar | `req.json()` 소스 부재 · 검증 실패 시 파서·DB mock 0회 · body 로그 부재 | — | 3 |
| G5 | 함수 노출 최소 | **D-16** | — | `revoke`가 `create` 뒤 · `from public, anon, authenticated` · `grant execute`는 `service_role`만 · `profiles` UPDATE grant 없음 | 1 |
| G6 | 구독 테이블 부재 | **ADR-021** | — | 기존 `does not define a subscriptions table` 유지 | 1 |

G5는 **`0008` 전용이 아니라 "모든 `security definer` 함수"로 일반화한다.** 그러면 앞으로
추가될 함수가 자동으로 검사 대상이 된다.

---

## Phase 5 완료 기준

```
A. npm run lint && npm run build && npm run test  통과
B. 보안 게이트 G1~G6 가 테스트로 강제됨
C. env 없이 next build 통과 (lazy env 실증 — ADR-018)
D. 0008 이 live DB 에 적용되고 supabase/README.md 적용 순서에 반영됨
E. /upgrade 가 200 을 반환하고 진입점 3곳이 전부 도달
   (Sidebar.tsx · Pricing.tsx · LockedTable.tsx)
F. 수동 검증 — 사람만 가능:
   F-1. Polar sandbox 결제 → 웹훅 수신 → profiles.plan free→pro 전이
   F-2. 해지 → subscription.canceled 수신 시 pro 유지 (D-11)
        → 기간 만료 subscription.revoked 수신 시 free
   F-3. 같은 event_id 재전송 → duplicate, profiles 무변화
   F-4. 결제 전후 uploads · transactions row count 동일 (ADR-008)
```

**F는 자동화할 수 없다.** D-20(통화·금액)이 F 이전에 확정돼야 한다.

### `supabase-safe-migration` skill — **만들지 않기로 한다**

검토했고 **지금은 과하다**고 판단했다. 근거 셋:

1. **지식이 이미 3곳에서 강제되고 있다** — `migrations.test.ts`(텍스트 불변식 15+개) ·
   `bash-guard.mjs`(`DROP TABLE` 차단) · `0005`/`0007`의 주석(GRANT/REVOKE 순서 함정을 이미 문서화).
2. **남은 마이그레이션은 `0008` 하나다.** 한 번 쓸 것에 skill을 만드는 것은 과잉이다.
3. **결정적인 이유** — skill은 Claude Code 세션에서만 로드된다. **Phase 5는 `codex exec`로 돌고
   codex는 skill을 읽지 않는다.** 정작 마이그레이션을 쓸 주체에게 닿지 않는다.

대신 같은 효과를 더 싸게 얻는다:

- `supabase/README.md`에 **「새 마이그레이션 체크리스트」** 절 (가드레일 경로 밖이지만
  step 1이 「읽어야 할 파일」로 지정한다)
- `migrations.test.ts`의 GRANT/REVOKE 순서 검사를 **모든 `security definer` 함수로 일반화**
  (게이트 G5). 규율이 아니라 `npm test`가 막는다 — 이쪽은 codex 세션에도 확실히 닿는다

마이그레이션 러시가 한 번 더 오면 그때 skill로 승격을 재검토한다.

---

## Phase 0 — `0-foundation` (6 steps)

| # | name | 한 줄 |
|---|---|---|
| 0 | `project-setup` | Next.js·TS strict·Tailwind v4·Vitest·ESLint. **Stop 훅 3종 명령이 통과하는 상태를 만드는 것이 전부다** |
| 1 | `design-tokens` | `design/` 토큰 → `src/styles/` 복사 · `@theme inline` 매핑 · `next/font` · 다크 토글 |
| 2 | `core-types` | 업로드·거래·리포트 타입 + 고정 어휘 3종(에러 7개·판정 3개·계정과목 18개) |
| 3 | `db-schema` | `supabase/migrations/*.sql` — 테이블·인덱스·RLS·Storage 정책·pg_cron |
| 4 | `supabase-clients` | `client`/`server`/`service` 3종. service 헬퍼는 `userId`가 필수 첫 인자 |
| 5 | `auth-flow` | `middleware.ts` · `/auth/callback` · Google 로그인 버튼 · 빈 `/dashboard` |

## Phase 1 — `1-pipeline` (7 steps)

| # | name | 한 줄 |
|---|---|---|
| 0 | `csv-normalize` | 인코딩 판별 · 파싱 · 금액(취소 음수 보존) · 날짜 · **카드번호/승인번호 폐기** |
| 1 | `csv-fingerprint` | 파일 sha256 · 상위 20행 자릿수 마스킹 지문 (D-4) |
| 2 | `claude-client` | 공용 래퍼 — 스트리밍·`stop_reason` 3분기·프롬프트 캐싱·lazy env |
| 3 | `map-columns` | LLM 호출 ① 상위 20행 → 컬럼 매핑. 인덱스 범위 검증 · 인젝션 경계 |
| 4 | `merchant-dictionary` | 전역 사전 조회/적재. **고정 목록 검증 통과 항목만** · 사용자 식별자 금지 |
| 5 | `classify-merchants` | LLM 호출 ② 상호명 배열만 → 판정. **길이·인덱스 정합성 검사** |
| 6 | `aggregate` | 서버 산술 전부. `uncertain` 제외 · 취소 상계 · 인사이트 생성 |

## Phase 2 — `2-api` (6 steps)

| # | name | 한 줄 |
|---|---|---|
| 0 | `gate` | `plan` → 열람 범위. **무료 페이로드에 거래 행이 0개** |
| 1 | `analysis-pipeline` | `after()` 안에서 도는 오케스트레이션. 캐시 → LLM → 저장 → 집계 |
| 2 | `uploads-ingest` | `POST /api/uploads` 202 · 해시 선검사 · Storage 보상 삭제 / `GET` 목록 |
| 3 | `uploads-detail` | `GET`(게이트 절단) · `DELETE`(Storage → DB 순서). 타인 것은 404 |
| 4 | `uploads-retry` | 최대 2회 · 90일 만료 시 `expired` |
| 5 | `uploads-export` | 세무사 전달용 CSV. **파일 생성 전에 plan 확인** |

## Phase 3 — `3-app-ui` (6 steps)

| # | name | 한 줄 |
|---|---|---|
| 0 | `app-shell` | `.fs-app`/`.fs-side`/`.fs-topbar`. nav는 `/dashboard`·`/upgrade` 둘뿐 |
| 1 | `upload-dropzone` | 드롭존 + 브라우저 자동 판별 카드 + **빈 상태 먼저** |
| 2 | `uploads-history` | 과거 목록(기간·거래 수) + `/dashboard` 조립 |
| 3 | `analysis-status` | `processing`(indeterminate) · `failed`(고정 어휘 7개) + 폴링 |
| 4 | `report-summary` | 절감액 히어로 · 지표 3개 · 애매 배너 · 인사이트 · 도넛(3건 이하면 표) |
| 5 | `report-table-lock` | 거래 표 + `.fs-lockwrap`. **잠긴 행은 서버가 안 보낸다** |

## Phase 4 — `4-marketing` (3 steps)

| # | name | 한 줄 |
|---|---|---|
| 0 | `marketing-components` | `Button`·`IconButton`·`TextInput`·`ColorBlock`·`PricingCard`·`MarqueeStrip`·`Footer` |
| 1 | `landing` | `/` — 마퀴 · 히어로 · ColorBlock 3개 · 4단계 · 가격 2티어 · 고지 · 푸터 |
| 2 | `legal` | `/legal` — 약관 · 처리방침 · 세무 고지 |

## Phase 5 — `5-billing` (5 steps)

| # | name | 한 줄 |
|---|---|---|
| 0 | `polar-client` | lazy env · `POLAR_PRODUCT_ID` 하나만 · `POLAR_SERVER` 두 값·기본값 없음(D-18) · `@polar-sh/nextjs` 미사용(D-15) |
| 1 | `billing-schema` | **`0008_polar_event_fn.sql` + GRANT + 불변식 테스트. TypeScript 0줄** (D-16 · D-17 · G1 · G2 · G5 · G6) |
| 2 | `billing-routes` | `/api/billing/checkout` · `/portal`. 요청의 product/user/return URL 불신 · SDK 직접 호출 (G3) |
| 3 | `polar-webhook` | raw body 서명 **최우선**(`validateEvent` 직접) · 단일 RPC · 순서 역전 2단 · `canceled`는 잠그지 않음 (D-11~D-14 · G4) |
| 4 | `upgrade-page` | `/upgrade` **404 해소** + `?checkout=1` 안내 문구 (기능이 아니라 문구) |

**step 1을 따로 뗀 이유**: 옛 계획은 마이그레이션·라우트·테스트를 step 2 하나에 몰아넣었다.
① 「하나의 step은 하나의 레이어」 원칙에 어긋나고 ② SQL이 3회 실패하면 라우트까지 통째로
`error`가 되며 ③ 무엇보다 **라우트가 RPC 시그니처를 추측하게 된다.** DB 계약이 먼저 굳어야 한다.

---

## 전 step 공통 규칙

각 step 파일에도 적혀 있지만 여기 모아둔다.

1. **AC는 항상 `npm run lint && npm run build && npm run test`를 포함한다.** Stop 훅이 어차피 돌리므로 여기서 깨지면 그 step은 끝나지 않는다.
2. **테스트를 먼저 쓴다.** `tdd-guard.mjs`가 구현 파일 쓰기를 막는다. 테스트는 **대상 파일과 같은 디렉토리**에 둔다 (`route.ts` 옆 `route.test.ts`). `src/__tests__/` 공용 파일을 만들지 마라 — 가드 우회 통로가 된다.
3. **tdd-guard 면제 목록** (테스트 없이 써도 되는 것): `*.test.*`/`*.spec.*` · `.json|.css|.md|.yml` · `*.config.*`·`tsconfig`·`next.config` · `src/types/**` · `layout.tsx`/`page.tsx`/`loading|error|not-found.tsx` · `globals.css` · `design/prototype/**`. **`src/middleware.ts`는 면제가 아니다.**
4. **키가 없다는 이유로 `blocked` 처리하지 마라.** 외부 호출은 전부 mock한다(ADR-018).
5. **환경변수는 lazy 검증.** 모듈 최상단에서 `process.env`를 읽고 throw하면 `next build`의 프리렌더가 깨진다.
6. **로그에 PII 금지.** 가맹점명·카드번호·CSV 내용·웹훅 원문 body. 실패 시 에러 코드와 행 수만.
7. **커밋은 `execute.py`가 자동으로 만든다** — 코드는 `feat({phase}): step {N} — {name}`, 메타데이터는 `chore({phase}): step {N} output`으로 분리 커밋된다. step 안에서 직접 커밋할 때도 같은 형식을 쓴다.
8. **step 끝에 `phases/{phase}/index.json`의 해당 step을 갱신한다** — `completed` + `summary`(다음 step이 읽을 산출물 한 줄), 3회 실패면 `error` + `error_message`, 사람 개입이 필요하면 `blocked` + `blocked_reason`.

## 에러 복구

- `error`: `phases/{phase}/index.json`에서 그 step의 `status`를 `pending`으로 되돌리고 `error_message`를 지운 뒤 재실행.
- `blocked`: `blocked_reason`을 해결한 뒤 같은 방법으로 되돌리고 재실행.
