# 디자인 시스템

UI를 만드는 모든 step은 이 문서를 따른다. 색·간격·타입을 **직접 정하지 마라** — 값은 전부 토큰으로 이미 정해져 있다.

## 0. 두 레이어

| 레이어 | 어디 | 성격 |
|---|---|---|
| **마케팅** | `/` 랜딩, `/legal` | 무채색 크롬 + 대형 파스텔 color-block. 편집 디자인 |
| **앱** | `/dashboard`, `/dashboard/uploads/:id`, `/upgrade` | 무채색 + 딥블루 포인트 1가지. 데이터 밀도 높음 |

두 레이어는 **같은 토큰 파일을 공유하되 다른 표현 규칙**을 쓴다. 대비가 의도다 — 무채색 앱이 파스텔 블록을 의도적으로 보이게 하고, 파스텔 블록이 앱을 금융 도구처럼 보이게 한다.

**앱 화면에 파스텔 color-block을 쓰지 마라.** 이유: 사용자에게 카드 명세서를 요구하는 화면이며 PRD의 "신뢰형 미니멀"이 곧 전환율이다. 파스텔은 랜딩에서 이야기를 나르는 장치지 대시보드의 장식이 아니다.

**마케팅 화면에 `--fs-*` 앱 토큰을 쓰지 마라.** 예외는 브랜드 도트와 단계 번호(`01`~`04`)의 `--fs-accent` 하나뿐이다.

## 1. 자산 위치와 소비 방법

```
design/
├── styles.css                 # 진입점 (@import 목록만)
├── tokens/{colors,typography,spacing,radius,elevation,fonts}.css
├── theme.css                  # 앱 레이어 토큰(--fs-*) · 다크 테마 · 유틸 클래스
├── adherence.oxlintrc.json    # 원 디자인 시스템의 준수 규칙 (참조용)
├── ds-readme.md               # 원 디자인 시스템 설명 (출처·폰트 대체·로고 부재 고지)
└── prototype/                 # 실행 가능한 참조 프로토타입 — index.html을 브라우저로 열면 동작한다
    ├── index.html, ds-bundle.js, ds-manifest.json
    └── landing.jsx · flow.jsx · report.jsx · app.jsx · data.js · icons.js
```

**`design/`은 소스 오브 트루스이고 빌드 대상이 아니다.** UI step은:

1. `design/tokens/{colors,typography,spacing,radius,elevation}.css` 와 `design/theme.css` 를 `src/styles/` 로 **복사**한다.
2. `src/app/globals.css` 에서 `@import` 한다.
3. Tailwind 테마에 `var()`로 **매핑**한다 (Tailwind v4 기준):

```css
@import "tailwindcss";
@import "../styles/tokens/colors.css";
/* … 나머지 토큰, 마지막에 theme.css */

@theme inline {
  --color-canvas: var(--color-canvas);
  --color-ink: var(--color-ink);
  --color-hairline: var(--color-hairline);
  --color-accent: var(--fs-accent);
  --radius-pill: var(--radius-pill);
  /* 토큰 → 유틸리티. 값을 다시 적지 마라 */
}
```
Tailwind v3로 스캐폴딩되면 `tailwind.config.ts`의 `theme.extend`에서 같은 `var()`를 참조한다. 어느 쪽이든 **원칙은 하나: 값은 CSS 커스텀 프로퍼티에만 존재하고 Tailwind는 그것을 가리키기만 한다.**

**`design/tokens/fonts.css`를 프로덕션에 복사하지 마라.** 이유: Google Fonts `@import`는 렌더 블로킹이고 Next의 폰트 최적화를 우회한다. 대신 `next/font/google`로 로드하고 `--font-sans`/`--font-mono`에 바인딩한다:

```ts
// Inter는 한글 글리프가 없다. 라틴=Inter, 한글=Noto Sans KR로 글리프 단위 폴백시킨다.
const sans = Inter({ subsets: ['latin'], variable: '--font-inter' });
const kr   = Noto_Sans_KR({ subsets: ['latin'], variable: '--font-kr' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains' });
// --font-sans: var(--font-inter), var(--font-kr), system-ui, sans-serif;
```

