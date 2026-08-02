# FinSight2 전체 구현 계획

source of truth: `docs/PRD.md` · `docs/DESIGN.md` · `docs/ARCHITECTURE.md` · `docs/ADR.md` · `AGENTS.md`

6개 Phase / 32개 Step. Phase 순서는 **ADR-012**(코어 루프 먼저, 랜딩·결제 나중)를 그대로 따른다.

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
| 1 | `1-pipeline` | 7 | pending | CSV 정규화·지문 · Claude 호출 2곳 · 전역 사전 · 서버 집계 | 픽스처 CSV → 리포트 요약 객체 (전부 유닛테스트) |
| 2 | `2-api` | 6 | pending | 게이트 · 분석 오케스트레이션 · uploads 라우트 5개 | curl로 업로드 → 폴링 → 리포트 JSON |
| 3 | `3-app-ui` | 6 | pending | 앱 셸 · 업로드 화면 · 리포트 3상태 · 잠금 | 브라우저에서 업로드→리포트 전 과정 |
| 4 | `4-marketing` | 3 | pending | 마케팅 컴포넌트 · 랜딩 · `/legal` | 랜딩 → 가입 진입 |
| 5 | `5-billing` | 4 | pending | Polar 클라이언트 · checkout/portal · 웹훅 · `/upgrade` | 결제 → Pro 잠금 해제 |

**Phase 간 순서는 강제다.** Phase N의 step은 Phase N-1이 전부 `completed`인 상태를 전제한다. Phase 내부에서도 step 순서는 강제다 (각 step의 「이전 Step과의 의존성」 참고).

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

---

## 미해결 항목 (Phase 0 종료 시점)

**blocker**는 해당 Phase를 **시작하기 전에** 처리해야 하는 것이고, **후속 작업**은 병렬로 진행해도
Phase 진행을 막지 않는 것이다. 이 구분이 곧 "지금 Phase 1을 시작해도 되는가"의 답이다.

| # | 항목 | 구분 | 언제 | 막는 것 |
|---|---|---|---|---|
| B-1 | `middleware` → `proxy` 전환 결정 | **blocker** | **Phase 2 시작 전** | Phase 2가 미들웨어를 다시 건드린다 |
| B-2 | Supabase DB 마이그레이션 적용 · Google OAuth provider 설정 | **blocker (환경)** | Phase 3 검증 전 | 로그인·업로드를 브라우저로 확인할 수 없다 |
| F-1 | `0004_expiry_cron.sql` 실제 동작 확인 | 후속 | B-2 완료 후 | 없음 (Phase 진행을 막지 않음) |
| F-2 | `execute.py` 경과 시간 표시 버그 | 후속 | 아무 때나 | 없음 (표시만의 문제) |

**Phase 1은 위 넷 중 어느 것에도 막히지 않는다.** Phase 1은 순수 로직과 mock뿐이라
DB·OAuth·미들웨어와 무관하다(ADR-018). 지금 바로 실행할 수 있다.

### B-1. `middleware` → `proxy` 전환 결정 — Phase 2 시작 전

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

**결정 주체는 사람이다.** 결정 전에는 Phase 2를 시작하지 마라.

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

| 시점 | 무엇 | 왜 자동화 못 하나 |
|---|---|---|
| Phase 0 후 | Supabase 프로젝트 생성 · 마이그레이션 적용 · Google OAuth provider 설정 → **B-2로 이관, 「미해결 항목」 참고** | 외부 콘솔 |
| Phase 1 후 | 실제 카드사 CSV 2~3개로 파싱 검증 | 실물 파일이 필요하고, 이 제품에서 가장 위험한 부분이다(ADR-012) |
| Phase 2 후 | `ANTHROPIC_API_KEY`로 LLM 호출 2곳 실측 (mock과 실제 SDK 괴리 확인 — ADR-018 트레이드오프) | 키 필요 |
| Phase 3 후 | 라이트/다크 · 880px 이하 · 빈 상태 · 잠긴 상태 육안 확인 | 시각 |
| Phase 5 후 | Polar 샌드박스 결제 → 웹훅 → `profiles.plan` 전이 | 외부 결제 |

### D-10. `/auth/callback`은 6번째 화면이 아니다

DESIGN.md는 라우트 5개 고정을 말한다. `src/app/auth/callback/route.ts`는 **화면이 아니라 OAuth 리다이렉트를 받는 라우트 핸들러**다. 렌더링 결과가 없고 즉시 리다이렉트한다. 이 예외 외에 새 라우트를 만들지 마라.

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

## Phase 5 — `5-billing` (4 steps)

| # | name | 한 줄 |
|---|---|---|
| 0 | `polar-client` | lazy env · `POLAR_PRODUCT_ID` 하나만 허용 |
| 1 | `billing-routes` | `/api/billing/checkout` · `/portal`. 요청의 product/user/return URL 불신 |
| 2 | `polar-webhook` | raw body 서명 **최우선** · 멱등+plan 갱신 **한 transaction**(plpgsql RPC) · 순서 역전 2단 |
| 3 | `upgrade-page` | `/upgrade` + `?checkout=1` 안내 문구 (기능이 아니라 문구) |

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
