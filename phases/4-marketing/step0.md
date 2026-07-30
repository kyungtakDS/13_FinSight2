# Step 0: marketing-components

## 목적

마케팅 레이어의 컴포넌트 7개를 TSX로 만든다.

마케팅 레이어는 앱과 **다른 표현 규칙**을 쓴다: 무채색 크롬 + 대형 파스텔 color-block. 편집 디자인이다. 대비가 의도다 — *"무채색 앱이 파스텔 블록을 의도적으로 보이게 하고, 파스텔 블록이 앱을 금융 도구처럼 보이게 한다"*(DESIGN.md §0).

**`design/prototype/ds-bundle.js`를 import하지 마라.** `window` 전역 + Babel standalone에 의존하는 브라우저 UMD 번들이다. §5 스펙대로 TSX로 다시 만든다.

## 이전 Step과의 의존성

Phase 0~3 전체가 `completed`여야 한다. 직접 쓰는 것:

- **Phase 0 step 1 (`design-tokens`)** — `src/styles/tokens/colors.css`의 마케팅 코어 토큰 · `.t-*` 타입 클래스
- **Phase 3 step 0 (`app-shell`)** — **디자인 규율 공통 테스트**. 그 step의 `summary`에 경로가 있다. 단, 마케팅 레이어는 `--color-block-*`을 **써야** 하므로 그 항목만 예외 처리한다

## 읽어야 할 파일

- `/docs/DESIGN.md` — **전문**. 특히 §0(두 레이어) · §2(색·타입 토큰) · **§4(마케팅 컴포넌트 표와 스펙)** · §3(다크 모드에서 파스텔은 반전되지 않는다) · §10
- `/design/prototype/ds-bundle.js` — **API 참조용으로 읽기만.** import 금지
- `/design/prototype/ds-manifest.json` — 컴포넌트 목록·props
- `/design/prototype/landing.jsx` — 사용 예
- `/design/prototype/icons.js` — 아이콘 스타일 기준
- `/src/styles/tokens/colors.css` · `/src/styles/theme.css`
- `/design/adherence.oxlintrc.json` — 원 디자인 시스템의 준수 규칙

## 구현 범위

DESIGN.md §4의 표 그대로 7개. **선언된 prop만 받는다 — 임의 prop을 추가하지 마라.**

| 컴포넌트 | props |
|---|---|
| `Button` | `children, variant('primary'\|'secondary'\|'tertiary'\|'magenta'), size('md'\|'lg'), fullWidth, disabled, href, onClick, type, style` |
| `IconButton` | `children, variant('default'\|'inverse'), size, disabled, ariaLabel, onClick, style` |
| `TextInput` | `label, id, value, onChange, placeholder, type, as('input'\|'textarea'), rows, style` |
| `ColorBlock` | `variant('lime'\|'lilac'\|'cream'\|'mint'\|'pink'\|'coral'\|'navy'), eyebrow, title, children, align('left'\|'center'), bleed, style` |
| `PricingCard` | `name, price, period, blurb, features, ctaLabel, ctaVariant('primary'\|'secondary'), featured, onCta, style` |
| `MarqueeStrip` | `items, style` |
| `Footer` | `brand, columns[{head, links}], style` |

## 수정 대상 파일

```
src/components/marketing/Button.tsx        (+ .test.tsx, 먼저)
src/components/marketing/IconButton.tsx    (+ .test.tsx, 먼저)
src/components/marketing/TextInput.tsx     (+ .test.tsx, 먼저)
src/components/marketing/ColorBlock.tsx    (+ .test.tsx, 먼저)
src/components/marketing/PricingCard.tsx   (+ .test.tsx, 먼저)
src/components/marketing/MarqueeStrip.tsx  (+ .test.tsx, 먼저)
src/components/marketing/Footer.tsx        (+ .test.tsx, 먼저)
```

## 먼저 작성할 테스트