**`design/prototype/ds-bundle.js`를 프로덕션에 import하지 마라.** 이유: `window` 전역 + Babel standalone에 의존하는 브라우저 UMD 번들이다. 필요한 컴포넌트는 §5 스펙대로 TSX로 다시 만든다.

## 2. 토큰

### 색 — 마케팅 코어

| 토큰 | 값 | 용도 |
|---|---|---|
| `--color-primary` / `--color-on-primary` | `#000` / `#fff` | 모든 primary CTA·헤드라인·본문 |
| `--color-canvas` | `#fff` | 기본 배경 |
| `--color-inverse-canvas` | `#000` | 마퀴 스트립, 다크 섹션 |
| `--color-surface-soft` | `#f4f3f1` | 오프화이트 타일·아이콘 버튼 |
| `--color-hairline` / `--color-hairline-soft` | `#e6e5e2` / `#efeeeb` | 1px 테두리 / 더 옅은 구분선 |
| `--color-block-{lime,lilac,cream,mint,pink,coral,navy}` | — | color-block 7종. navy만 어두운 면 |
| `--color-accent-magenta` | `#e5227e` | 페이지당 프로모 CTA **1개**에만 |
| `--color-success` | `#14ae5c` | 비교표 체크 글리프 |

**중간 회색 텍스트를 만들지 마라.** 이유: 이 시스템은 본문 위계를 **불투명도가 아니라 font-weight**로 만든다. `--fs-muted`는 앱 레이어 전용이다.

### 색 — 앱 레이어 (`design/theme.css`)

| 토큰 | 라이트 | 용도 |
|---|---|---|
| `--fs-accent` / `--fs-accent-ink` | `#22285f` / `#fff` | 딥블루 포인트. 링크·활성 nav·진행바·CTA 강조 |
| `--fs-accent-soft` / `--fs-accent-line` | `#ecedf6` / `#c9cce8` | 절감액 히어로 카드 배경·테두리 |
| `--fs-muted` | `#6b6b70` | 앱 보조 텍스트 |
| `--fs-chart-1`~`6` | 딥블루 시퀀셜 램프 | 계정과목 도넛. **금액 내림차순 순위대로** 배정, 7번째부터 순환 |

**판정 3값의 색은 고정이다.** `transactions.verdict` ↔ 토큰 ↔ 라벨이 1:1로 대응한다:

| verdict | 라벨 | 전경 / 배경 | 칩 클래스 |
|---|---|---|---|
| `expense` | 사업 경비 | `--fs-biz` / `--fs-biz-soft` | `.chip-biz` |
| `personal` | 개인 지출 | `--fs-personal` / `--fs-personal-soft` | `.chip-personal` |
| `uncertain` | 애매 | `--fs-unsure` / `--fs-unsure-soft` | `.chip-unsure` |

**`애매`를 경고색(빨강)으로 칠하지 마라.** 이유: 애매는 오류가 아니라 보류다. 앰버는 "확인 필요"를 뜻하고, 빨강은 사용자가 뭔가 잘못했다는 신호가 된다.

### 타입

`--font-sans` (Inter+Noto Sans KR) 한 목소리를 **미세 weight 축**으로 변조한다. weight는 이 집합에서만 고른다: **320 · 330 · 340 · 450 · 480 · 540 · 700**. `--font-mono` (JetBrains Mono)는 **분류 라벨 전용** — eyebrow, 캡션, 표 헤더, 푸터 컬럼 헤드. **문단을 mono로 조판하지 마라.**

마케팅 역할 토큰 (`--type-{role}-{size,lh,ls,weight}`) 과 `.t-*` 클래스:

