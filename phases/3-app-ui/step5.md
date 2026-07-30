# Step 5: report-table-lock

## 목적

거래 표와 **잠긴 상태**를 만든다. Phase 3의 마지막 step이다.

**잠긴 상태가 곧 결제 화면이다**(DESIGN.md §7). "결제하세요"가 아니라 *무엇이 잠겨 있는지*를 보여줘야 한다.

가장 중요한 것 하나: **무료 사용자의 페이로드에는 실제 거래 행이 들어 있지 않다.** 서버가 이미 잘라서 보냈다(ADR-019 · Phase 2 step 0). 화면의 blur는 **스켈레톤 행에 걸리는 순전한 시각 장치**다.

## 이전 Step과의 의존성

- **step 0 (`app-shell`)** — 셸 + 디자인 규율 공통 테스트
- **step 4 (`report-summary`)** — **금액 포맷 함수**. 그 step의 `summary`에 경로가 있다. 재사용하라
- **Phase 2 step 0 (`gate`)** — `GatedReport`. 무료면 `transactions.length === 0`, `lockedTxnCount > 0`
- **Phase 2 step 3 (`uploads-detail`)** — 응답 형태

## 읽어야 할 파일

- `/docs/DESIGN.md` — **§7의 「잠긴 상태가 곧 결제 화면이다」 전문** · §2(판정 3값 색·칩 클래스) · §5 · §8(숫자 표기) · §9(표는 실제 `<table>`)
- `/design/prototype/report.jsx` — 거래 표 · 잠금 오버레이 시각 참조
- `/src/styles/theme.css` — `.fs-table` `.fs-tablewrap` `.fs-chip` `.chip-biz` `.chip-personal` `.chip-unsure` `.fs-lockwrap` `.fs-lockblur` `.fs-lockscrim` 스펙
- `/docs/ADR.md` — ADR-007(유료의 약속) · ADR-019(서버가 자른다)
- `/docs/PRD.md` — UC-08 · §구독 및 기능 게이트 표
- `/src/lib/gate.ts` · `/src/types/report.ts`

## 구현 범위

```
src/components/report/TransactionTable.tsx  — 실제 <table>. 데이터는 props
src/components/report/LockedTable.tsx       — .fs-lockwrap 스켈레톤 + 스크림 + CTA
src/app/dashboard/uploads/[id]/page.tsx     — 수정: 표 자리를 채운다
```

## 수정 대상 파일

```
src/components/report/TransactionTable.tsx       (신규)
src/components/report/TransactionTable.test.tsx  (신규 — 먼저)
src/components/report/LockedTable.tsx            (신규)
src/components/report/LockedTable.test.tsx       (신규 — 먼저)
src/app/dashboard/uploads/[id]/page.tsx          (수정 — tdd-guard 면제)
```

## 먼저 작성할 테스트

### `TransactionTable` — 실제 표
1. 실제 `<table>`이고 `<th scope="col">`이 있다. **div로 표를 흉내 내지 않는다**(DESIGN.md §9)
2. `.fs-tablewrap`(가로 스크롤) 안에 있다
3. 컬럼: 날짜 · 가맹점 · 금액 · 계정과목 · 판정 · 근거
4. **props로만 받는다.** fetch 호출 0회
5. 금액 열이 우측 정렬이고 weight 540이다(DESIGN.md §8)
6. 금액에 `.num`이 붙는다
7. **취소 거래가 음수 부호로 표시되고(`-₩8,900`) `--fs-unsure` 색이다**(DESIGN.md §8)
8. 판정 칩이 3값 고정 대응이다: `expense`→`.chip-biz`(사업 경비) · `personal`→`.chip-personal`(개인 지출) · `uncertain`→`.chip-unsure`(애매)
9. 계정과목이 **한글 라벨**이다 (`welfare`가 아니라 `복리후생비`)
10. `reason`이 없으면 빈 칸이다 (`null`·`undefined` 문자열이 렌더되지 않는다)
11. step 4의 금액 포맷 함수를 재사용한다 (import 확인)
12. 거래가 0건이면 렌더되지 않거나 빈 상태 문구를 보여준다. **빈 표 골격을 그리지 않는다**

