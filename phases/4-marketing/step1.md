# Step 1: landing

## 목적

랜딩 페이지 `/`를 만든다. Phase 0 step 5가 만든 자리표시를 **대체**한다.

랜딩을 여기서 만드는 이유(ADR-012): *"랜딩의 설득력은 실제 리포트 화면 스크린샷에서 나오는데, 그 화면이 없는 상태에서 랜딩을 만들면 목업을 상상으로 그리고 나중에 다시 만들게 된다."* 이제 Phase 3에서 리포트 화면이 실제로 존재한다.

랜딩의 부담은 이미 가볍다(ADR-007) — 사용자가 **자기 숫자**를 본 뒤에 결제하므로, 랜딩은 "여기 올리면 뭐가 나오는지"만 말하면 된다.

## 이전 Step과의 의존성

- **step 0 (`marketing-components`)** — 7개 컴포넌트
- **Phase 0 step 1 (`design-tokens`)** — `ThemeToggle` · `.t-*` 타입 클래스
- **Phase 0 step 5 (`auth-flow`)** — `GoogleSignInButton`. `/`의 자리표시를 이 step이 대체한다
- **Phase 3** — 리포트 화면이 실제로 존재한다는 사실 (스크린샷을 넣는다면 여기서)

## 읽어야 할 파일

- `/docs/DESIGN.md` — **§6의 `/` 랜딩 조립 순서** · §0 · §2 · §4 · §10
- `/design/prototype/landing.jsx` — **조립 순서의 시각 참조**
- `/docs/PRD.md` — §목표 · §사용자 · UC-01 · §구독 및 기능 게이트(가격 2티어) · §제약(법적 포지셔닝)
- `/docs/ADR.md` — ADR-007 · ADR-011(포지셔닝) · ADR-012
- `/src/components/marketing/**` — step 0 산출물
- `/src/components/auth/GoogleSignInButton.tsx` · `/src/components/ThemeToggle.tsx`

## 구현 범위

DESIGN.md §6의 조립 순서 그대로:

```
nav (브랜드 · 링크 3개 · 테마 토글 · 로그인 · 무료로 시작하기)
→ 카드사 마퀴
→ 히어로 (eyebrow / display-xl / body-lg / CTA 2개 / caption)
→ ColorBlock 3개
     lime  : 무료로 자기 숫자
     navy  : 데이터 처리
     coral : 보수적 추정
→ 4단계 그리드
→ 가격 2티어
→ 세무 고지
→ 푸터
```

## 수정 대상 파일

```
src/app/page.tsx                            (수정 — 자리표시 대체. tdd-guard 면제)
src/components/marketing/LandingNav.tsx     (신규 — 랜딩 자체 nav)
src/components/marketing/LandingNav.test.tsx(신규 — 먼저)
src/components/marketing/Hero.tsx           (신규)
src/components/marketing/Hero.test.tsx      (신규 — 먼저)
src/components/marketing/Steps.tsx          (신규 — 4단계 그리드)
src/components/marketing/Steps.test.tsx     (신규 — 먼저)
src/components/marketing/Pricing.tsx        (신규 — 2티어)
src/components/marketing/Pricing.test.tsx   (신규 — 먼저)
```

`LandingNav`는 DESIGN.md §4가 금지한 `TopNav`가 **아니다.** §4의 주석 그대로: *"`TopNav`(랜딩이 자체 nav를 가진다)"* — 랜딩 전용 nav를 랜딩이 갖는 것이 의도다.

## 먼저 작성할 테스트

### `LandingNav`
1. 브랜드가 워드마크 `FinSight` + `--fs-accent` 도트다 (앱 토큰 예외 1개)
2. 링크 3개 + `ThemeToggle` + 로그인 + "무료로 시작하기"
3. 링크가 **존재하는 라우트만** 가리킨다 — `/legal`과 페이지 내 앵커. `/about`·`/blog` 같은 없는 라우트를 만들지 마라
4. 아이콘 전용 버튼에 `aria-label`

### `Hero`
5. eyebrow(mono, uppercase) · display-xl 헤드라인 · body-lg · CTA 2개 · caption 순서
6. **헤드라인이 문장형 대소문자다** — title case가 아니다(DESIGN.md §2)
7. 주 CTA가 Google 로그인으로 간다 (가입이 업로드 앞에 있다 — ADR-006)
8. **단정적 지시 문구가 없다** (`환급받으세요` 등)
9. caption에 "세무 자문이 아님" 또는 제약 안내

### `ColorBlock` 3개 배치 ← 뷰포트 규칙
10. 정확히 3개다: lime · navy · coral
11. **블록 사이에 항상 흰 캔버스 섹션이 온다**(DESIGN.md §2 마지막)
12. 연속한 두 ColorBlock이 인접하지 않는다
13. navy 블록만 `--color-block-ink-inverse`를 쓴다

