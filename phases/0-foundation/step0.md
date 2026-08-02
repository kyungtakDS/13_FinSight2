# Step 0: project-setup

## 목적

빈 레포에 Next.js(App Router) · TypeScript strict · Tailwind v4 · Vitest · ESLint 를 세우고,
**`npm run lint` → `npm run build` → `npm run test` 세 명령이 전부 통과하는 상태**를 만든다.

이 step이 하는 일의 전부가 그것이다. 기능 코드는 한 줄도 쓰지 않는다.

> 이 step이 깨지면 이후 **모든 step이 연쇄 실패한다.** Stop 훅(`scripts/hooks/stop-check.mjs`)이
> 매 세션 종료마다 저 세 명령을 돌리기 때문이다. 다른 무엇보다 이 세 명령이 통과하는 것이 우선이다.

## 이전 Step과의 의존성

없다. 이 Phase의 첫 step이고 레포에는 아직 `package.json`이 없다.

## 읽어야 할 파일

- `/AGENTS.md` — 특히 「아키텍처 규칙」의 CRITICAL 항목과 「하네스」·「훅」 절
- `/docs/ARCHITECTURE.md` — §디렉토리 구조 (`src/` 하위 배치를 여기서 확정한다)
- `/docs/ADR.md` — ADR-018(mock-first), ADR-022(모델)
- `/scripts/hooks/stop-check.mjs` — 세션 끝에 실제로 무엇이 돌아가는지
- `/scripts/hooks/tdd-guard.mjs` — 어떤 파일이 테스트 없이 써지는지(면제 규칙)
- `/phases/PLAN.md` — 특히 「이 계획이 전제하는 기술 결정」 D-1 · D-2 · D-3

## 구현 범위

1. `package.json` — 의존성과 npm 스크립트 3개
2. TypeScript strict 설정
3. Tailwind v4 배선 (PostCSS 플러그인 방식)
4. ESLint 9 flat config
5. Vitest 설정 + 테스트가 실제로 도는 것을 증명하는 최소 테스트 1개
6. 최소 App Router 골격 (`layout.tsx` · `page.tsx` · `globals.css`)
7. `.env.example` — 이후 step들이 쓸 환경변수 이름 목록

**이 범위 밖의 것은 만들지 않는다.** Supabase 클라이언트·Claude 래퍼·컴포넌트·라우트는 전부 이후 step이다.

## 수정 대상 파일

```
package.json                     (신규)
tsconfig.json                    (신규)
next.config.ts                   (신규)
postcss.config.mjs               (신규)
eslint.config.mjs                (신규)
vitest.config.ts                 (신규)
vitest.setup.ts                  (신규)
src/app/layout.tsx               (신규)
src/app/page.tsx                 (신규)
src/app/globals.css              (신규)
src/lib/smoke.test.ts            (신규 — 아래 「먼저 작성할 테스트」)
.env.example                     (신규)
.gitignore                       (수정 — node_modules · .next · coverage 추가)
```

### 의존성

`dependencies`

```
next  react  react-dom
@anthropic-ai/sdk
@supabase/supabase-js  @supabase/ssr
@polar-sh/sdk  @polar-sh/nextjs
papaparse  iconv-lite  zod
```

`devDependencies`

```
typescript  @types/node  @types/react  @types/react-dom  @types/papaparse
tailwindcss  @tailwindcss/postcss
eslint  eslint-config-next  @eslint/eslintrc
vitest  @vitejs/plugin-react  jsdom
@testing-library/react  @testing-library/jest-dom  @testing-library/user-event
```

버전은 설치 시점의 최신 안정판을 쓴다. Polar·Supabase·Anthropic SDK는 **이 step에서 import하지 않는다** — 설치만 해두고 실제 사용은 각 담당 step이 한다.

### npm 스크립트 (이름을 바꾸지 마라)

```json
{
  "dev": "next dev",
  "build": "next build",
  "lint": "eslint .",
  "test": "vitest run"
}
```

- `lint`를 `next lint`로 쓰지 마라. **이유**: Next 15에서 제거 예정이고 이미 경고를 낸다. flat config + `eslint .`이 안전하다.
- `test`를 `vitest`(watch)로 쓰지 마라. **이유**: Stop 훅이 이 명령을 동기 실행하므로 watch 모드면 훅이 900초 타임아웃까지 매달린다.

## 먼저 작성할 테스트

`src/lib/smoke.test.ts` — 툴체인 자체를 검증하는 최소 테스트.

이건 형식적인 테스트가 아니다. **Vitest는 테스트 파일을 하나도 못 찾으면 exit code 1로 죽는다.** 이 파일이 없으면 `npm run test`가 실패하고 Stop 훅이 모든 step을 실패시킨다.

검증할 것:
- 산술 assertion 1개 (러너가 돈다)
- TypeScript 타입 주석이 있는 코드가 변환 없이 돈다
- `jsdom` 환경이 켜져 있다 (`typeof document !== 'undefined'`)
- Node 전역이 살아 있다 (`typeof TextDecoder === 'function'`) — 이후 CSV step이 이걸 전제한다

## Codex 실행 지시문

`npx create-next-app`을 **쓰지 마라.** 이유: 대화형 프롬프트가 있고 이 하네스는 비대화형으로 돈다. 위 파일들을 직접 쓰고 `npm install`로 의존성을 넣어라.

### `tsconfig.json`

`"strict": true` 필수. `paths`에 `"@/*": ["./src/*"]` 매핑을 넣고 `vitest.config.ts`의 `resolve.alias`에도 **같은 매핑을 넣어라** — 한쪽만 넣으면 테스트에서 `@/` import가 깨진다.

