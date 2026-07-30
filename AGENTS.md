# 프로젝트: FinSight2

카드사 CSV 명세서를 올리면 사업 경비 후보를 분류해, 세무사에게 그대로 넘길 정리본을 만들어 주는 웹앱.
전체 기획·아키텍처·설계 근거는 `docs/` (PRD · ARCHITECTURE · ADR · DESIGN)에 있다.

## 기술 스택
- Next.js (App Router) / TypeScript strict mode / Tailwind CSS
- Supabase (Auth · Postgres · Storage) · Vercel
- Claude API `claude-opus-5` (`@anthropic-ai/sdk`) · Polar (`@polar-sh/sdk`, `@polar-sh/nextjs`)
- 인증은 Google OAuth 단독

> 제품이 쓰는 LLM은 Claude API 그대로다. Codex 는 이 레포를 **개발하는 에이전트**일 뿐
> 런타임 의존성이 아니다. `src/services/claude/` 를 Codex 로 바꾸지 마라.

## 아키텍처 규칙

- CRITICAL: **외부 API 호출은 `app/api/` 라우트 핸들러와 서버 컴포넌트에서만** 한다. 클라이언트 컴포넌트에서 Claude·Polar·Supabase service role을 직접 호출하지 마라.
- CRITICAL: **service role 키를 클라이언트로 내보내지 마라.** service role 헬퍼는 `userId`를 **필수 첫 인자**로 받는 시그니처여야 한다 — 규율이 아니라 타입으로 막는다.
- CRITICAL: **mock-first.** 어떤 step도 "API 키가 없다"는 이유로 `blocked` 처리하지 마라. 외부 호출은 `src/services/`·`src/lib/supabase/` 뒤로 격리하고 테스트는 SDK를 mock한다. **테스트가 외부 키를 요구하면 안 된다** — Stop 훅이 매 세션 종료마다 `lint && build && test`를 돌리므로 키를 요구하는 순간 모든 step이 연쇄 실패한다.
- CRITICAL: **환경변수 검증은 lazy.** 모듈 최상단에서 `process.env`를 읽고 throw하지 마라. `next build`가 페이지를 프리렌더하므로 빌드가 깨진다.
- CRITICAL: **카드번호·승인번호는 정규화 단계에서 제거하고 저장하지 마라** — 스키마에 컬럼 자체를 두지 않는다. 정규화된 거래 행은 `transactions`에 저장한다(ADR-015). 원본 CSV는 비공개 Storage 버킷에만 두고 90일 후 파기한다.
- CRITICAL: **합계·구성비·절세 추정액을 모델에게 계산시키지 마라.** 모델 출력은 *거래별 계정과목 · 경비 판정 · 근거 한 줄*까지고, 산술은 서버 TypeScript가 원본 금액으로 한다.
- CRITICAL: **로그에 PII를 남기지 마라.** 가맹점명·카드번호·CSV 내용·웹훅 원문 body 금지. 실패 시 에러 코드와 행 수만 남긴다.
- 컴포넌트는 `src/components/`, 타입은 `src/types/`, 순수 로직은 `src/lib/`, 외부 SDK 래퍼는 `src/services/`.
- 차트·결과 컴포넌트는 **데이터를 props로 받는다.** 데이터 페칭은 페이지가 한다 — 같은 컴포넌트를 무료(부분 데이터)와 유료(전체 데이터)로 렌더해야 하고, 테스트가 픽스처로 렌더해야 하기 때문이다.
- 클라이언트로 나가는 에러는 **고정 어휘**만: `parse_failed`·`too_large`·`duplicate_file`·`analysis_failed`·`upstream`·`expired`·`payment_required`. 예외 메시지·SQL 에러를 그대로 실어 보내지 마라.

## 개발 프로세스

- CRITICAL: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD)
- CRITICAL: **테스트는 대상 파일과 같은 디렉토리에 둘 것** (`route.ts` 옆에 `route.test.ts`). 이유: tdd-guard가 `src/__tests__/{BASENAME}.test.ts`도 탐색하므로 공용 파일 하나로 여러 모듈의 가드를 우회할 수 있다.
- `src/middleware.ts`는 tdd-guard 면제가 **아니다** — `src/middleware.test.ts`를 먼저 써라.
- 마이그레이션에 `DROP TABLE`을 쓰지 마라 (PreToolUse 훅이 차단한다).
- 커밋 메시지는 conventional commits 형식 (feat:, fix:, docs:, refactor:)

## 명령어
```
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # 테스트
```

## 하네스

phase 단위 실행은 `scripts/execute.py`가 step마다 `codex exec`를 한 번씩 띄워서 돌린다.

```
python scripts/execute.py <phase-dir>          # 순차 실행
python scripts/execute.py <phase-dir> --push   # 실행 후 push
```

- 가드레일 주입: 이 파일(AGENTS.md) + `docs/*.md` 전문을 매 step 프롬프트 앞에 붙인다.
- 프롬프트는 argv 가 아니라 **stdin** 으로 넘어간다 — 가드레일만 45,000자가 넘어 Windows 인자 한도(32767자)를 초과한다.
- step 상태(`completed`/`error`/`blocked`)는 `phases/{phase}/index.json`에 직접 기록한다.

## 훅

`.codex/hooks.json`에 세 개가 걸려 있고, 구현은 `scripts/hooks/*.mjs`다.
bash가 아니라 node인 이유: Codex는 훅을 cmd.exe로 실행하는데 Windows PATH에 bash가 없다.

| 이벤트 | 훅 | 하는 일 |
|--------|----|---------|
| `PreToolUse` (`Bash`·`shell`) | `bash-guard.mjs` | `rm -rf` · force push · `git reset --hard` · `DROP TABLE` 차단 |
| `PreToolUse` (`apply_patch`·`Edit`·`Write`) | `tdd-guard.mjs` | 테스트 없는 구현 파일 작성 차단 |
| `Stop` | — | `npm run lint && npm run build && npm run test` |

훅을 고치면 회귀 테스트를 돌려라:

```
node scripts/hooks/tdd-guard.test.mjs
node scripts/hooks/bash-guard.test.mjs
```

프로젝트 훅은 신뢰(trust)를 받아야 실행된다. 대화형 세션에서 `/hooks`로 한 번 승인하거나,
하네스처럼 무인 실행할 때는 `--dangerously-bypass-hook-trust`를 붙인다 (`execute.py`가 이미 붙인다).

## 환경
- Windows. Node v24.15.0 / npm 11.12.1
- Python은 `C:\miniconda3\envs\flood_risk311\python.exe` (PATH의 `python`은 Store alias stub이라 실행 안 됨)
- `codex` CLI가 PATH에 있고 로그인되어 있어야 한다 (`codex login`)
- 하네스 테스트는 UTF-8 모드로 돌려라 — `PYTHONUTF8=1 python -m pytest scripts/test_execute.py`
  (Windows 기본 인코딩이 cp949라 한글 픽스처가 깨진다)