### `Steps` (4단계)
14. 4개다
15. 단계 번호(`01`~`04`)가 mono이고 `--fs-accent`를 쓴다 (앱 토큰 예외 2개)
16. 각 단계가 실제 흐름과 일치한다: 가입 → 업로드 → 분석 → 리포트

### `Pricing` ← 2티어
17. **정확히 2개**다: 무료 · Pro
18. **탭이 없다** — `PricingTabs`를 만들지 않기로 했다(DESIGN.md §4)
19. PRD §구독 및 기능 게이트 표와 일치한다:
    - 무료: 업로드·분석 무제한 · 절세 추정액 · 인사이트 **상위 3개**
    - Pro: + 거래별 분류 내역 · 세무사 전달용 다운로드
20. **횟수 제한 문구가 없다** — `월 3회` 같은 문자열 부재를 검사하라(ADR-007에서 폐기됨)
21. 가격이 `.num`이고 `₩9,900 / 월`이다
22. Pro CTA가 `/upgrade`로 간다 (로그인 안 했으면 미들웨어가 `/`로 튕긴다 — 그게 맞다)
23. **"결제·영수증·해지는 Polar 고객 포털에서 관리됩니다"** 취지의 문구가 있다
24. **"해지 후에도 데이터는 지우지 않습니다"** 문구가 있다(ADR-008 · PRD §구독 종료 후 접근 정책)

### 세무 고지 · UC-01 요구사항
25. **"본 서비스는 세무 자문이 아니며 최종 판단은 세무대리인과 상의하십시오"**(ADR-011)
26. **무엇이 전송·저장되는지** 안내가 있다 — Anthropic으로 나가는 것은 CSV 상위 20행과 상호명뿐, 금액·날짜·카드번호는 나가지 않는다(PRD UC-01 · ADR-003)
27. **반복청구·해지·환불 조건** 안내가 있다 (또는 `/legal` 링크)
28. **원본 90일 후 자동 삭제** 안내가 있다(ADR-005)

### `--color-accent-magenta`
29. **페이지 전체에서 magenta CTA가 최대 1개**다(DESIGN.md §2). `variant='magenta'` 사용 횟수를 검사하라

### 디자인 규율 (마케팅 변형)
30. raw hex·raw px·이모지 없음 · `--fs-*` 없음(브랜드 도트·단계 번호 예외) · `ds-bundle.js` import 없음

## Codex 실행 지시문

### 조립 순서를 바꾸지 마라

DESIGN.md §6이 순서를 명시한다. `landing.jsx`가 시각 참조다. **프로토타입은 시각 참조이지 구현 참조가 아니다**(DESIGN.md §11) — 목 데이터와 산술을 가져오지 마라.

### 뷰포트당 color-block 1개

DESIGN.md §2: *"**뷰포트당 color-block은 최대 1개**이고 블록 사이에는 항상 흰 캔버스가 온다."*

lime → (흰 섹션) → navy → (흰 섹션) → coral. 세 블록을 연달아 쌓지 마라.

### 배경은 단색만

DESIGN.md §2: *"배경은 **단색만**. 그라디언트·이미지 텍스처·패턴 금지. 흰 캔버스에서 파스텔 블록으로 바뀌는 것 **자체가** 섹션 구분이다."*

### 카드사 마퀴

`MarqueeStrip`에 카드사명을 넣는다. **실제 카드사 로고 이미지를 넣지 마라** — 상표권 문제가 있고 로고 자산도 없다. 텍스트로 충분하다.

### 가격은 가설임을 기억하되 화면에는 숫자를 쓴다

PRD: *"가격: 월 ₩9,900 (가설. Polar 상품 설정이 청구 source of truth)."*

화면에는 `₩9,900`을 쓰되, **하드코딩된 상수 한 곳**에서 읽어라. Polar 상품 설정이 바뀌면 여기도 바꿔야 한다는 것을 주석으로 남겨라.

### 횟수 문구를 쓰지 마라

`월 3회`·`분석 5회` 같은 문구를 쓰지 마라. **횟수제는 폐기됐다**(ADR-007). 게이트는 기능이지 횟수가 아니다.

### 스크린샷을 넣는다면

Phase 3의 리포트 화면이 이제 존재한다. 스크린샷을 넣고 싶으면 실제 화면을 캡처해서 넣어라 — **목업을 그리지 마라.** 이미지가 없으면 넣지 않아도 된다 (DESIGN.md는 요구하지 않는다).

이미지를 넣는다면 `next/image`로, `alt`를 반드시 넣는다.

