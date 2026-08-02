# Step 0: gate

## 목적

`profiles.plan`으로 **열람 범위를 결정하고, 잠긴 데이터를 아예 담지 않는 페이로드를 만든다.**

ADR-007의 과금 모델 전체가 이 파일 하나에 얹혀 있다. 잘못 만들면 DevTools 한 번에 유료 기능이 전부 열린다.

역할을 셋으로 나눈 것을 기억하라(ARCHITECTURE.md):

| 겹 | 위치 | 담당 |
|---|---|---|
| 잠금 표시 | 브라우저 | UX — 무엇이 잠겼는지 보여준다 |
| **열람 범위 결정** | **이 파일** | **권한** |
| **응답 절단** | 라우트·서버 컴포넌트 | **기밀** — 잠긴 데이터를 직렬화하지 않는다 |

**이 파일은 두 번째 칸이다.** 세 번째 칸(실제 절단)도 여기서 만든 함수가 수행하지만, 호출하는 것은 라우트다.

## 이전 Step과의 의존성

Phase 0·1 전체가 `completed`여야 한다. 직접 쓰는 것:

- **Phase 0 step 2 (`core-types`)** — `UploadSummary`·`GatedReport`·`ClassifiedTxn`
- **Phase 1 step 6 (`aggregate`)** — `aggregate`가 만든 `UploadSummary`의 `insights`가 **전체 목록**이라는 것. 여기서 자른다

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — **§게이트는 서버가 자른다 (역할을 합치지 마라)** 전문
- `/docs/ADR.md` — ADR-007(기능 게이트) · ADR-008(구독 종료는 화면만 잠근다) · ADR-019(서버가 자른다) · ADR-020(권한의 source of truth)
- `/docs/PRD.md` — §구독 및 기능 게이트 표 · §구독 종료 후 접근 정책
- `/docs/DESIGN.md` — §7의 「잠긴 상태가 곧 결제 화면이다」 (blur는 순전히 시각 장치다)
- `/src/types/report.ts` — `GatedReport`
- `/src/lib/report/aggregate.ts` — 전체 인사이트를 만드는 쪽

## 구현 범위

`src/lib/gate.ts` 하나. **순수 함수.** DB를 읽지 않는다 — `plan`을 인자로 받는다.

```ts
export type Plan = 'free' | 'pro';

export interface ViewScope {
  canViewTransactions: boolean;
  insightLimit: number | null;   // null = 전체
  canExport: boolean;
}

export function viewScope(plan: Plan): ViewScope;

/** 클라이언트로 나갈 페이로드를 만든다. 잠긴 데이터는 담지 않는다. */
export function gateReport(
  plan: Plan,
  summary: UploadSummary,
  txns: ClassifiedTxn[],
): GatedReport;
```

`plan`을 DB에서 읽는 것은 라우트·서버 컴포넌트가 한다(`getProfilePlan`). **여기서 읽으면 순수 함수가 아니게 되고 테스트가 mock을 요구한다.**

## 수정 대상 파일

```
src/lib/gate.ts        (신규)
src/lib/gate.test.ts   (신규 — 먼저)
```

## 먼저 작성할 테스트

픽스처만으로. mock 불필요.

### `viewScope`
1. `free` → `canViewTransactions: false` · `insightLimit: 3` · `canExport: false`
2. `pro` → `canViewTransactions: true` · `insightLimit: null` · `canExport: true`
3. `plan`이 알 수 없는 값이면 **`free`로 취급한다** — 기본값은 항상 잠긴 쪽이다

### `gateReport` — free ← 이 step의 핵심
4. **`transactions`의 길이가 `0`이다.** 빈 배열이지 "잘린 배열"이 아니다
5. **직렬화 결과(`JSON.stringify`)에 어떤 가맹점명도 등장하지 않는다.** 픽스처에 `'스타벅스'` 같은 고유 문자열을 넣고 결과 JSON 전체를 문자열로 검사하라. 이 테스트 하나가 ADR-019 전체를 지킨다
6. 직렬화 결과에 개별 거래 금액이 등장하지 않는다 (합계는 등장한다 — 그건 무료 범위다)
7. `insights`가 정확히 3개다 (원본이 3개 미만이면 있는 만큼)
8. `insights`가 **원본 순서의 앞 3개**다 (재정렬하지 않는다)
9. `lockedTxnCount`가 원본 거래 수다 — 화면이 "n건 잠김"을 보여줘야 한다
10. `canExport`가 `false`다
11. `summary`의 합계·절감액·`uncertainCount`는 **그대로 간다** (무료 범위다 — PRD 표)

### `gateReport` — pro
12. `transactions`가 원본 전부다
13. `insights`가 원본 전부다
14. `canExport`가 `true`다
15. `lockedTxnCount`가 `0`이다

### 순수성
16. 입력 `summary`·`txns`를 변형하지 않는다
17. DB·네트워크·env 접근이 없다

## Codex 실행 지시문

### 무료 페이로드에 거래 행을 담지 마라 — 이게 전부다

