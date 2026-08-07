# Step 4: upgrade-page

## 목적

`/upgrade` 페이지를 만들고, 대시보드에 `?checkout=1` 안내를 붙인다. **전체 계획의 마지막 step이다.**

지금 `/upgrade`는 **404다.** 사이드바(`src/components/app/Sidebar.tsx:8`) · 랜딩 가격표(`src/components/marketing/Pricing.tsx:11`) · 잠긴 표 CTA(`src/components/report/LockedTable.tsx:22`) **세 곳이 이미 `/upgrade`를 가리키고 있는데 페이지 파일이 없다.** 이 step이 그 셋을 동시에 살린다.

`/upgrade`는 프로토타입의 `PaywallModal` 내용을 **페이지로** 만든 것이다(DESIGN.md §6). 모달로 만들지 마라 — 인증은 Google OAuth 리다이렉트고 결제는 `/upgrade` → Polar Checkout 리다이렉트다. 프로토타입은 단일 HTML이라 모달로 흉내 냈을 뿐이다.

`?checkout=1`이 여는 것은 **안내 문구지 기능이 아니다**(ADR-020).

## 이전 Step과의 의존성

- **step 2 (`billing-routes`)** — `POST /api/billing/checkout`·`/portal`
- **step 3 (`polar-webhook`)** — `plan`이 여기서만 바뀐다는 사실. 웹훅 지연 구간이 `?checkout=1` 안내의 존재 이유다
- **Phase 3 step 0 (`app-shell`)** — 셸. `/upgrade`는 앱 레이어다. 사이드바 nav가 이미 `/upgrade`를 가리킨다
- **Phase 3 step 5 (`report-table-lock`)** — `LockedTable`의 CTA가 `/upgrade`로 온다
- **Phase 4 step 1 (`landing`)** — `Pricing`의 Pro CTA가 `/upgrade`로 온다
- **Phase 0 step 5 (`auth-flow`)** — `src/middleware.ts:4`의 `PROTECTED_PATHS`가 이미 `/upgrade`를 보호한다

## 읽어야 할 파일

- `/docs/DESIGN.md` — **§6의 `/upgrade`** · §0(앱 레이어) · §5 · §7(잠긴 상태) · §10
- `/design/prototype/report.jsx` — `PaywallModal` 내용 참조 (**모달로 만들지 마라**)
- `/docs/ADR.md` — ADR-007 · ADR-008 · **ADR-020(`?checkout=1`의 의미)**
- `/docs/PRD.md` — §구독 및 기능 게이트 표 · §구독 종료 후 접근 정책 · UC-07 · UC-13 · UC-15
- `/src/app/api/billing/**` — step 2 산출물
- `/src/app/dashboard/page.tsx` · `/src/components/app/**`
- `/src/components/app/Sidebar.tsx` · `/src/components/marketing/Pricing.tsx` · `/src/components/report/LockedTable.tsx` — **이미 `/upgrade`를 가리키는 세 진입점**

## 구현 범위

```
src/app/upgrade/page.tsx                    — 가격 · 잠긴 기능 4개 · 구독 시작 · 정책 문구
src/components/billing/CheckoutNotice.tsx   — ?checkout=1 안내 (대시보드에 얹는다)
src/app/dashboard/page.tsx                  — 수정: 안내 배너 배선
```

## 수정 대상 파일

```
src/app/upgrade/page.tsx                         (신규 — tdd-guard 면제)
src/app/upgrade/page.test.tsx                    (신규 — 먼저)
src/components/billing/CheckoutNotice.tsx        (신규)
src/components/billing/CheckoutNotice.test.tsx   (신규 — 먼저)
src/app/dashboard/page.tsx                       (수정)
```

## 먼저 작성할 테스트

### `/upgrade` — 구성 요소
1. 가격이 표시된다 (`₩9,900 / 월`, `.num`). **단, D-20이 미결이면 아래 「D-20 미결 시」를 따르라**
2. **잠긴 기능이 4개** 나열된다 (DESIGN.md §6: "잠긴 기능 4개"). PRD 표 기준으로: 거래별 분류 내역 · 판정 근거 · 전체 인사이트 · 세무사 전달용 다운로드
3. **"구독 시작하기"** CTA가 `POST /api/billing/checkout`으로 간다
4. **"결제·영수증·해지는 Polar 고객 포털에서 관리됩니다"** 문구가 있다
5. **"해지 후에도 데이터는 지우지 않습니다"** 문구가 있다(ADR-008)