| 역할 | size / lh / ls / weight |
|---|---|
| `display-xl` | 86 / 1.00 / −1.72px / 340 |
| `display-lg` | 64 / 1.10 / −0.96px / 340 |
| `headline` · `subhead` | 26 / 1.35 / −0.26px / 540 · 340 |
| `card-title` | 24 / 1.45 / 0 / 700 |
| `body-lg` · `body` · `body-sm` | 20 / 18 / 16, lh 1.40–1.45, weight 330 / 320 / 330 |
| `link` · `button` | 20 / 1.40 / −0.10px / 480 |
| `eyebrow` · `caption` | mono, 18 / 12, ls **+**0.54 / +0.60px, uppercase |

**앱 화면은 마케팅 스케일을 그대로 쓰지 않는다** (데이터 밀도가 다르다):

| 앱 역할 | size / weight / ls |
|---|---|
| 화면 제목 | 30 / 540 / −0.6px |
| 섹션 제목 | 18 / 540 / −0.3px |
| 톱바 제목 | 17 / 540 / −0.2px |
| 본문 | 15.5 / 450 |
| 보조·설명 | 13–14 / 400 / `--fs-muted` |
| 큰 금액 (`.fs-metric-big`) | 56 / 340 / −1.5px |
| 지표 (`.fs-metric`) | 26 / 540 / −0.5px |

**헤드라인을 title case로 쓰지 마라.** 문장형 대소문자가 기본이고, ALL-CAPS는 mono 분류 라벨에만 쓴다.

### 간격 · 라운드 · 엘리베이션

- 8px 기준. `--space-{hair,xxs,xs,sm,md,lg,xl,xxl}` = 1/4/8/12/16/24/32/48px, `--space-section` 96px, `--container-max` 1280px.
- 앱 셸: 사이드바 248px, 톱바 64px, 본문 패딩 40/48px(모바일 28/20), 콘텐츠 max 1080px, 카드 패딩 28px, 그리드 gap 16–20px.
- 라운드: `--radius-pill` 50px = **모든 텍스트 CTA의 유일한 모양**. `--radius-full` = 원형 아이콘 버튼·칩 도트. `--radius-lg` 24px = 카드·color-block. `--radius-md` 8px = 입력·표 컨테이너·리스트. **CTA를 각지게 만들지 마라.**
- 엘리베이션: 기본은 **평면**. 카드는 그림자가 아니라 `1px solid var(--color-hairline)`. `--elevation-2`는 떠 있는 타일·드롭다운, `--elevation-3`+스크림은 모달만. **카드에 그림자를 넣지 마라.**
- 배경은 **단색만**. 그라디언트·이미지 텍스처·패턴 금지. 흰 캔버스에서 파스텔 블록으로 바뀌는 것 **자체가** 섹션 구분이다.
- 모션은 절제: 버튼 press `scale(0.97)`, 마퀴 선형 스크롤. 바운스·패럴랙스 금지. 호버는 opacity 하락, 포커스는 **링**(채우기 변경 아님).

## 3. 다크 모드

`<html data-theme="dark">`가 `design/theme.css`의 오버라이드를 켠다. 라이트/다크 **양쪽을 지원한다.**

- 토큰만 재정의하면 되도록 만들어져 있다 — 컴포넌트에 다크 분기를 넣지 마라.
- 테마 값은 `localStorage`에 저장하고 `<html>`에 반영한다.
- **파스텔 color-block은 다크에서도 그대로다** — 배경도 잉크도 반전되지 않는다(`--color-block-ink`). 이유: 편집 디자인의 정체성이고, 배경만 고정된 채 잉크가 반전되면 대비가 무너진다.
- `color-scheme`을 함께 바꿔 폼 컨트롤·스크롤바가 따라오게 한다.

## 4. 마케팅 컴포넌트 (랜딩 전용)

`design/prototype/ds-bundle.js`의 API를 TSX로 재구현한다. **선언된 prop만 받는다** — 임의 prop을 추가하지 마라.