```ts
// ❌ 게이트가 아니라 장식이다
return { transactions: txns, locked: true };

// ❌ 이것도 안 된다 — 미리보기라도 실제 데이터다
return { transactions: txns.slice(0, 6), locked: true };

// ✅
return { transactions: [], lockedTxnCount: txns.length, ... };
```

DESIGN.md §7이 `.fs-lockwrap`으로 "상위 6행을 blur"하라고 하는데, **그 6행은 서버가 보낸 실제 데이터가 아니다.** 같은 문서가 이어서 말한다: *"무료 사용자의 페이로드에는 실제 거래 행이 들어 있지 않다(ADR-019). blur는 순전히 시각 장치다."*

화면은 스켈레톤 행을 blur한다. **이 파일은 스켈레톤을 만들지 않는다** — 그건 컴포넌트의 일이다(Phase 3 step 5).

### 기본값은 잠긴 쪽

`plan`이 `'pro'`가 **아니면** 전부 `free`로 취급하라. `'free'`인지 검사해서 아니면 pro로 열지 마라 — DB에 예상 못 한 값이 들어왔을 때 열리는 쪽으로 기울면 안 된다.

### `plan`을 여기서 읽지 마라

`getProfilePlan(userId)`를 이 파일에서 부르지 마라. 인자로 받는다. **이유**: 순수 함수여야 테스트가 mock 없이 돌고, 호출부가 "누구의 plan인지"를 명시하게 된다.

클라이언트가 보낸 구독 상태를 **절대** 신뢰하지 마라(ADR-019). 이 함수의 `plan` 인자는 서버가 DB에서 읽은 값이어야 하고, 그 규율은 호출부가 지킨다.

### 구독 종료는 화면만 잠근다

`free`로 돌아온 사용자도 `summary`(절감액·상위 3개 인사이트)는 **전부 그대로 본다.** 과거 분석이든 유료 기간에 만든 것이든 같다(ADR-008 · PRD §구독 종료 후 접근 정책).

이 함수에 "유료 기간에 만들어진 리포트인가" 같은 분기를 넣지 마라. 그런 개념이 없다.

## 완료 조건

- `viewScope`·`gateReport`·`ViewScope`가 존재하고 17개 테스트가 전부 통과한다
- free 페이로드의 `JSON.stringify`에 가맹점명·개별 거래 금액이 없다
- 알 수 없는 plan이 `free`로 처리된다
- 순수 함수다 (DB·네트워크·env 없음)
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/lib/gate.test.ts
```

직접 확인:

```bash
grep -nE "process\.env|supabase|getProfilePlan|fetch\(" src/lib/gate.ts && echo "FAIL: 순수하지 않음" || echo "OK"
grep -nE "slice\(0, ?6\)|preview" src/lib/gate.ts && echo "FAIL: 미리보기 행을 보내고 있다" || echo "OK"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md §디렉토리 구조의 `lib/gate.ts` 한 파일이고 "서버 전용"인가?
   - §게이트는 서버가 자른다 — 세 겹의 역할을 합치지 않았는가?
   - ADR-019 — 잠긴 데이터를 직렬화하지 않는가?
   - ADR-008 — 무료로 돌아온 사용자도 summary는 전부 보는가?
   - 순수 함수인가?
3. 결과에 따라 `phases/2-api/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "lib/gate.ts — viewScope(plan)와 gateReport(plan, summary, txns). free는 transactions 길이 0 + lockedTxnCount + insights 앞 3개, summary 합계는 그대로. 알 수 없는 plan은 free. 순수 함수 — plan은 라우트가 DB에서 읽어 넘긴다")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단

## commit 기준

`feat(2-api): step 0 — gate`

포함: `src/lib/gate.{ts,test.ts}`

## 금지사항

- **무료 페이로드에 거래 행을 담지 마라 — 미리보기 6행도 안 된다.** 이유: 잠긴 데이터를 보내고 CSS로 가리는 것은 게이트가 아니라 장식이다. DevTools 한 번이면 유료 기능 전체가 열린다(ADR-019).
- **알 수 없는 `plan`을 pro로 처리하지 마라.** 이유: 기본값은 항상 잠긴 쪽이어야 한다.
- **이 파일에서 DB를 읽지 마라.** 이유: 순수 함수여야 테스트가 mock 없이 돌고, 호출부가 "누구의 plan인지"를 명시하게 된다.
- **클라이언트가 보낸 구독 상태를 신뢰하지 마라.** 이유: 리다이렉트 파라미터나 요청 본문으로 권한을 열면 누구나 Pro가 된다(ADR-020).
- **잠금 UI(스켈레톤·blur)를 여기서 만들지 마라.** 이유: 이 파일은 권한 층이고, 시각 장치는 컴포넌트 층이다(Phase 3 step 5).
- **"유료 기간에 만들어진 리포트인가" 같은 분기를 만들지 마라.** 이유: 게이트는 화면에 걸리는 것이지 데이터에 걸리는 것이 아니다(ADR-008).
- **횟수·쿼터 개념을 넣지 마라.** 이유: 횟수제는 폐기됐다(ADR-007). 분석 횟수를 세지 않는다.
- 기존 테스트를 깨뜨리지 마라.
