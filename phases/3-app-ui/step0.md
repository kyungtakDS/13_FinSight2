# Step 0: app-shell

## 목적

앱 레이어의 셸을 만든다 — 사이드바 · 톱바 · 콘텐츠 영역.

앱 레이어는 **무채색 + 딥블루 포인트 1가지**다. 마케팅 레이어의 파스텔 color-block을 여기 쓰지 않는다. 사용자에게 카드 명세서를 요구하는 화면이고 **화면의 신뢰도가 곧 전환율이다**(PRD).

## 이전 Step과의 의존성

Phase 0·1·2 전체가 `completed`여야 한다. 직접 쓰는 것:

- **Phase 0 step 1 (`design-tokens`)** — `src/styles/theme.css`의 `.fs-app`·`.fs-side`·`.fs-navitem`·`.fs-topbar`·`.fs-content` 유틸 클래스, `ThemeToggle`
- **Phase 0 step 5 (`auth-flow`)** — `SignOutButton`, `src/app/dashboard/page.tsx`(자리표시 — 이 step이 셸로 감싼다)

## 읽어야 할 파일

- `/docs/DESIGN.md` — **전문**. 특히 §0(두 레이어) · §2(앱 레이어 토큰·타입 스케일) · §5(앱 컴포넌트) · §6(사이드바 nav는 `/dashboard`와 `/upgrade`만) · §9(접근성) · §10(금지사항)
- `/src/styles/theme.css` — `.fs-app` `.fs-side` `.fs-navitem` `.fs-topbar` `.fs-content` 스펙. **이 클래스들이 스펙이다**
- `/design/prototype/app.jsx` — 시각 참조 (구현 참조가 아니다)
- `/design/prototype/icons.js` — 아이콘 스타일 기준 (1.5–2px stroke)
- `/docs/ARCHITECTURE.md` — 화면 5개 고정
- `/src/app/dashboard/page.tsx` · `/src/components/ThemeToggle.tsx` · `/src/components/auth/SignOutButton.tsx`

## 구현 범위

```
src/components/app/AppShell.tsx    — 셸 컨테이너
src/components/app/Sidebar.tsx     — nav 2개 + 브랜드
src/components/app/Topbar.tsx      — 제목 + ThemeToggle + SignOutButton
src/app/dashboard/layout.tsx       — 셸을 대시보드 하위 라우트에 적용
```

**데이터를 페칭하지 않는다.** 셸은 순수 레이아웃이다.

## 수정 대상 파일

```
src/components/app/AppShell.tsx        (신규)
src/components/app/AppShell.test.tsx   (신규 — 먼저)
src/components/app/Sidebar.tsx         (신규)
src/components/app/Sidebar.test.tsx    (신규 — 먼저)
src/components/app/Topbar.tsx          (신규)
src/components/app/Topbar.test.tsx     (신규 — 먼저)
src/app/dashboard/layout.tsx           (신규 — tdd-guard 면제)
```

## 먼저 작성할 테스트

`@testing-library/react`로 렌더한다. Next의 `usePathname`은 `vi.mock('next/navigation')`으로 갈아끼운다.

### `Sidebar` ← 라우트 규율
1. nav 항목이 **정확히 2개**다: `/dashboard`(업로드/기록) · `/upgrade`
2. **`설정` 항목이 없다** — 대응 라우트가 없다(DESIGN.md §6). 문자열로 검사하라
3. 현재 경로와 일치하는 항목에 활성 표시가 붙는다 (`aria-current="page"`)
4. 브랜드가 워드마크 `FinSight` + 도트다. **이미지·로고 마크가 없다**(DESIGN.md §10-7)
5. 880px 이하에서 숨겨진다 — 클래스나 미디어 쿼리 대상 요소가 존재함을 검사 (jsdom은 실제 CSS를 적용하지 않으므로 `.fs-side` 클래스 부착 여부로 확인)