| 컴포넌트 | props |
|---|---|
| `Button` | `children, variant('primary'\|'secondary'\|'tertiary'\|'magenta'), size('md'\|'lg'), fullWidth, disabled, href, onClick, type, style` |
| `IconButton` | `children, variant('default'\|'inverse'), size, disabled, ariaLabel, onClick, style` |
| `TextInput` | `label, id, value, onChange, placeholder, type, as('input'\|'textarea'), rows, style` |
| `ColorBlock` | `variant('lime'\|'lilac'\|'cream'\|'mint'\|'pink'\|'coral'\|'navy'), eyebrow, title, children, align('left'\|'center'), bleed, style` |
| `PricingCard` | `name, price, period, blurb, features, ctaLabel, ctaVariant('primary'\|'secondary'), featured, onCta, style` |
| `MarqueeStrip` | `items, style` |
| `Footer` | `brand, columns[{head, links}], style` |

`Button` 스펙: `min-height 44px`, `--radius-pill`, gap `--space-xs`, primary 패딩 `10px 20px`(lg `14px 28px`), secondary는 `inset 0 0 0 1px var(--color-hairline)`, tertiary는 배경 없음. `href`가 있으면 `<a>`, 없으면 `<button>`.

`ColorBlock`: 패딩 `--space-xxl`, 라운드 `--radius-lg`. 잉크는 **반드시 `--color-block-ink`**(navy만 `--color-block-ink-inverse`)를 쓴다.

**규칙: 배경이 다크에서 반전되지 않는 면 위에는 반전되는 잉크 토큰(`--color-ink`·`--color-inverse-ink`)을 쓰지 마라.** 배경과 잉크는 반드시 같이 뒤집히거나 같이 고정돼야 한다. 이 짝이 어긋나면 다크 모드에서 lime 위 흰 글씨(대비 1.1:1)가 된다. 해당되는 곳: `ColorBlock` 7종 전부, `IconButton`의 `inverse`(배경이 고정 `--icon-inverse-surface`다). 반대로 `MarqueeStrip`은 배경·잉크가 **함께** 반전되므로 `--color-inverse-*`가 맞다 — 다크에서 검은 띠가 흰 띠로 뒤집히는 것이 의도다.

**뷰포트당 color-block은 최대 1개**이고 블록 사이에는 항상 흰 캔버스가 온다.

MVP에 **필요 없는** DS 컴포넌트: `TopNav`(랜딩이 자체 nav를 가진다) · `PricingTabs` · `CheckGlyph` · `TemplateCard` · `FeatureTile` · `PromoBanner`. **만들지 마라.** 이유: 단일 상품 2티어라 탭이 없고, 나머지는 원 브랜드의 마케팅 자산이라 이 제품에 대응물이 없다.

## 5. 앱 컴포넌트

`design/theme.css`의 유틸 클래스가 스펙이다: `.fs-app` `.fs-side` `.fs-navitem` `.fs-topbar` `.fs-content` `.fs-card` `.fs-eyebrow` `.fs-chip` `.fs-table` `.fs-tablewrap` `.fs-lockwrap/.fs-lockblur/.fs-lockscrim` `.fs-donut` `.fs-legend-row` `.fs-drop` `.fs-detect-row` `.fs-step` `.fs-pbar` `.fs-scrim` `.fs-modal` `.fs-google` `.fs-metric` `.fs-metric-big` `.fs-disclaimer` `.num`.

**차트·리포트 컴포넌트는 데이터를 props로만 받는다.** 페칭은 페이지가 한다 — 무료(부분 데이터)와 유료(전체 데이터)로 같은 컴포넌트를 렌더해야 하고, 테스트가 픽스처로 렌더해야 하기 때문이다.

## 6. 화면별 조립

라우트는 **5개로 고정**이다 (ARCHITECTURE.md). 새 라우트를 만들지 마라.

### `/` 랜딩 — `design/prototype/landing.jsx`
nav(브랜드·링크 3개·테마 토글·로그인·무료로 시작하기) → 카드사 마퀴 → 히어로(eyebrow / display-xl / body-lg / CTA 2개 / caption) → **ColorBlock 3개** (lime: 무료로 자기 숫자, navy: 데이터 처리, coral: 보수적 추정) → 4단계 그리드 → 가격 2티어 → 세무 고지 → 푸터.

