# Step 1: design-tokens

## 목적

`design/`의 디자인 토큰을 `src/styles/`로 옮기고, Tailwind가 그 토큰을 **가리키기만** 하도록 배선한다.
폰트를 `next/font`로 로드하고, 라이트/다크 테마 토글을 만든다.

이 step이 끝나면 이후 모든 UI step은 **색·간격·타입을 직접 정하지 않고** `var(--토큰)` 또는 매핑된 Tailwind 유틸리티만 쓰면 된다.

## 이전 Step과의 의존성

- **step 0 (`project-setup`)** — `package.json`·`tsconfig`·`postcss.config.mjs`·`src/app/globals.css`·`src/app/layout.tsx`가 이미 있어야 한다. Tailwind v4가 PostCSS 플러그인으로 배선되어 있고 `globals.css`에는 `@import "tailwindcss";` 한 줄만 있는 상태를 전제한다.

## 읽어야 할 파일

- `/docs/DESIGN.md` — **전문**. 특히 §1(자산 위치와 소비 방법) · §2(토큰) · §3(다크 모드) · §10(금지사항)
- `/design/styles.css` — 진입점. 어떤 파일이 어떤 순서로 import되는지
- `/design/tokens/colors.css` · `typography.css` · `spacing.css` · `radius.css` · `elevation.css`
- `/design/tokens/fonts.css` — **복사하지 않을 파일.** 무엇이 들어 있는지만 확인한다
- `/design/theme.css` — 앱 레이어 토큰(`--fs-*`) · 다크 오버라이드 · 유틸 클래스. 이후 모든 앱 컴포넌트의 스펙이다
- `/design/ds-readme.md` — 출처·폰트 대체·로고 부재 고지
- `/src/app/globals.css` · `/src/app/layout.tsx` — step 0이 만든 것
- `/phases/PLAN.md` — D-2(Tailwind v4)

## 구현 범위

1. 토큰 CSS 5개 + `theme.css`를 `design/` → `src/styles/`로 **복사**
2. `globals.css`에서 `@import` + `@theme inline` 매핑
3. `next/font/google`로 Inter · Noto Sans KR · JetBrains Mono 로드 → `--font-sans`/`--font-mono` 바인딩
4. FOUC 없는 테마 초기화 스크립트 (`<html data-theme>`)
5. `ThemeToggle` 컴포넌트

## 수정 대상 파일

```
src/styles/tokens/colors.css        (신규 — design/tokens/colors.css 복사)
src/styles/tokens/typography.css    (신규 — 복사)
src/styles/tokens/spacing.css       (신규 — 복사)
src/styles/tokens/radius.css        (신규 — 복사)
src/styles/tokens/elevation.css     (신규 — 복사)
src/styles/theme.css                (신규 — design/theme.css 복사)
src/app/globals.css                 (수정 — @import + @theme inline)
src/app/layout.tsx                  (수정 — next/font + 테마 초기화 스크립트 + data-theme)
src/components/ThemeToggle.tsx      (신규)
src/components/ThemeToggle.test.tsx (신규 — 먼저)
```

`design/` 아래 파일은 **읽기만 한다. 수정하지 마라.** 소스 오브 트루스다.

## 먼저 작성할 테스트

`src/components/ThemeToggle.test.tsx` — `@testing-library/react`로 렌더한다.

1. 아이콘 전용 버튼에 `aria-label`이 있다 (DESIGN.md §9)
2. `localStorage`가 비어 있을 때 초기 상태가 시스템 설정(`prefers-color-scheme`)을 따른다
3. 클릭하면 `document.documentElement.getAttribute('data-theme')`이 `light` ↔ `dark`로 바뀐다
4. 클릭하면 `localStorage`에 테마 값이 저장된다
5. 마운트 시 `localStorage`에 저장된 값이 있으면 그것이 시스템 설정을 이긴다

