# Step 5: auth-flow

## 목적

Google OAuth 단독 인증을 붙이고, 로그인하지 않은 사용자가 `/dashboard`에 들어가지 못하게 한다.

이 step이 끝나면 **Google 로그인 → 빈 `/dashboard` 진입 → 로그아웃**이 브라우저에서 실제로 돈다.
Phase 0의 마지막 step이자 "코어 루프가 시작될 수 있는 상태"의 완성이다.

## 이전 Step과의 의존성

- **step 1 (`design-tokens`)** — `.fs-google` 유틸 클래스(`src/styles/theme.css`)와 `ThemeToggle`
- **step 2 (`core-types`)** — 타입
- **step 3 (`db-schema`)** — `profiles` 테이블과 `auth.users` INSERT 트리거. **DB에 적용되어 있지 않아도 이 step은 완료할 수 있다** — 테스트는 전부 mock이다
- **step 4 (`supabase-clients`)** — `lib/supabase/client.ts`(브라우저 OAuth 시작) · `server.ts`(세션 확인)

## 읽어야 할 파일

- `/docs/ADR.md` — ADR-006(가입을 업로드 앞에) · ADR-009(Google 단독)
- `/docs/ARCHITECTURE.md` — §디렉토리 구조(`src/middleware.ts` + `middleware.test.ts` ← **면제 아님**) · 화면 5개
- `/docs/DESIGN.md` — §6(화면별 조립) · `.fs-google` · §9(접근성)
- `/AGENTS.md` — 「개발 프로세스」의 middleware 항목
- `/src/lib/supabase/client.ts` · `server.ts` — step 4 산출물
- `/src/styles/theme.css` — `.fs-google` 스펙
- `/design/prototype/flow.jsx` — 로그인 화면의 시각 참조 (구현 참조가 아니다)
- `/scripts/hooks/tdd-guard.mjs` — `middleware.ts`가 왜 면제가 아닌지
- `/phases/PLAN.md` — D-10(`/auth/callback`은 6번째 화면이 아니다)

## 구현 범위

1. `src/middleware.ts` — 세션 갱신 + `/dashboard*` 보호
2. `src/app/auth/callback/route.ts` — OAuth code → 세션 교환 후 리다이렉트
3. `src/components/auth/GoogleSignInButton.tsx` — OAuth 시작
4. `src/components/auth/SignOutButton.tsx` — 로그아웃
5. `src/app/dashboard/page.tsx` — **빈 자리표시 화면**. 진짜 대시보드는 Phase 3다
6. `src/app/page.tsx` 수정 — 로그인 버튼이 있는 최소 랜딩. **진짜 랜딩은 Phase 4다**

## 수정 대상 파일

```
src/middleware.ts                              (신규)
src/middleware.test.ts                         (신규 — 먼저. 면제 아님)
src/app/auth/callback/route.ts                 (신규)
src/app/auth/callback/route.test.ts            (신규 — 먼저)
src/components/auth/GoogleSignInButton.tsx     (신규)
src/components/auth/GoogleSignInButton.test.tsx(신규 — 먼저)
src/components/auth/SignOutButton.tsx          (신규)
src/components/auth/SignOutButton.test.tsx     (신규 — 먼저)
src/app/dashboard/page.tsx                     (신규 — 자리표시. tdd-guard 면제)
src/app/page.tsx                               (수정 — 자리표시. tdd-guard 면제)
```

## 먼저 작성할 테스트

### `src/middleware.test.ts` ← 가장 중요

`src/middleware.ts`는 **tdd-guard 면제가 아니다**(AGENTS.md). 이 테스트를 먼저 쓰지 않으면 훅이 구현 파일 작성을 막는다.

`@supabase/ssr`을 mock하고 `NextRequest`를 직접 만들어 호출한다.

1. 세션 없는 요청이 `/dashboard`로 가면 `/`로 리다이렉트된다
2. 세션 없는 요청이 `/dashboard/uploads/abc`로 가도 리다이렉트된다 (하위 경로)
3. 세션 있는 요청이 `/dashboard`로 가면 통과한다
4. 세션 없어도 `/`·`/legal`은 통과한다
5. `/auth/callback`은 **세션 없이도 반드시 통과한다** — 여기서 막으면 로그인이 영원히 안 된다
6. `_next/static`·`_next/image`·`favicon.ico`·이미지 확장자는 matcher에서 제외된다
7. 응답에 갱신된 세션 쿠키가 실려 나간다 (`@supabase/ssr`의 쿠키 어댑터가 set한 것)