### `/legal`
이용약관 · 개인정보처리방침 · **세무 고지**. 마케팅 레이어, 장식 없음.

### `/dashboard` — 업로드 + 기록
`design/prototype/flow.jsx`의 `UploadScreen`. 드롭존(`.fs-drop`, "CSV 전용 · 최대 2MB / 3,000행") → 파일 선택 후 **자동 판별 결과 카드**(카드사·인코딩·행 수·컬럼 매핑·민감정보 제거를 `.fs-detect-row`로) → 분석 시작. 아래에 과거 업로드 목록(기간·거래 수로 식별).

### `/dashboard/uploads/:id` — 한 라우트, 세 상태
`uploads.status`로 분기한다.

- **`processing`** — `.fs-step` 단계 리스트 + `.fs-pbar`. "탭을 닫아도 분석은 서버에서 계속됩니다."
- **`completed`** — `design/prototype/report.jsx`: 헤더("이 리포트는 파일 1개 기준입니다") → 절감액 히어로(`--fs-accent-soft` 카드, `.fs-metric-big`, "예상 절감액(참고용)") → 지표 3개(경비 후보 / 개인 지출 / 애매) → **애매 배너** → 인사이트 카드(무료 3개 / Pro 전체) → 계정과목 도넛 → 거래 표(무료면 잠금) → 고지 문구.
- **`failed`** — `error_code`별 문구 + 재시도 버튼(잔여 횟수 표시). `expired`면 재시도 불가 사유를 말한다.

### `/upgrade`
`design/prototype/report.jsx`의 `PaywallModal` 내용을 **페이지로** 만든다: 가격 · 잠긴 기능 4개 · "구독 시작하기"(Polar Checkout으로 나감) · "결제·영수증·해지는 Polar 고객 포털에서 관리됩니다. 해지 후에도 데이터는 지우지 않습니다."

프로토타입의 `AuthModal`·`PaywallModal`은 **모달로 만들지 마라.** 이유: 인증은 Google OAuth 리다이렉트고 결제는 `/upgrade` → Polar Checkout 리다이렉트다. 프로토타입은 단일 HTML이라 모달로 흉내 냈을 뿐이다.

사이드바 nav는 `/dashboard`와 `/upgrade`만 가리킨다. 프로토타입의 **`설정` 항목을 만들지 마라** — 대응 라우트가 없다.

## 7. 반드시 설계하는 상태

- **빈 상태를 먼저 만든다.** 업로드 0건 대시보드가 다음 행동(업로드 안내 · 카드사별 CSV 내려받는 법)을 알려주지 못하면 실패다. **데이터가 없을 때 빈 차트를 그리지 마라.**
- **잠긴 상태가 곧 결제 화면이다.** `.fs-lockwrap`: 상위 6행을 blur 처리해 **무엇이** 잠겼는지 보여주고, 스크림에 잠긴 건수 · 설명 · Pro CTA를 얹는다.
  **잠긴 거래 행을 클라이언트로 보내고 blur로 가리지 마라. 이유: 그것은 게이트가 아니라 장식이다.** 서버가 자른 뒤 보낸 **부분 데이터**를 blur하는 것이며, 무료 사용자의 페이로드에는 실제 거래 행이 들어 있지 않다(ADR-019). blur는 순전히 시각 장치다.
- **애매 n건을 숨기지 않는다.** 리포트 상단에 배너로 표시하고 "세무사에게 따로 확인하세요"까지 말한다.
- **실패 문구는 고정 어휘 7개에서만** 나온다: `parse_failed` · `too_large` · `duplicate_file` · `analysis_failed` · `upstream` · `expired` · `payment_required`. 예외 메시지·SQL 에러·모델 원문을 화면에 띄우지 마라.
- 거래가 3건뿐이면 도넛 대신 표로 대체한다.