### `Topbar`
6. 제목이 props로 온다
7. `ThemeToggle`이 렌더된다
8. `SignOutButton`이 렌더된다
9. **아이콘 전용 버튼에 전부 `aria-label`이 있다** — 렌더 결과에서 아이콘 버튼을 전부 찾아 검사하라(DESIGN.md §9)

### `AppShell`
10. `children`을 `.fs-content` 안에 렌더한다
11. `Sidebar`와 `Topbar`를 포함한다
12. landmark 역할이 있다 (`<nav>`·`<main>`)

### 디자인 규율 ← 전 컴포넌트 공통
13. **소스에 raw hex가 없다** — 세 파일을 읽어 `/#[0-9a-fA-F]{3,8}\b/` 부재를 검사하라(DESIGN.md §10-1)
14. **소스에 raw px가 없다** — `/\b\d+px\b/` 부재
15. **font-weight가 토큰 집합(320·330·340·450·480·540·700) 밖이 아니다**
16. **이모지가 없다**(DESIGN.md §10-4)
17. **파스텔 color-block 토큰(`--color-block-*`)을 쓰지 않는다** — 앱 레이어다(DESIGN.md §0)

13~17은 세 컴포넌트 파일 전부에 대해 도는 **공통 테스트 하나**로 만들어도 된다. 이후 Phase 3·4 step들이 같은 검사를 재사용할 수 있게 파일 목록만 바꾸면 되는 형태로 써라.

## Codex 실행 지시문

### `theme.css`의 유틸 클래스가 스펙이다

DESIGN.md §5: *"`design/theme.css`의 유틸 클래스가 스펙이다: `.fs-app` `.fs-side` `.fs-navitem` `.fs-topbar` `.fs-content` …"*

**새 CSS를 쓰지 마라.** `src/styles/theme.css`를 읽고 이미 있는 클래스를 붙여라. 값이 필요하면 `var(--토큰)`으로만.

치수 참고(DESIGN.md §2): 사이드바 248px · 톱바 64px · 본문 패딩 40/48px(모바일 28/20) · 콘텐츠 max 1080px. **이 숫자를 컴포넌트에 직접 쓰지 마라** — `theme.css`에 이미 토큰이나 클래스로 있다. 없으면 `theme.css`에 토큰을 먼저 추가하고 그것을 가리켜라.

### nav는 2개다

DESIGN.md §6: *"사이드바 nav는 `/dashboard`와 `/upgrade`만 가리킨다. 프로토타입의 **`설정` 항목을 만들지 마라** — 대응 라우트가 없다."*

프로토타입(`design/prototype/app.jsx`)에 설정 항목이 보일 것이다. 무시하라.

### 브랜드

DESIGN.md §10-7: *"로고 마크가 없다. 브랜드는 워드마크 `FinSight` + `--fs-accent` 도트로 렌더한다. **마크를 지어내지 마라.**"*

SVG 로고를 그리지 마라. 텍스트 + 원형 도트 하나다.

### 다크 모드 분기를 넣지 마라

`theme.css`가 `<html data-theme="dark">`에서 토큰을 재정의한다. 컴포넌트는 토큰만 참조하면 자동으로 따라온다(DESIGN.md §3).

### 데이터를 읽지 마라

셸은 레이아웃이다. `getUser()`·`getProfilePlan()`을 여기서 부르지 마라 — 페이지가 읽어 props로 준다. **차트·리포트뿐 아니라 셸도 같은 규칙을 따르는 편이 일관된다.**

예외: `dashboard/layout.tsx`는 Server Component이므로 사용자 이메일 정도는 읽어 `Topbar`에 넘겨도 된다. 그 경우에도 **컴포넌트는 props로 받는다.**

### 접근성

- 아이콘 전용 버튼 전부에 `aria-label` (§9)
- 활성 nav에 `aria-current="page"`
- `<nav>`·`<main>` landmark
- 포커스는 **링**으로 보인다. `outline: none`만 주고 대체 표시를 안 하는 코드를 쓰지 마라