### `Button`
1. `href`가 있으면 `<a>`, 없으면 `<button>`(DESIGN.md §4)
2. 4개 variant가 각각 다른 클래스/토큰을 쓴다
3. `min-height 44px` 스펙이 토큰/클래스로 적용된다 (raw px 아님)
4. **모양이 `--radius-pill`이다** — 각진 CTA가 없다(DESIGN.md §10-3)
5. `disabled`면 클릭 핸들러가 안 불린다
6. **선언되지 않은 prop을 받지 않는다** — 타입에 `[key: string]: unknown`이 없음을 확인
7. press 시 `scale(0.97)` 모션 (있으면 토큰/클래스로)

### `IconButton`
8. `ariaLabel`이 `aria-label`로 나간다. **`ariaLabel` 없이 렌더하면 타입 에러다** (필수 prop)
9. `variant='inverse'`가 **고정 배경**(`--icon-inverse-surface`)을 쓰고 잉크도 **함께 고정된 토큰**을 쓴다. `--color-ink`·`--color-inverse-ink`(반전되는 토큰)를 쓰지 않음을 검사하라 — DESIGN.md §4의 짝 규칙

### `TextInput`
10. `label`과 `id`가 연결된다 (`<label htmlFor>`)
11. `as='textarea'`면 `<textarea>`가 나오고 `rows`가 적용된다
12. 라운드가 `--radius-md`다 (입력은 pill이 아니다)

### `ColorBlock` ← 다크 모드 짝 규칙
13. 7개 variant가 각각 `--color-block-{name}` 배경을 쓴다
14. **잉크가 반드시 `--color-block-ink`다** (navy만 `--color-block-ink-inverse`)
15. **`--color-ink`·`--color-inverse-ink`를 쓰지 않는다.** 소스를 읽어 검사하라. 이유: 파스텔 배경은 다크에서 반전되지 않는데 잉크만 반전되면 lime 위 흰 글씨(대비 1.1:1)가 된다(DESIGN.md §3·§4)
16. 패딩 `--space-xxl`, 라운드 `--radius-lg`
17. `align`·`bleed`가 동작한다

### `PricingCard`
18. `features` 배열이 리스트로 렌더된다
19. `featured`가 시각적으로 구분된다
20. `ctaVariant`가 `Button`에 전달된다
21. 가격에 `.num`(tabular-nums)이 붙는다 — 금액이다(DESIGN.md §8)

### `MarqueeStrip` ← 여기는 반전이 맞다
22. `--color-inverse-canvas`/`--color-inverse-ink`를 쓴다. **이건 정답이다** — 배경과 잉크가 **함께** 반전되므로(DESIGN.md §4 마지막 문단)
23. 선형 스크롤이다. 바운스·이징이 없다
24. `prefers-reduced-motion`에서 애니메이션이 멈춘다

### `Footer`
25. `columns`의 `head`가 mono 클래스를 쓴다 (분류 라벨)
26. 링크가 실제 `<a>`다

### 만들지 말아야 할 것 ← 명시적 검사
27. **`TopNav`·`PricingTabs`·`CheckGlyph`·`TemplateCard`·`FeatureTile`·`PromoBanner` 파일이 존재하지 않는다.** 디렉토리를 읽어 검사하라(DESIGN.md §4 마지막)

### 디자인 규율 (마케팅 변형)
28. raw hex 없음 · raw px 없음 · 토큰 weight 집합만 · **이모지 없음**
29. **`--fs-*` 앱 토큰을 쓰지 않는다.** 예외는 브랜드 도트와 단계 번호의 `--fs-accent` 하나뿐이다(DESIGN.md §0)
30. `ds-bundle.js`를 import하지 않는다

## Codex 실행 지시문

### 다크 모드 짝 규칙 — 이 step에서 가장 틀리기 쉬운 곳

DESIGN.md §4:

> **규칙: 배경이 다크에서 반전되지 않는 면 위에는 반전되는 잉크 토큰(`--color-ink`·`--color-inverse-ink`)을 쓰지 마라.** 배경과 잉크는 반드시 같이 뒤집히거나 같이 고정돼야 한다. 이 짝이 어긋나면 다크 모드에서 lime 위 흰 글씨(대비 1.1:1)가 된다.

| 컴포넌트 | 배경 | 잉크 |
|---|---|---|
| `ColorBlock` 7종 | **고정** (`--color-block-*`) | **고정** (`--color-block-ink` / navy는 `-inverse`) |
| `IconButton` `inverse` | **고정** (`--icon-inverse-surface`) | **고정** |
| `MarqueeStrip` | **반전** (`--color-inverse-canvas`) | **반전** (`--color-inverse-ink`) ← 이게 맞다 |

DESIGN.md §11: *"color-block 대비는 라이트/다크가 동일하다 — lime 16.9:1 · navy 15.7:1 · coral 12.4:1. 이 값이 무너지면 `ColorBlock`이 `--color-block-ink` 대신 `--color-ink`를 읽고 있는 것이다."*

이 레포에는 이미 그 버그를 고친 커밋이 있다(`fix(design): 다크 모드에서 color-block 잉크가 반전돼 읽히지 않던 문제`). 같은 실수를 반복하지 마라.

### 선언된 prop만 받는다

DESIGN.md §4: *"**선언된 prop만 받는다** — 임의 prop을 추가하지 마라."*

`...rest`를 DOM에 뿌리지 마라. `className` prop도 표에 없으면 추가하지 마라 — 있으면 호출부가 토큰을 우회해 임의 스타일을 넣는다.

`style` prop은 표에 있으므로 허용된다.

### `ds-bundle.js`는 읽되 import하지 않는다

API를 확인하는 참조 자료다. `window` 전역과 Babel standalone에 의존하는 UMD 번들이라 Next 빌드에서 깨진다(DESIGN.md §1).

### 만들지 말아야 할 6개

DESIGN.md §4 마지막:

> MVP에 **필요 없는** DS 컴포넌트: `TopNav`(랜딩이 자체 nav를 가진다) · `PricingTabs` · `CheckGlyph` · `TemplateCard` · `FeatureTile` · `PromoBanner`. **만들지 마라.** 이유: 단일 상품 2티어라 탭이 없고, 나머지는 원 브랜드의 마케팅 자산이라 이 제품에 대응물이 없다.

프로토타입이나 `ds-manifest.json`에 보이더라도 만들지 마라.

### 마케팅에 `--fs-*`를 섞지 마라

DESIGN.md §0: *"**마케팅 화면에 `--fs-*` 앱 토큰을 쓰지 마라.** 예외는 브랜드 도트와 단계 번호(`01`~`04`)의 `--fs-accent` 하나뿐이다."*

### `--color-accent-magenta`는 페이지당 1개

DESIGN.md §2: *"페이지당 프로모 CTA **1개**에만."*

컴포넌트는 `variant='magenta'`를 제공하되, **몇 개를 쓸지는 페이지의 책임**이다. 여기서 개수를 강제하지 마라 — step 1의 랜딩이 지킨다.

### 중간 회색 텍스트를 만들지 마라

DESIGN.md §2: *"**중간 회색 텍스트를 만들지 마라.** 이유: 이 시스템은 본문 위계를 **불투명도가 아니라 font-weight**로 만든다. `--fs-muted`는 앱 레이어 전용이다."*

`opacity: 0.6` 같은 것으로 보조 텍스트를 만들지 마라. weight를 낮춰라 (320·330).

## 완료 조건