`jsdom`에는 `window.matchMedia`가 없다. 테스트에서 `vi.stubGlobal`로 mock하라 — 컴포넌트에 테스트용 분기를 넣지 마라.

## Codex 실행 지시문

### 1. 토큰 복사

`design/tokens/{colors,typography,spacing,radius,elevation}.css`와 `design/theme.css`를 `src/styles/`로 **내용 변경 없이** 복사한다. 값을 조정하거나 정리하지 마라.

**`design/tokens/fonts.css`는 복사하지 마라.** 이유: Google Fonts `@import`는 렌더 블로킹이고 Next의 폰트 최적화를 우회한다(DESIGN.md §1).

`design/styles.css`도 복사하지 않는다 — `globals.css`가 그 역할을 대신한다.

### 2. `globals.css`

```css
@import "tailwindcss";
@import "../styles/tokens/colors.css";
@import "../styles/tokens/typography.css";
@import "../styles/tokens/spacing.css";
@import "../styles/tokens/radius.css";
@import "../styles/tokens/elevation.css";
@import "../styles/theme.css";      /* 마지막 — 앱 토큰과 다크 오버라이드가 여기 있다 */

@theme inline {
  /* 토큰 → 유틸리티. 값을 다시 적지 마라. var() 로만 가리킨다. */
  --color-canvas: var(--color-canvas);
  --color-ink: var(--color-ink);
  --color-hairline: var(--color-hairline);
  --color-accent: var(--fs-accent);
  --radius-pill: var(--radius-pill);
  /* … DESIGN.md §2 에 있는 토큰 중 유틸리티로 쓸 것들 */
}
```

`@theme inline`에 **리터럴 값을 적지 마라.** 값은 CSS 커스텀 프로퍼티에만 존재하고 Tailwind는 그것을 가리키기만 한다(DESIGN.md §1).

어떤 토큰을 유틸리티로 노출할지는 재량이지만, 최소한 색(마케팅 코어 + `--fs-*`) · radius · spacing은 매핑한다.

### 3. `next/font` (layout.tsx)

```ts
// Inter 에는 한글 글리프가 없다. 라틴=Inter, 한글=Noto Sans KR 로 글리프 단위 폴백시킨다.
const sans = Inter({ subsets: ['latin'], variable: '--font-inter' });
const kr   = Noto_Sans_KR({ subsets: ['latin'], variable: '--font-kr' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });
// CSS 어딘가에서: --font-sans: var(--font-inter), var(--font-kr), system-ui, sans-serif;
//                --font-mono: var(--font-jetbrains), ui-monospace, monospace;
```

`Noto_Sans_KR`에 `subsets: ['korean']`을 쓰지 마라 — Next의 서브셋 목록에 없어 빌드가 깨진다. `latin` 서브셋으로 로드하고 글리프 폴백에 맡긴다(DESIGN.md §1의 주석 그대로).

세 variable 클래스를 `<html>`에 붙인다.

### 4. 테마 초기화

`<html data-theme="…">`가 `theme.css`의 다크 오버라이드를 켠다(DESIGN.md §3).

`layout.tsx`에 **동기 인라인 스크립트**를 넣어 첫 페인트 전에 `localStorage` 값을 읽고 `data-theme`과 `color-scheme`을 설정한다. React state로만 처리하면 하이드레이션 전에 라이트로 한 번 깜빡인다(FOUC).

스크립트는 짧게 유지한다: `localStorage` 읽기 → 없으면 `matchMedia('(prefers-color-scheme: dark)')` → `documentElement.dataset.theme` 설정 → `documentElement.style.colorScheme` 설정.

### 5. `ThemeToggle.tsx`

Client Component. props 없음. `aria-label` 필수.

