# Step 4: report-summary

## 목적

리포트의 **요약 영역**을 만든다 — 사용자가 "내 돈 얼마"라는 자기 숫자를 보는 화면이다.

이 화면이 전환의 전부다. ADR-007: *"사용자가 '내 돈 47만원'이라는 자기 숫자를 본 뒤에 결제하게 되므로, 랜딩 페이지가 혼자 설득을 다 짊어질 필요가 없다."*

무료 사용자도 **이 영역은 전부 본다.** 잠기는 것은 거래 표와 다운로드다(step 5 · Phase 5).

조립 순서(DESIGN.md §6):
```
헤더("이 리포트는 파일 1개 기준입니다")
→ 절감액 히어로 (--fs-accent-soft 카드, .fs-metric-big, "예상 절감액(참고용)")
→ 지표 3개 (경비 후보 / 개인 지출 / 애매)
→ 애매 배너
→ 인사이트 카드 (무료 3개 / Pro 전체)
→ 계정과목 도넛
```

## 이전 Step과의 의존성

- **step 0 (`app-shell`)** — 셸 + 디자인 규율 공통 테스트
- **step 3 (`analysis-status`)** — `dashboard/uploads/[id]/page.tsx`의 `completed` 분기 자리표시. 이 step이 채운다
- **Phase 1 step 6 (`aggregate`)** — `UploadSummary`의 형태
- **Phase 2 step 0 (`gate`)** — `GatedReport`. 무료면 `insights`가 이미 3개로 잘려서 온다
- **Phase 2 step 3 (`uploads-detail`)** — 응답 형태

## 읽어야 할 파일

- `/docs/DESIGN.md` — **§6의 `completed` 조립** · §2(앱 타입 스케일 · `--fs-chart-1..6` · 판정 3값 색) · §5 · §7 · **§8(숫자 표기)** · §9
- `/design/prototype/report.jsx` — 시각 참조
- `/src/styles/theme.css` — `.fs-card` `.fs-metric` `.fs-metric-big` `.fs-donut` `.fs-legend-row` `.fs-chip` `.fs-eyebrow` `.fs-disclaimer` `.num` 스펙
- `/docs/PRD.md` — §분류 실패 처리(애매 n건을 숨기지 않는다) · §중복 거래 처리(리포트는 파일 1개 기준)
- `/docs/ADR.md` — ADR-004 · ADR-011(포지셔닝) · ADR-013 · ADR-014
- `/src/types/report.ts` · `/src/types/account-codes.ts`

## 구현 범위

```
src/components/report/ReportHeader.tsx     — "이 리포트는 파일 1개 기준입니다" + 기간
src/components/report/SavingsHero.tsx      — 절감액 히어로
src/components/report/MetricRow.tsx        — 지표 3개
src/components/report/UncertainBanner.tsx  — 애매 n건
src/components/report/InsightList.tsx      — 인사이트 카드
src/components/report/AccountDonut.tsx     — 계정과목 도넛 (3건 이하면 표)
src/components/report/Disclaimer.tsx       — 세무 고지
```

**전부 데이터를 props로만 받는다.** 페칭은 페이지가 한다.

## 수정 대상 파일

위 7개 + 각각의 `.test.tsx` + `src/app/dashboard/uploads/[id]/page.tsx`(수정 — `completed` 분기 조립).

## 먼저 작성할 테스트

### 공통 — props 전용
1. 7개 컴포넌트 전부 **fetch하지 않는다** (`global.fetch` spy 호출 0회)
2. 전부 픽스처만으로 렌더된다

### `ReportHeader`
3. **"이 리포트는 파일 1개 기준입니다"** 취지의 문구가 있다. 이유: 사용자가 리포트 2개를 손으로 더하면 중복이 된다(PRD §중복 거래 처리)
4. 기간(`period_start`~`period_end`)과 거래 수를 표시한다
5. 거래 수가 `.num`이다

### `SavingsHero` ← 자기 숫자
6. `estimatedSaving`을 `.fs-metric-big` + `.num`으로 표시한다
7. **"예상 절감액(참고용)"** 문구다. `절감액`·`환급액` 단독으로 쓰지 않는다(ADR-011)
8. `₩` 기호가 숫자보다 작게(0.6em) 온다(DESIGN.md §8)
9. `toLocaleString('ko-KR')`로 세 자리 구분된다
10. 세율 근거를 말한다 — `taxRate`를 받아 "최저 세율 기준 보수적 추정" 취지로
11. **단정적 지시 문구가 없다** — `환급받으세요`·`경비 처리하세요` 부재를 검사하라
12. 배경이 `--fs-accent-soft`, 테두리가 `--fs-accent-line`이다 (raw hex 아님)

