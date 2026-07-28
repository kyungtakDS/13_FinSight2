# 프로젝트: FinSight

프리랜서·1인 사업자가 카드 명세서 CSV를 올리면 사업 경비 후보를 자동 분류해, 세무사에게 넘길 정리본을 만들어 주는 SaaS. 상세는 `docs/PRD.md`, 설계 근거는 `docs/ADR.md` 참조.

## 기술 스택
- Next.js 15 (App Router)
- TypeScript strict mode
- Tailwind CSS
- Supabase (Auth + Postgres + Storage)
- Polar (구독 결제)
- Anthropic Claude Opus 5 (`claude-opus-5`)

## 아키텍처 규칙
- CRITICAL: 모든 외부 API 호출(Anthropic, Polar, Supabase service role)은 `app/api/` 라우트 핸들러에서만 처리할 것. 클라이언트 컴포넌트에서 직접 호출하지 말 것.
- CRITICAL: LLM에 전송하는 데이터는 CSV 상위 20행(헤더 판별용)과 가맹점 상호명 문자열로 한정할 것. 금액·날짜·카드번호·사용자 식별자를 전송하지 말 것.
- CRITICAL: LLM 호출 전에 반드시 캐시(`csv_format_mappings` / `merchant_dictionary`)를 먼저 조회할 것. 캐시를 우회하는 호출 경로를 만들지 말 것.
- CRITICAL: 유료 기능 게이트는 서버에서 판정할 것. 클라이언트가 보낸 구독 상태를 신뢰하지 말 것.
- 사용자 데이터 테이블에는 RLS를 걸 것. `merchant_dictionary`와 `csv_format_mappings`는 전역 공유 자산이므로 예외.
- 컴포넌트는 `components/`, 타입은 `types/`, 외부 API 래퍼는 `services/`에 분리할 것.

## 개발 프로세스
- CRITICAL: 새 기능 구현 시 반드시 테스트를 먼저 작성하고, 테스트가 통과하는 구현을 작성할 것 (TDD)
- 커밋 메시지는 conventional commits 형식을 따를 것 (feat:, fix:, docs:, refactor:)

## 명령어
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드
npm run lint     # ESLint
npm run test     # 테스트