### `LockedTable` ← 이 step의 핵심
13. **props에 실제 거래 데이터가 없다.** 시그니처가 `{ lockedCount: number }` 정도여야 한다. `transactions`를 받는 prop이 존재하지 않음을 타입·테스트로 못박아라
14. 스켈레톤 행 6개를 blur 처리해 렌더한다 (`.fs-lockwrap`/`.fs-lockblur`)
15. **스켈레톤 행의 내용이 실제 데이터가 아니다** — 픽스처에 실제 거래를 넘길 방법이 없으므로 자동으로 만족되지만, 렌더 결과에 그럴듯한 가짜 가맹점명(`스타벅스` 등)이 없음을 검사하라. 가짜 데이터도 만들지 마라 — 사용자가 자기 거래로 착각한다
16. 스크림(`.fs-lockscrim`)에 **잠긴 건수**가 표시된다
17. 스크림에 **무엇이 잠겼는지** 설명이 있다 (거래별 판정과 근거 · 세무사 전달용 다운로드)
18. **"결제하세요"가 아니라 잠긴 내용을 먼저 말한다** — 문구 순서를 검사하라
19. Pro CTA가 `/upgrade`로 링크된다. **Polar checkout으로 직접 가지 않는다** (Phase 5의 `/upgrade`가 중간에 있다)
20. 스켈레톤이 스크린리더에 노출되지 않는다 (`aria-hidden`) — 의미 없는 내용이다
21. 스크림의 안내 문구는 스크린리더가 읽는다

### 페이지 조립
22. `canViewTransactions`(또는 `transactions.length > 0`)면 `TransactionTable`, 아니면 `LockedTable`
23. **무료 경로에서 페이지가 거래를 조회하지 않는다** (Phase 2 step 3이 이미 그렇게 만들었다 — 페이지가 그 계약을 지키는지 확인)
24. **렌더된 HTML 문자열에 가맹점명이 없다** (무료). 픽스처 서버 응답에 거래가 0개이므로 자동이지만, 페이지가 다른 경로로 거래를 가져오지 않는지 못박아라

### 디자인 규율
25. step 0 공통 테스트 재사용

## Codex 실행 지시문

### `LockedTable`은 거래 데이터를 받지 않는다 — 타입으로 막아라

```tsx
// ✅ 이 시그니처면 실수로도 실제 데이터를 못 넘긴다
export function LockedTable({ lockedCount }: { lockedCount: number }): JSX.Element;

// ❌ 이렇게 만들지 마라
export function LockedTable({ transactions, locked }: { transactions: ClassifiedTxn[]; locked: boolean });
```

DESIGN.md §7:

> **잠긴 거래 행을 클라이언트로 보내고 blur로 가리지 마라. 이유: 그것은 게이트가 아니라 장식이다.** 서버가 자른 뒤 보낸 부분 데이터를 blur하는 것이며, 무료 사용자의 페이로드에는 실제 거래 행이 들어 있지 않다(ADR-019). blur는 순전히 시각 장치다.

### 가짜 거래를 만들지 마라

스켈레톤 행은 **회색 막대**여야 한다. `스타벅스 강남점 · ₩4,500` 같은 그럴듯한 가짜를 넣지 마라 — 사용자가 자기 거래로 착각하고, 결제한 뒤 "숫자가 다르다"고 느낀다.

### 잠금 화면은 "무엇이 잠겼는지"를 먼저 말한다

```
거래 342건의 계정과목 · 경비 판정 · 판정 근거가 잠겨 있습니다
세무사 전달용 파일 다운로드도 Pro에서 열립니다
[Pro 시작하기]
```

`결제하세요`로 시작하지 마라. DESIGN.md §7: *"유료 영역은 '결제하세요'가 아니라 **무엇이 잠겨 있는지**를 보여줘야 한다. 잠금 화면이 곧 결제 페이지다."*

### CTA는 `/upgrade`로

Polar checkout URL로 직접 보내지 마라. `/upgrade` 페이지가 가격·잠긴 기능·해지 정책을 보여준 뒤 checkout으로 넘긴다(Phase 5 step 3).

`/upgrade`는 아직 없다 (Phase 5). **링크만 걸어두면 된다** — 그 페이지를 여기서 만들지 마라.

### 표는 실제 `<table>`

DESIGN.md §9: *"표는 `<th scope>`를 갖춘 실제 `<table>`. div로 표를 흉내 내지 마라 — 세무사에게 넘기는 자료라 복사·스크린리더가 실제로 쓰인다."*

사용자가 표를 드래그해 엑셀에 붙여넣을 수 있어야 한다.

### 모바일

`.fs-tablewrap`(가로 스크롤) 안에. 컬럼을 숨기거나 카드 레이아웃으로 바꾸지 마라 — 세무 자료라 전체 열이 필요하다.

### 취소 거래

음수 부호 보존 + `--fs-unsure` 색. **절대값으로 만들거나 숨기지 마라** — 합계가 조용히 틀어진 것처럼 보인다.

### 포맷 함수 재사용

step 4가 만든 금액 포맷 함수를 import하라. 여기서 다시 만들면 `₩` 크기나 구분자가 화면마다 달라진다.

## 완료 조건