### `/upgrade` — plan에 따른 분기
6. `plan === 'free'`면 "구독 시작하기"가 보인다
7. **`plan === 'pro'`면 checkout CTA가 안 보이고**, 대신 고객 포털 링크가 보인다 (이미 구독 중인 사람에게 결제 버튼을 보여주지 마라)
8. `plan`을 **서버에서 읽는다** — Server Component. `?plan=pro`를 붙여도 안 바뀐다
9. `plan === 'free'`면 **포털 링크가 안 보인다** — `polar_customer_id`가 없어 포털이 열리지 않는다(step 2의 계약)

### `/upgrade` — 해지 예약 상태 ← D-11
10. **`plan === 'pro'`인 사용자에게 "해지해도 결제한 기간 끝까지 이용할 수 있습니다"를 안내한다.** 해지 즉시 잠기지 않는다는 것이 D-11의 결정이고, 사용자가 해지 버튼을 누르기 전에 알아야 하는 사실이다

### `/upgrade` — 모달이 아니다
11. 실제 라우트 페이지다. `.fs-scrim`/`.fs-modal`을 쓰지 않는다
12. 앱 셸(`AppShell`) 안에 렌더된다 — 사이드바에서 온 사용자가 문맥을 잃지 않는다

### `CheckoutNotice` ← 안내지 기능이 아니다
13. `?checkout=1`이고 `plan === 'free'`면 **"결제 확인 중"** 안내가 보인다
14. **`?checkout=1`이고 `plan === 'pro'`면 안내가 안 보인다** — 이미 반영됐다
15. `?checkout=1`이 없으면 안 보인다
16. **`?checkout=1`이 어떤 기능도 열지 않는다.** 이 컴포넌트가 렌더하는 것이 문구와 새로고침 안내뿐임을 검사하라 — 거래 데이터·다운로드 링크·Pro 전용 UI가 없다
17. **폴링하지 않는다.** `setInterval`·`fetch` 호출 0회. "늦으면 새로고침이 답이다"(ADR-020)
18. 새로고침을 안내하는 문구가 있다

### 접근성·디자인
19. 아이콘 전용 버튼에 `aria-label`
20. 앱 레이어다 — **파스텔 color-block을 쓰지 않는다**(DESIGN.md §0)
21. raw hex·raw px·이모지 없음 · `--fs-*` 앱 토큰은 **써도 된다**(여기는 앱 레이어다)

### 라우트 ← 404 해소
22. `/upgrade` 하나만 추가된다. `/billing/*` 하위 라우트가 없다
23. **`src/app/upgrade/page.tsx`가 존재한다.** 이 step 전에는 404였다

## Codex 실행 지시문

### D-20 미결 시 — 가격 문구

`phases/PLAN.md` D-20(Polar의 KRW·월 9,900원 상품 지원 여부)이 **미결이면** 가격 숫자를
`/upgrade`에 **하드코딩하지 마라.** 랜딩(`src/components/marketing/Pricing.tsx`)이 이미
`₩9,900` 상수를 한 곳에 두고 있으므로 **그 상수를 import해서 쓴다.** 나중에 통화·금액이
바뀌면 고칠 곳이 하나로 유지된다.

D-20이 미결이라는 이유로 이 step을 `blocked` 처리하지 마라 — 화면은 만들 수 있고,
바뀌는 것은 숫자 하나다.

### 모달로 만들지 마라

DESIGN.md §6: *"프로토타입의 `AuthModal`·`PaywallModal`은 **모달로 만들지 마라.** 이유: 인증은 Google OAuth 리다이렉트고 결제는 `/upgrade` → Polar Checkout 리다이렉트다. 프로토타입은 단일 HTML이라 모달로 흉내 냈을 뿐이다."*

`report.jsx`의 `PaywallModal` **내용**을 가져오고 **형태**는 페이지로 만들어라.

### `?checkout=1`이 여는 것은 문구다

ADR-020:

> 대시보드는 `profiles.plan`을 **서버에서 읽어** 화면을 정하고, `checkout=1`은 아직 Free일 때 "결제 확인 중" 안내를 띄우는 데만 쓴다. **쿼리 파라미터가 여는 것은 안내 문구지 기능이 아니다.**