## 완료 조건

- 세 컴포넌트 + `dashboard/layout.tsx`가 존재하고 17개 테스트가 전부 통과한다
- nav가 정확히 2개이고 `설정`이 없다
- raw hex·raw px·이모지·`--color-block-*`이 소스에 없다
- 아이콘 전용 버튼에 전부 `aria-label`이 있다
- 컴포넌트가 데이터를 페칭하지 않는다
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/components/app
```

직접 확인:

```bash
grep -nE "#[0-9a-fA-F]{3,8}\b" src/components/app/*.tsx && echo "FAIL: raw hex" || echo "OK"
grep -nE "\b[0-9]+px\b" src/components/app/*.tsx && echo "FAIL: raw px" || echo "OK"
grep -n "color-block" src/components/app/*.tsx && echo "FAIL: 앱에 파스텔" || echo "OK"
grep -n "설정" src/components/app/Sidebar.tsx && echo "FAIL: 대응 라우트 없는 nav" || echo "OK"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md — 컴포넌트가 `src/components/`에 있는가? 새 라우트를 만들지 않았는가?
   - DESIGN.md — raw hex·raw px 없음, 토큰 weight 집합만, 앱에 파스텔 없음, 이모지 없음, 로고 마크 없음, nav 2개
   - DESIGN.md §9 — 아이콘 버튼 `aria-label`, `aria-current`, landmark
   - 컴포넌트가 데이터를 props로만 받는가?
3. 결과에 따라 `phases/3-app-ui/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "components/app/{AppShell,Sidebar,Topbar}.tsx + dashboard/layout.tsx. theme.css 유틸 클래스만 사용, nav는 /dashboard·/upgrade 2개(설정 없음), 워드마크+도트 브랜드, 데이터 페칭 없음. 디자인 규율 공통 테스트(raw hex/px·weight·이모지·color-block 부재)를 만들어 이후 UI step이 파일 목록만 바꿔 재사용 가능")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단
4. `summary`에 **디자인 규율 공통 테스트의 파일 경로**를 남겨라 — 이후 UI step들이 재사용한다.

## commit 기준

`feat(3-app-ui): step 0 — app-shell`

포함: `src/components/app/**` · `src/app/dashboard/layout.tsx`

## 금지사항

- **앱 화면에 파스텔 color-block을 쓰지 마라.** 이유: 사용자에게 카드 명세서를 요구하는 화면이며 "신뢰형 미니멀"이 곧 전환율이다. 파스텔은 랜딩에서 이야기를 나르는 장치지 대시보드의 장식이 아니다(DESIGN.md §0).
- **raw hex·raw px를 쓰지 마라.** 값은 `var(--토큰)`으로만. 새 값이 필요하면 `theme.css`에 토큰을 먼저 추가한다.
- **토큰 집합 밖의 font-weight를 쓰지 마라** (320·330·340·450·480·540·700).
- **`설정` nav 항목을 만들지 마라.** 이유: 대응 라우트가 없다. 라우트는 5개로 고정이다.
- **로고 마크를 지어내지 마라.** 이유: 브랜드 자산이 없다. 워드마크 + 도트다.
- **컴포넌트에 다크 모드 분기를 넣지 마라.** 이유: 토큰 재정의만으로 처리되도록 만들어져 있다.
- **카드에 그림자를, CTA를 각지게, 배경에 그라디언트를 쓰지 마라.**
- **이모지를 쓰지 마라.**
- **`design/prototype/ds-bundle.js`를 import하지 마라.**
- **셸에서 데이터를 페칭하지 마라.** 이유: 페칭은 페이지가 한다(ARCHITECTURE.md §패턴).
- **새 라우트를 만들지 마라** — 5개 고정이다.
- 기존 테스트를 깨뜨리지 마라.