### `MetricRow`
13. 지표가 정확히 3개다: 경비 후보 / 개인 지출 / 애매
14. 각 금액이 `.num`이다
15. 판정 3값의 색이 **고정 대응**이다 — `expense`→`--fs-biz`, `personal`→`--fs-personal`, `uncertain`→`--fs-unsure`(DESIGN.md §2 표)
16. **`애매`가 빨강이 아니다** — 경고색 토큰을 쓰지 않음을 검사하라. 애매는 오류가 아니라 보류다

### `UncertainBanner` ← 숨기지 않는다
17. `uncertainCount > 0`이면 **항상** 렌더된다
18. 건수가 표시된다
19. **"세무사에게 따로 확인하세요"** 취지의 문구가 있다(DESIGN.md §7)
20. `uncertainCount === 0`이면 렌더되지 않는다
21. 배너를 접거나 숨기는 UI가 없다

### `InsightList`
22. props로 받은 인사이트를 **그대로** 렌더한다. 자르지 않는다 (자르는 것은 서버의 gate다)
23. 무료(3개)와 유료(전체) 둘 다 같은 컴포넌트로 렌더된다 — 픽스처 2개로 테스트
24. 인사이트가 0개면 빈 상태 문구를 보여준다. 빈 카드를 그리지 않는다

### `AccountDonut` ← 3건 이하면 표
25. `accounts`를 도넛으로 그린다
26. **거래가 3건 이하면 도넛 대신 표로 대체한다**(DESIGN.md §7 · PRD)
27. `accounts`가 비면 **아무것도 그리지 않는다** — 빈 차트 금지(DESIGN.md §7)
28. 색이 `--fs-chart-1..6`을 **금액 내림차순 순위대로** 배정한다. 7번째부터 순환한다(DESIGN.md §2)
29. 범례 금액이 `.num`이다
30. 모바일에서 컨테이너 폭 기준이다 (고정 px 폭이 없음을 검사)
31. 도넛에 **`애매` 조각이 없다** — `aggregate`가 이미 제외했지만, 컴포넌트도 받은 데이터를 그대로 믿고 그리므로 픽스처에 uncertain을 섞어 넣어 무시되는지 검사하라

### `Disclaimer`
32. **"본 서비스는 세무 자문이 아니며 최종 판단은 세무대리인과 상의하십시오"**가 있다(ADR-011)
33. `.fs-disclaimer` 클래스를 쓴다

### 접근성
34. 도넛에 대체 텍스트 또는 인접한 표가 있다 — SVG만 있으면 스크린리더가 아무것도 못 읽는다
35. 아이콘 전용 버튼에 `aria-label`

### 디자인 규율
36. step 0 공통 테스트 재사용

## Codex 실행 지시문

### 숫자 표기 — DESIGN.md §8을 그대로 따르라

- 금액에는 **반드시 `.num`**(tabular-nums). 표·지표·도넛 범례 전부. *"자릿수가 흔들리면 금융 도구로 보이지 않는다."*
- `₩` 기호는 숫자보다 작게(0.6em), 세 자리 구분은 `toLocaleString('ko-KR')`
- 취소·부분취소는 음수 부호 보존 (`-₩8,900`) + `--fs-unsure` 색

포맷 함수를 **한 곳에 두어라** — step 5의 거래 표도 같은 함수를 쓴다. `src/components/report/format.ts` 같은 곳에.

### 문구 규칙 — ADR-011

써도 되는 것: **"경비 처리 가능성이 높은 항목"** · **"예상 절감액(참고용)"**
쓰면 안 되는 것: `경비 처리하세요` · `환급받으세요` · `신고하세요` — 단정적 지시는 무자격 세무자문으로 해석될 여지가 있다.

### 애매는 앰버, 빨강이 아니다

DESIGN.md §2: *"**`애매`를 경고색(빨강)으로 칠하지 마라.** 이유: 애매는 오류가 아니라 보류다. 앰버는 '확인 필요'를 뜻하고, 빨강은 사용자가 뭔가 잘못했다는 신호가 된다."*

`--fs-unsure`/`--fs-unsure-soft`를 쓴다.

### 도넛 색은 금액 내림차순 순위대로

`aggregate`가 이미 내림차순 정렬해서 준다(Phase 1 step 6). **컴포넌트가 다시 정렬하지 마라** — 서버 정렬을 믿고 인덱스로 색을 고른다.

```tsx
const color = `var(--fs-chart-${(i % 6) + 1})`;
```

### 차트 라이브러리를 도입하지 마라

도넛 하나에 recharts·chart.js를 넣지 마라. **SVG `<circle>`의 `stroke-dasharray`로 충분하다.** 의존성이 늘면 번들이 커지고 토큰 색을 주입하기도 번거로워진다.

`design/prototype/report.jsx`의 `.fs-donut`이 이미 그 방식일 것이다 — 확인하고 따르라.

### 빈 차트를 그리지 마라

DESIGN.md §7: *"데이터가 없을 때 빈 차트를 그리지 마라."* `accounts`가 비면 `null`을 반환하거나 문구로 대체한다.

### 인사이트를 컴포넌트가 자르지 마라