- 상태를 `<html data-theme>`와 `localStorage` 양쪽에 반영한다
- 아이콘은 인라인 SVG(1.5–2px stroke). **이모지를 쓰지 마라**(DESIGN.md §10-4)
- 이 컴포넌트는 마케팅 nav와 앱 톱바 **양쪽**에서 쓰인다. 어느 레이어 전용 토큰(`--fs-*`)도 쓰지 마라 — 무채색 크롬으로만 만든다

## 완료 조건

- `src/styles/`에 토큰 5개 + `theme.css`가 있고 `design/` 원본과 내용이 같다
- `src/styles/tokens/fonts.css`가 **없다**
- `globals.css`가 위 순서로 import하고 `@theme inline`에 리터럴 값이 없다
- `<html>`에 `lang="ko"` · 폰트 variable 클래스 · `data-theme`이 붙는다
- `ThemeToggle` 테스트 5개가 통과한다
- `npm run build`가 통과한다 (폰트 다운로드가 필요하므로 네트워크가 있어야 한다)

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/components/ThemeToggle.test.tsx
```

토큰 복사 확인:

```bash
node -e "for (const f of ['colors','typography','spacing','radius','elevation']) { const a=require('fs').readFileSync('design/tokens/'+f+'.css','utf8'), b=require('fs').readFileSync('src/styles/tokens/'+f+'.css','utf8'); console.log(f, a===b ? 'OK' : 'DIFF'); }"
node -e "console.log(require('fs').existsSync('src/styles/tokens/fonts.css') ? 'FAIL: fonts.css 복사됨' : 'OK')"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md의 `src/styles/`(design/에서 복사한 토큰·theme. globals.css가 @import) 구조를 따르는가?
   - DESIGN.md를 따르는가? — **raw hex·raw px 없음**, `@theme inline`에 값 재작성 없음, `ds-bundle.js` import 없음, 이모지 없음
   - `design/` 원본을 수정하지 않았는가?
   - AGENTS.md CRITICAL 위반이 없는가?
3. 결과에 따라 `phases/0-foundation/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "design/ 토큰 5개+theme.css를 src/styles/로 복사, globals.css에서 @import+@theme inline 매핑. next/font로 Inter+NotoSansKR+JetBrainsMono. ThemeToggle 컴포넌트 + data-theme/localStorage 배선")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단

## commit 기준

`feat(0-foundation): step 1 — design-tokens`

포함: `src/styles/**` · `src/app/globals.css` · `src/app/layout.tsx` · `src/components/ThemeToggle.{tsx,test.tsx}`
제외: `design/**` (변경이 있으면 안 된다)

## 금지사항

- **`design/` 아래 파일을 수정하지 마라.** 이유: 소스 오브 트루스이고, 여기가 바뀌면 복사본과의 대조가 무의미해진다.
- **`design/tokens/fonts.css`를 복사하지 마라.** 이유: Google Fonts `@import`는 렌더 블로킹이고 Next 폰트 최적화를 우회한다.
- **`design/prototype/ds-bundle.js`를 import하지 마라.** 이유: `window` 전역 + Babel standalone에 의존하는 브라우저 UMD 번들이라 Next 빌드에서 깨진다.
- **`@theme inline`이나 컴포넌트에 raw hex·raw px를 쓰지 마라.** 값은 `var(--토큰)`으로만. 새 값이 필요하면 토큰을 먼저 추가한다(DESIGN.md §10-1).
- **컴포넌트에 다크 모드 분기를 넣지 마라.** 이유: `theme.css`가 토큰 재정의만으로 다크를 처리하도록 만들어져 있다. 컴포넌트가 분기하기 시작하면 두 벌이 갈라진다(DESIGN.md §3).
- **이모지를 쓰지 마라.** 아이콘은 `design/prototype/icons.js` 수준의 절제된 라인 세트로.
- **이 step에서 다른 컴포넌트를 만들지 마라** — `Button`·`ColorBlock`·앱 셸은 전부 Phase 3·4 소관이다.
- 기존 테스트를 깨뜨리지 마라.