### `vitest.config.ts`

```ts
// 시그니처 수준 스펙 — 구현은 재량
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',          // 단일 환경. environmentMatchGlobs 를 쓰지 마라(Vitest 3에서 deprecated)
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'supabase/**/*.test.ts'],
  },
  resolve: { alias: { '@': /* <root>/src */ } },
});
```

`include`에 `supabase/**/*.test.ts`를 **반드시 넣어라.** 이유: Phase 0 step3이 마이그레이션 SQL을 텍스트로 읽어 검사하는 테스트를 거기에 둔다. 지금 안 넣으면 그 step에서 테스트가 조용히 무시된다.

`vitest.setup.ts`는 `@testing-library/jest-dom/vitest`를 import하는 것 하나면 된다.

### Tailwind v4 배선

`postcss.config.mjs`에 `@tailwindcss/postcss` 플러그인 하나. **`tailwind.config.ts`를 만들지 마라** — v4는 CSS에서 설정한다(DESIGN.md §1).

`src/app/globals.css`는 이 step에서는 `@import "tailwindcss";` 한 줄이면 된다. 토큰 import와 `@theme inline` 매핑은 step 1이 붙인다.

### `src/app/layout.tsx` · `page.tsx`

빌드가 통과할 최소 골격. `<html lang="ko">` · `globals.css` import · 자리표시 텍스트. 폰트 설정(`next/font`)과 테마 스크립트는 step 1이 붙인다.

### `.env.example`

값 없이 **이름만** 나열한다. 실제 `.env`를 만들거나 값을 채우지 마라 — 그건 사람이 한다.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
POLAR_ACCESS_TOKEN=
POLAR_PRODUCT_ID=
POLAR_WEBHOOK_SECRET=
NEXT_PUBLIC_SITE_URL=
```

## 완료 조건

- `npm run lint` · `npm run build` · `npm run test` 가 **셋 다 exit 0**
- `npm run build`가 경고 없이 `/` 라우트 하나를 프리렌더한다
- `npm run test`가 `src/lib/smoke.test.ts` 1개 파일 / 4개 assertion을 통과했다고 보고한다
- `tsconfig.json`에 `"strict": true`가 있다
- `tailwind.config.ts`가 존재하지 **않는다**
- `.env`가 커밋에 들어가지 않는다 (`.gitignore` 확인)

## 검증 명령

```bash
npm install
npm run lint && npm run build && npm run test
```

추가 확인:

```bash
node -e "const p=require('./package.json');console.log(p.scripts)"   # lint/build/test 이름 확인
git status --porcelain                                                # .env · node_modules 가 안 잡히는지
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - `src/` 하위 구조가 ARCHITECTURE.md §디렉토리 구조와 어긋나지 않는가?
   - ADR 기술 스택(Next.js App Router · TS strict · Tailwind · Supabase · Claude · Polar)을 벗어난 라이브러리를 넣지 않았는가?
   - 모듈 최상단에서 `process.env`를 읽고 throw하는 코드가 없는가? (AGENTS.md CRITICAL)
   - 테스트가 외부 API 키를 요구하지 않는가?
3. 결과에 따라 `phases/0-foundation/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"`에 산출물 한 줄 (예: "Next.js+TS strict+Tailwind v4+Vitest 스캐폴딩. scripts: dev/build/lint/test. vitest include에 supabase/**/*.test.ts 포함. @/* → src/* alias")
   - 3회 수정 후에도 실패 → `"status": "error"`, `"error_message"`에 실패한 명령과 출력 꼬리
   - 사람 개입 필요 → `"status": "blocked"`, `"blocked_reason"` 후 즉시 중단

## commit 기준

`execute.py`가 자동으로 두 커밋을 만든다:
- 코드 — `feat(0-foundation): step 0 — project-setup`
- 메타데이터 — `chore(0-foundation): step 0 output`

수동 실행 시에도 같은 형식을 쓴다. 커밋에 포함: 위 「수정 대상 파일」 전부 + `package-lock.json`.
커밋에서 제외: `node_modules/` · `.next/` · `.env`.

## 금지사항

- **`npx create-next-app`을 쓰지 마라.** 이유: 대화형 프롬프트가 있어 비대화형 하네스에서 멈춘다.
- **`tailwind.config.ts`를 만들지 마라.** 이유: v4는 CSS에서 설정하고, config 파일이 있으면 DESIGN.md의 "값은 CSS 커스텀 프로퍼티에만 존재한다" 원칙이 두 군데로 갈라진다.
- **`design/tokens/fonts.css`를 `src/`로 복사하지 마라.** 이유: Google Fonts `@import`는 렌더 블로킹이고 Next 폰트 최적화를 우회한다(DESIGN.md §1). 폰트는 step 1에서 `next/font`로 넣는다.
- **`design/prototype/ds-bundle.js`를 import하지 마라.** 이유: `window` 전역 + Babel standalone에 의존하는 브라우저 UMD 번들이다.
- **기능 코드를 쓰지 마라** — Supabase 클라이언트, Claude 래퍼, 컴포넌트, API 라우트 전부 이후 step 소관이다.
- **`.env` 파일을 만들거나 실제 키 값을 채우지 마라.**
- **테스트를 `src/__tests__/`에 만들지 마라.** 이유: tdd-guard가 그 경로도 탐색하므로 공용 파일 하나로 여러 모듈의 가드를 우회하게 된다(AGENTS.md).
- 기존 테스트를 깨뜨리지 마라. (지금은 없지만 `scripts/hooks/*.test.mjs`는 별개로 존재한다 — 건드리지 마라.)