### 익명 진입 경로를 만들지 마라

`/demo`·샘플 리포트 버튼을 만들지 마라. **맛보기는 샘플 데이터가 아니라 사용자 자신의 숫자로 이뤄진다**(ADR-006·ADR-007 · ARCHITECTURE.md).

## 완료 조건

- 4개 컴포넌트 + `/` 페이지가 존재하고 30개 항목이 전부 통과한다
- ColorBlock 3개가 흰 캔버스로 분리된다
- 가격이 2티어이고 횟수 문구가 없다
- 세무 고지 · 데이터 처리 안내 · 90일 삭제 · 해지 정책이 있다
- magenta CTA가 최대 1개
- 없는 라우트로 가는 링크가 없다
- 디자인 규율 통과
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/components/marketing
```

직접 확인:

```bash
grep -rnE "월 [0-9]+회|분석 [0-9]+회|횟수" src/app/page.tsx src/components/marketing/Pricing.tsx && echo "FAIL: 횟수제 문구" || echo "OK"
grep -rn "magenta" src/app/page.tsx src/components/marketing/*.tsx | wc -l   # 1 이하여야 한다
grep -rn "세무 자문" src/app/page.tsx src/components/marketing/*.tsx || echo "FAIL: 고지 없음"
grep -rnE "/demo|샘플 리포트" src/app/page.tsx && echo "FAIL: 익명 진입" || echo "OK"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - DESIGN.md §6 — 조립 순서가 맞는가? 라우트 5개를 벗어난 링크가 없는가?
   - DESIGN.md §2 — 뷰포트당 color-block 1개인가? 블록 사이에 흰 캔버스가 있는가? magenta 1개인가?
   - DESIGN.md §0 — 마케팅에 `--fs-*`를 안 섞었는가(예외 2개 제외)?
   - ADR-006·007 — 익명 진입 경로가 없는가? 횟수 문구가 없는가?
   - ADR-011 — 세무 고지가 있고 단정적 지시가 없는가?
   - PRD UC-01 — 무엇이 전송·저장되는지, 반복청구·해지·환불 조건이 안내되는가?
3. 결과에 따라 `phases/4-marketing/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "app/page.tsx 랜딩 완성 + components/marketing/{LandingNav,Hero,Steps,Pricing}.tsx. nav→마퀴→히어로→ColorBlock 3개(lime/navy/coral, 사이에 흰 캔버스)→4단계→가격 2티어(횟수 문구 없음, ₩9,900 상수 한 곳)→세무 고지·데이터 처리·90일·해지 정책→푸터. magenta CTA 1개, 익명 진입 경로 없음")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단

## commit 기준

`feat(4-marketing): step 1 — landing`

포함: `src/app/page.tsx` · `src/components/marketing/{LandingNav,Hero,Steps,Pricing}.{tsx,test.tsx}`

## 금지사항

- **익명 진입 경로(`/demo`·샘플 리포트)를 만들지 마라.** 이유: 맛보기는 사용자 자신의 숫자로 이뤄지므로 남의 샘플을 보여주는 화면의 역할이 사라졌다(ADR-006·ADR-007).
- **횟수 제한 문구를 쓰지 마라.** 이유: 횟수제는 폐기됐다. 게이트는 기능이지 횟수가 아니다(ADR-007).
- **가격 티어를 3개 이상 만들거나 탭을 만들지 마라.** 이유: Polar 단일 상품 2티어다.
- **ColorBlock을 연달아 쌓지 마라.** 이유: 뷰포트당 최대 1개이고 사이에 흰 캔버스가 온다.
- **magenta CTA를 2개 이상 쓰지 마라.** 이유: 페이지당 1개다.
- **실제 카드사 로고 이미지를 넣지 마라.** 이유: 상표권 문제가 있고 자산도 없다. 텍스트 마퀴로 충분하다.
- **리포트 화면 목업을 그리지 마라.** 이유: 실제 화면이 Phase 3에 있다. 그리면 두 개가 갈라진다(ADR-012의 논지 그 자체).
- **없는 라우트로 링크하지 마라.** 이유: 화면은 5개 고정이다.
- **배경에 그라디언트·이미지 텍스처·패턴을 쓰지 마라.**
- **헤드라인을 title case로 쓰지 마라.** ALL-CAPS는 mono 분류 라벨에만.
- **단정적 지시 문구를 쓰지 마라.**
- **`ds-bundle.js`를 import하지 마라.**
- **마케팅에 `--fs-*`를 쓰지 마라** (브랜드 도트·단계 번호 예외).
- **raw hex·raw px·이모지를 쓰지 마라.**
- 기존 테스트를 깨뜨리지 마라.