`?checkout=1`로 거래 표를 열거나 다운로드를 허용하는 코드를 **절대** 쓰지 마라. 그러면 URL 하나로 유료 기능이 열린다.

### 폴링하지 마라

ADR-020: *"**전용 성공 페이지와 상태 폴링 라우트는 두지 않는다** — 웹훅은 보통 수 초 안에 도착하고, 늦으면 새로고침이 답이다."*

`CheckoutNotice`에 `setInterval`을 넣고 싶어질 것이다. 넣지 마라. 문구로 "잠시 후 새로고침해 주세요"라고 말하면 된다.

### `pro`에게 결제 버튼을 보여주지 마라

이미 구독 중인 사용자가 `/upgrade`에 오면(사이드바 nav에 있으므로 온다) **구독 관리 화면**이 되어야 한다. 결제 버튼을 다시 보여주면 이중 결제를 시도한다.

step 2의 checkout 라우트가 `plan === 'pro'`를 막지만, **화면에서도 안 보이는 것이 맞다.**

### 해지 문구는 D-11을 반영한다

ADR-008 · `phases/PLAN.md` D-11: **`canceled`(해지 예약)는 잠그지 않는다. 결제한 기간 끝의 `revoked`가 잠근다.**

따라서 "해지하면 바로 무료로 전환됩니다" 같은 문구를 쓰지 마라 — **사실이 아니다.**
"해지해도 결제한 기간이 끝날 때까지 이용할 수 있습니다"가 맞다.

### 잠긴 기능 4개

PRD §구독 및 기능 게이트 표에서 유료만 있는 것 + 무료가 부분인 것:

| | 무료 | Pro |
|---|---|---|
| 인사이트 | 상위 3개 | **전체** |
| 거래별 분류 내역 | ✗ | **✓** |
| 판정 근거 | ✗ | **✓** |
| 세무사 전달용 다운로드 | ✗ | **✓** |

**"업로드·분석 무제한"을 Pro 혜택으로 쓰지 마라** — 무료도 무제한이다(ADR-007). 그건 오해를 만든다.

### 정책 문구 두 개

DESIGN.md §6이 명시한다:

> "구독 시작하기"(Polar Checkout으로 나감) · **"결제·영수증·해지는 Polar 고객 포털에서 관리됩니다. 해지 후에도 데이터는 지우지 않습니다."**

둘 다 넣어라. 두 번째는 ADR-008의 약속을 사용자에게 말하는 것이고, 결제 결정에 영향을 준다.

### 앱 레이어다

`/upgrade`는 DESIGN.md §0의 **앱** 레이어다 — 무채색 + 딥블루. `--fs-*` 토큰을 쓰고 파스텔 color-block을 쓰지 마라.

랜딩의 `PricingCard`(마케팅 컴포넌트)를 여기서 재사용하지 마라 — 레이어가 다르다. (가격 **상수**를 import하는 것은 재사용이 아니라 단일 출처 유지다 — 위 「D-20 미결 시」 참고.)

### 새 라우트를 만들지 마라

`/upgrade` 하나다. `/billing/success`·`/billing/manage` 같은 것을 만들지 마라.

## 완료 조건

- `/upgrade` + `CheckoutNotice` + 테스트가 존재하고 23개 항목이 전부 통과한다
- **`/upgrade`가 더 이상 404가 아니다** — 진입점 3곳이 전부 도달한다
- 모달이 아니라 페이지다
- `pro`에게 결제 CTA가 안 보인다
- 해지 문구가 D-11(기간 끝까지 이용)을 반영한다
- `?checkout=1`이 문구만 열고 기능을 열지 않는다
- 폴링이 없다
- 정책 문구 2개가 있다
- 앱 레이어 표현이다 (파스텔 없음)
- 새 라우트가 `/upgrade` 하나뿐이다
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/app/upgrade src/components/billing
```

직접 확인:

```bash
ls src/app/upgrade/page.tsx || echo "FAIL: /upgrade 가 여전히 404"
grep -nE "setInterval|setTimeout|fetch\(" src/components/billing/CheckoutNotice.tsx && echo "FAIL: 폴링" || echo "OK"
grep -nE "checkout=1|searchParams" src/app/dashboard/page.tsx
# → checkout=1 이 안내 문구 외의 분기를 만들지 않는지 눈으로 확인
grep -n "color-block" src/app/upgrade/page.tsx && echo "FAIL: 앱에 파스텔" || echo "OK"
grep -nE "fs-modal|fs-scrim" src/app/upgrade/page.tsx && echo "FAIL: 모달" || echo "OK"
ls src/app/billing 2>/dev/null && echo "FAIL: 새 라우트" || echo "OK"
```

빌드 산출물에서 라우트가 실제로 잡히는지:

```bash
npm run build 2>&1 | grep -E "/upgrade" || echo "FAIL: 라우트 미등록"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - DESIGN.md §6 — 모달이 아니라 페이지인가? 정책 문구 2개가 있는가? 라우트가 5개 고정을 지키는가?
   - DESIGN.md §0 — 앱 레이어 표현인가? (파스텔 없음, `--fs-*` 사용)
   - ADR-020 — `?checkout=1`이 문구만 여는가? 폴링·성공 페이지가 없는가?
   - ADR-008 / D-11 — "해지 후에도 데이터를 지우지 않습니다"가 있는가? 해지가 **즉시** 잠그는 것처럼 쓰지 않았는가?
   - ADR-007 — 무료도 무제한임을 오해하게 쓰지 않았는가?
   - AGENTS.md CRITICAL — `plan`을 서버에서 읽는가?