### `src/app/auth/callback/route.test.ts`
1. `?code=...`가 있으면 `exchangeCodeForSession`이 호출되고 `/dashboard`로 리다이렉트한다
2. `code`가 없으면 `/`로 리다이렉트한다 (에러 페이지를 만들지 않는다)
3. 교환이 실패하면 `/`로 리다이렉트하고 **에러 원문을 URL에 싣지 않는다**
4. 리다이렉트 대상이 **요청 파라미터가 아니라 서버가 구성한 값**이다 — `?next=https://evil.com`을 넣어도 외부로 안 나간다 (오픈 리다이렉트 방어)

### `GoogleSignInButton.test.tsx`
1. 클릭하면 `signInWithOAuth({ provider: 'google' })`가 호출된다
2. `redirectTo`가 `/auth/callback`을 가리킨다
3. 접근 가능한 이름이 있다 (아이콘만 있으면 `aria-label`)
4. 진행 중에는 버튼이 disabled가 되어 이중 클릭이 안 된다

### `SignOutButton.test.tsx`
1. 클릭하면 `signOut`이 호출된다
2. 성공 후 `/`로 이동한다
3. `aria-label` 또는 텍스트 레이블이 있다

## Codex 실행 지시문

### `src/middleware.ts`

`@supabase/ssr`의 서버 클라이언트로 세션을 갱신하고 그 쿠키를 응답에 실어 보낸다. **`createClient` 헬퍼(step 4)를 그대로 쓰지 말고 미들웨어 전용으로 request/response 쌍을 다뤄라** — 미들웨어의 쿠키 API가 다르다.

matcher는 정적 자산을 제외한다:

```ts
export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
```

보호 대상은 `/dashboard`로 시작하는 경로. `/upgrade`도 로그인이 필요하다 — Phase 5에서 그 화면이 생기므로 **지금 미들웨어에 넣어두어라** (경로 문자열 목록 하나로).

**`/auth/callback`을 반드시 통과시켜라.** 여기서 세션 없다고 막으면 OAuth가 영원히 완료되지 않는다.

리다이렉트 대상은 `/` 고정이다. `?redirectTo=` 같은 복귀 경로 파라미터를 **만들지 마라** — 요청되지 않았고 오픈 리다이렉트 표면만 늘린다.

### `src/app/auth/callback/route.ts`

Route Handler. `runtime`은 Node.js(기본).

- `searchParams.code`를 꺼내 `exchangeCodeForSession`
- 성공 → `/dashboard`로 리다이렉트
- 실패·code 없음 → `/`로 리다이렉트
- **리다이렉트 origin을 요청 헤더에서 그대로 신뢰하지 마라.** `NEXT_PUBLIC_SITE_URL`이 있으면 그것을, 없으면 `request.nextUrl.origin`을 쓴다. 사용자가 준 `next` 파라미터를 절대 쓰지 마라
- 실패 사유를 URL 쿼리나 로그에 **원문으로 남기지 마라**

### `GoogleSignInButton.tsx`

Client Component. `lib/supabase/client.ts`의 브라우저 클라이언트를 쓴다.

```ts
supabase.auth.signInWithOAuth({
  provider: 'google',
  options: { redirectTo: `${origin}/auth/callback` },
});
```

DESIGN.md의 `.fs-google` 유틸 클래스를 쓴다. Google 로고는 `design/prototype/icons.js` 수준의 인라인 SVG로. **이모지 금지.**

**다른 provider 버튼을 만들지 마라** — 카카오·이메일/비밀번호·매직링크 전부 명시적으로 제외됐다(ADR-009).

### `src/app/dashboard/page.tsx` (자리표시)

Server Component. `getUser()`로 사용자를 읽고 이메일과 `SignOutButton`만 보여준다. **드롭존·업로드 목록·리포트를 만들지 마라** — Phase 3다.

앱 셸(`.fs-app`/`.fs-side`/`.fs-topbar`)도 아직 만들지 마라. Phase 3 step 0이다.