- `TransactionTable`·`LockedTable` + 테스트가 존재하고 25개 항목이 전부 통과한다
- **`LockedTable`이 거래 데이터를 받는 prop 자체가 없다**
- 스켈레톤에 가짜 가맹점명이 없다
- 잠금 문구가 "무엇이 잠겼는지"로 시작한다
- CTA가 `/upgrade`로 간다
- 표가 실제 `<table>` + `<th scope>`다
- 취소 음수가 부호와 색을 유지한다
- 금액 포맷이 step 4 함수에서 온다
- 디자인 규율 공통 테스트 통과
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/components/report
```

직접 확인:

```bash
grep -n "transactions" src/components/report/LockedTable.tsx && echo "FAIL: 잠금 컴포넌트가 거래를 받는다" || echo "OK"
grep -nE "스타벅스|편의점|커피|₩[0-9]" src/components/report/LockedTable.tsx && echo "FAIL: 가짜 거래" || echo "OK"
grep -n "<table" src/components/report/TransactionTable.tsx || echo "FAIL: 실제 table 아님"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ADR-019 / DESIGN.md §7 — 잠긴 거래 행이 클라이언트에 오지 않는가? blur가 순전한 시각 장치인가?
   - ARCHITECTURE.md §패턴 — 컴포넌트가 props로만 받는가?
   - DESIGN.md §2 — 판정 3값 칩이 고정 대응인가?
   - DESIGN.md §8 — `.num`, 우측 정렬, 취소 음수 부호와 `--fs-unsure`
   - DESIGN.md §9 — 실제 `<table>` + `<th scope>` + `.fs-tablewrap`
   - DESIGN.md §10 — raw hex·raw px·이모지·파스텔 없는가?
   - 새 라우트를 만들지 않았는가?
3. 결과에 따라 `phases/3-app-ui/index.json`의 step 5를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "components/report/{TransactionTable,LockedTable}.tsx + page.tsx 표 자리 조립. TransactionTable은 실제 table+th scope+.fs-tablewrap, 취소 음수 부호+--fs-unsure, 칩 3값 고정. LockedTable은 lockedCount만 받는 시그니처(거래 prop 없음), 회색 스켈레톤 6행 aria-hidden, 스크림은 '무엇이 잠겼는지'부터 말하고 CTA는 /upgrade")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단

**이 step이 끝나면 Phase 3이 완료된다.** `summary`에 「Phase 3 검토 지점: 라이트/다크 · 880px 이하 · 빈 상태 · 잠긴 상태 육안 확인 필요」를 덧붙여라(`phases/PLAN.md` D-9).

## commit 기준

`feat(3-app-ui): step 5 — report-table-lock`

포함: `src/components/report/{TransactionTable,LockedTable}.{tsx,test.tsx}` · `src/app/dashboard/uploads/[id]/page.tsx`

## 금지사항

- **`LockedTable`이 거래 데이터를 받게 만들지 마라.** 이유: 잠긴 데이터를 보내고 CSS로 가리는 것은 게이트가 아니라 장식이고, DevTools 한 번이면 열린다(ADR-019).
- **그럴듯한 가짜 거래를 스켈레톤에 넣지 마라.** 이유: 사용자가 자기 거래로 착각한다. 회색 막대여야 한다.
- **잠금 문구를 "결제하세요"로 시작하지 마라.** 이유: 잠금 화면이 곧 결제 페이지이고, 설득은 *무엇이 잠겼는지*에서 나온다(DESIGN.md §7).
- **CTA를 Polar checkout으로 직접 보내지 마라.** 이유: `/upgrade`가 가격·잠긴 기능·해지 정책을 보여준 뒤 넘긴다.
- **`/upgrade` 페이지를 여기서 만들지 마라** — Phase 5 step 3이다.
- **div로 표를 흉내 내지 마라.** 이유: 세무사에게 넘기는 자료라 복사·스크린리더가 실제로 쓰인다.
- **모바일에서 컬럼을 숨기거나 카드 레이아웃으로 바꾸지 마라.** 이유: 세무 자료라 전체 열이 필요하다. 가로 스크롤이 답이다.
- **취소 거래를 절대값으로 만들거나 숨기지 마라.**
- **금액 포맷 함수를 새로 만들지 마라.** 이유: 화면마다 `₩` 크기와 구분자가 달라진다.
- **빈 표 골격을 그리지 마라.**
- **오분류 수정 UI를 만들지 마라.** 이유: MVP 제외다. 사용자가 고친 값을 전역 사전에 반영할지 판단할 근거가 아직 없다(PRD).
- **raw hex·raw px·이모지·파스텔 블록을 쓰지 마라.**
- 기존 테스트를 깨뜨리지 마라.