무료 절단은 서버(`lib/gate.ts`)가 이미 했다. 여기서 또 자르면 **유료 사용자도 3개만 본다.**

받은 배열을 그대로 렌더하라.

### 페이지 조립

`src/app/dashboard/uploads/[id]/page.tsx`의 `completed` 분기를 채운다. 서버에서 `gateReport` 결과를 받아 props로 뿌린다.

거래 표(step 5)는 아직 없다. **자리표시를 남기고 step 5가 채운다.**

## 완료 조건

- 7개 컴포넌트 + 테스트가 존재하고 36개 항목이 전부 통과한다
- 전부 props로만 받는다
- 금액에 `.num`이 붙는다
- 단정적 지시 문구가 없다
- 애매가 빨강이 아니고 배너가 항상 보인다
- 3건 이하면 도넛 대신 표
- 빈 데이터에 빈 차트를 안 그린다
- 차트 라이브러리 의존성이 없다
- 세무 고지가 있다
- 디자인 규율 공통 테스트 통과
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/components/report
```

직접 확인:

```bash
grep -rnE "경비 처리하세요|환급받으세요|신고하세요" src/components/report/ && echo "FAIL: 단정적 지시" || echo "OK"
grep -rn "세무 자문" src/components/report/Disclaimer.tsx || echo "FAIL: 고지 없음"
grep -rnE "recharts|chart\.js|victory|nivo" package.json && echo "FAIL: 차트 라이브러리" || echo "OK"
grep -rnE "#[0-9a-fA-F]{3,8}\b|\b[0-9]+px\b" src/components/report/*.tsx && echo "FAIL" || echo "OK"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md §패턴 — 차트·리포트 컴포넌트가 데이터를 props로만 받는가?
   - ADR-004 — 컴포넌트가 산술을 하지 않는가? (합계·구성비를 다시 계산하지 않는가)
   - ADR-011 / DESIGN.md §8 — 단정적 지시 없고 세무 고지가 있는가?
   - ADR-013 / DESIGN.md §7 — 애매 n건이 항상 보이는가?
   - DESIGN.md §2 — 판정 3값 색이 고정 대응인가? 도넛 색이 금액 내림차순인가?
   - DESIGN.md §7 — 빈 차트를 안 그리는가? 3건 이하면 표인가?
   - DESIGN.md §10 — raw hex·raw px·이모지·파스텔 없는가?
3. 결과에 따라 `phases/3-app-ui/index.json`의 step 4를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "components/report/{ReportHeader,SavingsHero,MetricRow,UncertainBanner,InsightList,AccountDonut,Disclaimer}.tsx + format.ts(금액 포맷 공용 — step 5도 사용). 전부 props 전용, SVG stroke-dasharray 도넛(라이브러리 없음, --fs-chart-1..6 순환), 3건 이하면 표, 빈 데이터면 미렌더, 애매 배너 상시 노출, 세무 고지. page.tsx의 completed 분기 조립 — 거래 표 자리는 step 5")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단
4. `summary`에 **금액 포맷 함수의 경로**를 남겨라 — step 5가 재사용한다.

## commit 기준

`feat(3-app-ui): step 4 — report-summary`

포함: `src/components/report/**`(step 3 파일 제외) · `src/app/dashboard/uploads/[id]/page.tsx`

## 금지사항

- **컴포넌트가 산술을 하지 마라.** 이유: 합계·구성비·절감액은 서버가 계산해 `summary`로 준다. 컴포넌트가 다시 계산하면 두 숫자가 갈라진다(ADR-004).
- **인사이트를 컴포넌트에서 자르지 마라.** 이유: 절단은 서버 게이트가 이미 했다. 또 자르면 유료 사용자도 3개만 본다.
- **`애매`를 빨강으로 칠하지 마라.** 이유: 애매는 오류가 아니라 보류다.
- **애매 배너를 접거나 숨기지 마라.** 이유: 사용자가 그 n건을 세무사에게 따로 물을 수 있어야 한다.
- **단정적 지시 문구를 쓰지 마라.** 이유: 무자격 세무자문으로 해석될 여지가 생긴다(ADR-011).
- **세무 고지를 빼지 마라.**
- **빈 데이터에 빈 차트를 그리지 마라.**
- **차트 라이브러리를 도입하지 마라.** 이유: 도넛 하나에 의존성을 늘릴 이유가 없고 토큰 색 주입이 번거로워진다.
- **도넛 데이터를 컴포넌트에서 재정렬하지 마라.** 이유: 서버가 금액 내림차순으로 준 것이 색 배정의 근거다.
- **거래 표를 여기서 만들지 마라** — step 5다.
- **여러 업로드를 합산한 시계열 차트를 만들지 마라.** 이유: MVP 제외다(ADR-014).
- **raw hex·raw px·이모지·파스텔 블록을 쓰지 마라.**
- 기존 테스트를 깨뜨리지 마라.