3. 결과에 따라 `phases/5-billing/index.json`의 step 4를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "app/upgrade/page.tsx(앱 레이어 페이지, 모달 아님) — 가격·잠긴 기능 4개·구독 시작하기→/api/billing/checkout, pro면 CTA 숨기고 포털 링크+기간말 안내, 정책 문구 2개. components/billing/CheckoutNotice.tsx는 ?checkout=1 && free 일 때만 '결제 확인 중' 문구(폴링 없음, 기능 안 열림). /upgrade 404 해소 — 진입점 3곳 도달")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단

**이 step이 끝나면 Phase 5와 전체 계획이 완료된다.** `summary`에 「Phase 5 검토 지점: Polar 샌드박스 결제 → 웹훅 → `profiles.plan` 전이 수동 검증 필요 (`phases/PLAN.md` §Phase 5 완료 기준 F)」를 덧붙여라.

## commit 기준

`feat(5-billing): step 4 — upgrade-page`

포함: `src/app/upgrade/page.{tsx,test.tsx}` · `src/components/billing/**` · `src/app/dashboard/page.tsx`

## 금지사항

- **`?checkout=1`로 어떤 기능도 열지 마라.** 이유: URL 하나로 유료 기능이 열린다. 쿼리 파라미터가 여는 것은 안내 문구뿐이다(ADR-020).
- **결제 상태를 폴링하지 마라.** 이유: 웹훅은 보통 수 초 안에 도착하고 늦으면 새로고침이 답이다. 전용 폴링 라우트도 만들지 않기로 했다(ADR-020).
- **"해지하면 즉시 무료로 전환된다"고 쓰지 마라.** 이유: 사실이 아니다. `canceled`는 잠그지 않고 기간 말의 `revoked`가 잠근다(D-11).
- **`/billing/success` 같은 새 라우트를 만들지 마라.** 이유: 화면은 5개 고정이다.
- **`/upgrade`를 모달로 만들지 마라.** 이유: 결제는 리다이렉트 흐름이다. 프로토타입이 모달인 것은 단일 HTML의 한계였을 뿐이다.
- **`pro` 사용자에게 결제 CTA를 보여주지 마라.** 이유: 이중 결제를 시도한다.
- **"업로드·분석 무제한"을 Pro 혜택으로 쓰지 마라.** 이유: 무료도 무제한이다. 오해를 만든다(ADR-007).
- **"해지 후에도 데이터는 지우지 않습니다"를 빼지 마라.** 이유: ADR-008의 약속이고 결제 결정에 영향을 준다.
- **가격 숫자를 이 파일에 새로 하드코딩하지 마라.** 이유: D-20이 미결이라 통화·금액이 바뀔 수 있다. 기존 상수를 import하라.
- **앱 화면에 파스텔 color-block을 쓰지 마라.**
- **마케팅 `PricingCard`를 여기서 재사용하지 마라.** 이유: 레이어가 다르다.
- **`plan`을 클라이언트에서 읽거나 요청에서 받지 마라.**
- **결제수단·영수증·취소 UI를 만들지 마라.** 이유: Polar Customer Portal에 위임했다.
- **raw hex·raw px·이모지를 쓰지 마라.**
- 기존 테스트를 깨뜨리지 마라.