- 7개 컴포넌트 + 테스트가 존재하고 30개 항목이 전부 통과한다
- 금지 6개 컴포넌트 파일이 없다
- `ColorBlock`·`IconButton inverse`가 고정 잉크 토큰을 쓴다
- `MarqueeStrip`이 반전 토큰을 쓴다
- `ds-bundle.js` import가 없다
- 마케팅에 `--fs-*`가 없다 (브랜드 도트 예외)
- raw hex·raw px·이모지 없음
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/components/marketing
```

직접 확인:

```bash
ls src/components/marketing/ | grep -E "TopNav|PricingTabs|CheckGlyph|TemplateCard|FeatureTile|PromoBanner" && echo "FAIL: 만들지 말라는 컴포넌트" || echo "OK"
grep -nE "\-\-color-ink|\-\-color-inverse-ink" src/components/marketing/ColorBlock.tsx && echo "FAIL: 다크에서 대비 붕괴" || echo "OK"
grep -rn "ds-bundle" src/ && echo "FAIL" || echo "OK"
grep -rn "\-\-fs-" src/components/marketing/ | grep -v "fs-accent" && echo "FAIL: 마케팅에 앱 토큰" || echo "OK"
grep -rnE "#[0-9a-fA-F]{3,8}\b|\b[0-9]+px\b" src/components/marketing/*.tsx && echo "FAIL" || echo "OK"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - DESIGN.md §4 — 7개만 만들고 금지 6개를 안 만들었는가? 선언된 prop만 받는가?
   - DESIGN.md §3·§4 — 배경/잉크 짝 규칙을 지켰는가?
   - DESIGN.md §0 — 마케팅에 `--fs-*`를 안 섞었는가?
   - DESIGN.md §10 — raw hex·raw px·이모지·`ds-bundle.js` import 없는가? CTA가 pill인가?
   - DESIGN.md §9 — `IconButton`에 `aria-label` 필수인가?
3. 결과에 따라 `phases/4-marketing/index.json`의 step 0을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "components/marketing/ 7개(Button/IconButton/TextInput/ColorBlock/PricingCard/MarqueeStrip/Footer). DESIGN.md §4 표의 prop만 수용(rest spread 없음), ColorBlock·IconButton inverse는 고정 잉크 토큰·MarqueeStrip은 반전 토큰. 금지 6개 미구현. ds-bundle.js 미사용")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단

## commit 기준

`feat(4-marketing): step 0 — marketing-components`

포함: `src/components/marketing/**`

## 금지사항

- **`design/prototype/ds-bundle.js`를 import하지 마라.** 이유: `window` 전역 + Babel standalone UMD 번들이라 Next 빌드에서 깨진다.
- **`ColorBlock`·`IconButton inverse`에 `--color-ink`·`--color-inverse-ink`를 쓰지 마라.** 이유: 배경이 다크에서 고정인데 잉크만 반전되면 lime 위 흰 글씨(대비 1.1:1)가 된다. 이 레포에 이미 같은 버그의 수정 커밋이 있다.
- **`TopNav`·`PricingTabs`·`CheckGlyph`·`TemplateCard`·`FeatureTile`·`PromoBanner`를 만들지 마라.** 이유: 단일 상품 2티어라 탭이 없고, 나머지는 원 브랜드 자산이라 이 제품에 대응물이 없다.
- **표에 없는 prop을 추가하지 마라 — `className`·`...rest` 포함.** 이유: 호출부가 토큰을 우회해 임의 스타일을 넣게 된다.
- **마케팅 컴포넌트에 `--fs-*` 앱 토큰을 쓰지 마라** (브랜드 도트의 `--fs-accent` 예외).
- **불투명도로 보조 텍스트를 만들지 마라.** 이유: 위계는 font-weight로 만든다. 중간 회색 텍스트가 없다.
- **CTA를 각지게 만들지 마라.** 이유: `--radius-pill`이 모든 텍스트 CTA의 유일한 모양이다.
- **카드에 그림자를, 배경에 그라디언트·이미지 텍스처를 쓰지 마라.**
- **이모지를 쓰지 마라.** 아이콘은 1.5–2px stroke 라인 세트로.
- **로고 마크를 지어내지 마라.**
- **페이지를 만들지 마라** — step 1·2다.
- 기존 테스트를 깨뜨리지 마라.