### `src/app/page.tsx` (자리표시)

브랜드 워드마크 + 한 줄 설명 + `GoogleSignInButton` + `ThemeToggle`. 그게 전부다.

**ColorBlock·마퀴·가격표·푸터를 만들지 마라** — Phase 4다. 여기서 만들면 Phase 4가 그걸 지우고 다시 만든다.

## 완료 조건

- `middleware.test.ts` 7항목 · callback 4항목 · 버튼 2개 테스트가 전부 통과한다
- 로그인 없이 `/dashboard`에 접근하면 `/`로 튕긴다
- `/auth/callback`이 미들웨어를 통과한다
- Google 외의 인증 수단이 코드에 없다
- 리다이렉트 대상이 사용자 입력에서 오지 않는다
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/middleware.test.ts src/app/auth src/components/auth
```

수동 확인 (Supabase 프로젝트와 Google OAuth provider 설정이 끝난 뒤 — **이 step의 완료 조건이 아니다**):

```bash
npm run dev
# 1. http://localhost:3000/dashboard 직접 접근 → / 로 튕기는지
# 2. / 에서 Google 로그인 → /dashboard 진입하는지
# 3. 로그아웃 → / 로 돌아오고 다시 /dashboard 가 막히는지
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md 화면 5개 + `/auth/callback` **라우트 핸들러** 외에 새 라우트를 만들지 않았는가?
   - ADR-009 — Google 외 provider가 없는가?
   - AGENTS.md — `src/middleware.test.ts`를 **먼저** 썼는가?
   - DESIGN.md — `.fs-google`을 쓰는가? raw hex·raw px 없는가? 이모지 없는가? 아이콘 버튼에 `aria-label`이 있는가?
   - 로그에 이메일·토큰·에러 원문을 남기지 않는가?
3. 결과에 따라 `phases/0-foundation/index.json`의 step 5를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "middleware.ts로 /dashboard·/upgrade 보호(/auth/callback 통과), auth/callback route가 code→세션 교환 후 /dashboard 리다이렉트(오픈 리다이렉트 방어). GoogleSignInButton/SignOutButton. /와 /dashboard는 자리표시 — Phase 3·4에서 대체")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단
4. `summary`에 "`/`와 `/dashboard`는 자리표시"라고 반드시 남겨라 — Phase 3·4가 그 페이지를 덮어쓸 것을 알아야 한다.

## commit 기준

`feat(0-foundation): step 5 — auth-flow`

포함: `src/middleware.{ts,test.ts}` · `src/app/auth/**` · `src/components/auth/**` · `src/app/dashboard/page.tsx` · `src/app/page.tsx`

## 금지사항

- **`src/middleware.ts`를 테스트 없이 쓰지 마라.** 이유: tdd-guard 면제 목록에 없고(AGENTS.md 명시), 여기가 뚫리면 모든 게이트가 무의미하다.
- **Google 외의 인증 수단을 만들지 마라.** 이유: provider를 하나로 고정해야 로그인 분기·계정 병합·비밀번호 재설정 흐름이 통째로 사라진다(ADR-009).
- **익명 업로드 경로나 `/demo` 화면을 만들지 마라.** 이유: 익명 업로드는 소유자 없는 개인신용정보를 만들고, 맛보기는 사용자 자신의 숫자로 이뤄진다(ADR-006 · ADR-007).
- **리다이렉트 대상을 요청 파라미터에서 읽지 마라.** 이유: 오픈 리다이렉트가 된다. 서버가 구성한다.
- **`?redirectTo=` 같은 복귀 경로 기능을 만들지 마라.** 이유: 요청되지 않은 유연성이고 공격 표면만 늘린다.
- **인증 에러 원문을 화면·URL·로그에 싣지 마라.** 이유: 고정 어휘 원칙이고 PII 로깅 금지다.
- **진짜 랜딩·진짜 대시보드를 만들지 마라.** 이유: Phase 4·3이 각각 만든다. 여기서 만들면 두 번 만드는 것이고 ADR-012의 순서를 어긴다.
- **앱 셸(`.fs-app`/`.fs-side`/`.fs-topbar`)을 만들지 마라** — Phase 3 step 0 소관이다.
- 기존 테스트를 깨뜨리지 마라.
