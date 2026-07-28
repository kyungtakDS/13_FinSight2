# 프로젝트: FinSight2

카드사 CSV 명세서를 올리면 Claude가 지출을 분류하고 정기구독을 찾아 인사이트를 주는 웹앱.
전체 기획·시나리오는 루트 `plan.md` 참조 (이 파일에는 주입되지 않는다 — 필요하면 직접 읽어라).

## 기술 스택
- Next.js (App Router) / TypeScript strict mode / Tailwind CSS
- Supabase (Auth · Postgres · Storage) · Vercel
- Claude API `claude-opus-5` (`@anthropic-ai/sdk`) · Polar (`@polar-sh/sdk`, `@polar-sh/nextjs`)
- 인증은 Google OAuth 단독

## 아키텍처 규칙

- CRITICAL: **외부 API 호출은 `app/api/` 라우트 핸들러와 서버 컴포넌트에서만** 한다. 클라이언트 컴포넌트에서 Claude·Polar·Supabase service role을 직접 호출하지 마라.
- CRITICAL: **service role 키를 클라이언트로 내보내지 마라.** service role 헬퍼는 `userId`를 **필수 첫 인자**로 받는 시그니처여야 한다 — 규율이 아니라 타입으로 막는다.
- CRITICAL: **mock-first.** 어떤 step도 "API 키가 없다"는 이유로 `blocked` 처리하지 마라. 외부 호출은 `src/services/`·`src/lib/supabase/` 뒤로 격리하고 테스트는 SDK를 mock한다. **테스트가 외부 키를 요구하면 안 된다** — Stop 훅이 매 세션 종료마다 `lint && build && test`를 돌리므로 키를 요구하는 순간 모든 step이 연쇄 실패한다.
- CRITICAL: **환경변수 검증은 lazy.** 모듈 최상단에서 `process.env`를 읽고 throw하지 마라. `next build`가 페이지를 프리렌더하므로 빌드가 깨진다.
- CRITICAL: **거래 원문 행을 DB에 저장하지 마라.** `analyses.summary`(집계 결과)만 저장한다. 원본 CSV는 비공개 Storage 버킷에만 둔다.
- CRITICAL: **합계·구성비·추이를 Claude에게 계산시키지 마라.** 모델 출력은 *행별 카테고리 · 구독 후보 · 인사이트*까지고, 산술은 서버 TypeScript가 원본 금액으로 한다.
- CRITICAL: **로그에 PII를 남기지 마라.** 가맹점명·카드번호·CSV 내용·웹훅 원문 body 금지. 실패 시 에러 코드와 행 수만 남긴다.
- 컴포넌트는 `src/components/`, 타입은 `src/types/`, 순수 로직은 `src/lib/`, 외부 SDK 래퍼는 `src/services/`.
- 차트·결과 컴포넌트는 **데이터를 props로 받는다.** 데이터 페칭은 페이지가 한다 — `/demo`가 픽스처로 같은 컴포넌트를 렌더해야 하기 때문이다.
- 클라이언트로 나가는 에러는 **고정 어휘**만: `parse_failed`·`too_large`·`refused`·`upstream`·`schema_mismatch`·`truncated`·`expired`. 예외 메시지·SQL 에러를 그대로 실어 보내지 마라.

## 개발 프로세스

- CRITICAL: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD)
- CRITICAL: **테스트는 대상 파일과 같은 디렉토리에 둘 것** (`route.ts` 옆에 `route.test.ts`). 이유: tdd-guard가 `src/__tests__/{BASENAME}.test.ts`도 탐색하므로 공용 파일 하나로 여러 모듈의 가드를 우회할 수 있다.
- `src/middleware.ts`는 tdd-guard 면제가 **아니다** — `src/middleware.test.ts`를 먼저 써라.
- 마이그레이션에 `DROP TABLE`을 쓰지 마라 (Bash 훅이 차단한다).
- 커밋 메시지는 conventional commits 형식 (feat:, fix:, docs:, refactor:)

## 명령어
```
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # 테스트
```

## 환경
- Windows. Python은 `C:\miniconda3\envs\flood_risk311\python.exe` (PATH의 `python`은 Store alias stub이라 실행 안 됨)
- Node v24.15.0 / npm 11.12.1