**진행률을 지어내지 마라.** 서버는 `processing | completed | failed` 3상태만 준다(ARCHITECTURE.md). `.fs-step` 단계 리스트는 *무엇을 하는 중인지* 설명하는 장치이며, 확정 퍼센트를 계산해 표시하지 마라 — 근거가 되는 데이터가 없다. 진행바는 indeterminate로 둔다.

## 8. 숫자 표기

- 금액에는 **반드시 `.num`**(`font-variant-numeric: tabular-nums`). 표·지표·도넛 범례 전부. 자릿수가 흔들리면 금융 도구로 보이지 않는다.
- `₩` 기호는 숫자보다 작게(0.6em) 두고, 세 자리 구분은 `toLocaleString('ko-KR')`.
- 취소·부분취소는 **음수 부호를 보존**해 `-₩8,900`으로 표시하고 `--fs-unsure` 색을 준다. 버리거나 절대값으로 만들지 마라 — 합계가 조용히 틀어진다.
- 표의 금액 열은 우측 정렬, weight 540.
- 문구는 **"경비 처리 가능성이 높은 항목" · "예상 절감액(참고용)"**. 단정적 지시("경비 처리하세요", "환급받으세요")를 쓰지 마라 — 세무 자문이 아니다(ADR-011).

## 9. 접근성

- 모든 아이콘 전용 버튼에 `aria-label`. 테마 토글·닫기·로그아웃 포함.
- 포커스는 링으로 보인다. `outline: none`만 주고 대체 표시를 안 하는 코드를 쓰지 마라.
- 표는 `<th scope>`를 갖춘 실제 `<table>`. div로 표를 흉내 내지 마라 — 세무사에게 넘기는 자료라 복사·스크린리더가 실제로 쓰인다.
- 모바일: 차트는 컨테이너 폭 기준, 표는 `.fs-tablewrap`(가로 스크롤) 안에. 880px 이하에서 사이드바는 숨고 그리드는 1열이 된다.
- 파스텔 블록 위 잉크는 항상 검정이다. 파스텔 위에 흰 텍스트를 올리지 마라.

## 10. 금지사항 요약

1. **raw hex·raw px를 쓰지 마라.** 값은 `var(--토큰)`으로만. 새 값이 필요하면 토큰을 먼저 추가한다.
2. **토큰 집합 밖의 font-weight를 쓰지 마라** (320·330·340·450·480·540·700).
3. **CTA를 각지게, 카드에 그림자를, 배경에 그라디언트를 쓰지 마라.**
4. **이모지를 쓰지 마라.** 마케팅·앱 어디에도. 아이콘은 `design/prototype/icons.js` 수준의 절제된 라인 세트(1.5–2px stroke)로 한정한다.
5. **앱에 파스텔 블록, 마케팅에 `--fs-*`를 섞지 마라.**
6. **`ds-bundle.js`를 import하지 마라.** TSX로 재구현한다.
7. **로고 마크가 없다.** 브랜드는 워드마크 `FinSight` + `--fs-accent` 도트로 렌더한다. 마크를 지어내지 마라.

## 11. 프로토타입 확인

```bash
# design/prototype/index.html 을 브라우저로 연다 (별도 빌드 불필요)
```
랜딩 → Google 로그인 → 업로드 → 자동 판별 → 분석 → 무료 리포트 → 결제 → 전체 열람이 클릭으로 돌아간다. 우상단 토글로 다크 모드를 확인한다.

**프로토타입은 시각 참조이지 구현 참조가 아니다.** `data.js`는 목 데이터이고, 산술은 프로덕션에서 서버 TypeScript가 한다(ADR-004).

color-block 대비는 라이트/다크가 동일하다 — lime 16.9:1 · navy 15.7:1 · coral 12.4:1 (WCAG AAA 기준 7:1). 이 값이 무너지면 `ColorBlock`이 `--color-block-ink` 대신 `--color-ink`를 읽고 있는 것이다.
