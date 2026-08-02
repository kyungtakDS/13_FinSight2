# Step 1: upload-dropzone

## 목적

`/dashboard`의 업로드 위젯 — 드롭존과 **자동 판별 결과 카드**를 만든다.

카드사마다 다른 양식을 사용자가 맞춰줄 필요가 없다는 것이 이 제품의 약속이다(PRD UC-04). 파일을 고른 직후 "우리가 이 파일을 읽었다"를 보여주는 카드가 그 약속의 증거다.

**빈 상태를 먼저 만든다.** 업로드 0건인 대시보드가 다음 행동을 알려주지 못하면 실패다(DESIGN.md §7).

## 이전 Step과의 의존성

- **step 0 (`app-shell`)** — 셸과 **디자인 규율 공통 테스트**. 그 step의 `summary`에 경로가 있다
- **Phase 0 step 1** — `theme.css`의 `.fs-drop`·`.fs-detect-row`·`.fs-card`
- **Phase 1 step 0 (`csv-normalize`)** — 인코딩 판별의 아이디어. **`normalize.ts`를 클라이언트에서 import하지 마라** (아래 지시문)
- **Phase 2 step 2 (`uploads-ingest`)** — `POST /api/uploads`의 응답 형태(202 `{id}` · 409 `{error, existingUploadId}`)

## 읽어야 할 파일

- `/docs/DESIGN.md` — §6의 `/dashboard` 조립 · §5(앱 컴포넌트) · §7(반드시 설계하는 상태) · §9 · §10
- `/design/prototype/flow.jsx` — `UploadScreen` 시각 참조
- `/src/styles/theme.css` — `.fs-drop` · `.fs-detect-row` · `.fs-card` 스펙
- `/docs/PRD.md` — §제약(CSV only, 2MB / 3,000행) · UC-04
- `/docs/ADR.md` — ADR-010(CSV only, 명확한 거부 + 변환 안내)
- `/src/app/api/uploads/route.ts` — 응답 계약
- `/phases/PLAN.md` — **D-7(`src/lib/csv/preview.ts`가 승인된 추가 파일인 이유)**

## 구현 범위

```
src/lib/csv/preview.ts              — 브라우저에서 도는 가벼운 판별. 의존성 없음
src/components/upload/Dropzone.tsx  — 드롭존 + 파일 선택 + 업로드
src/components/upload/DetectCard.tsx — 자동 판별 결과 카드
src/components/upload/EmptyState.tsx — 업로드 0건 안내
```

## 수정 대상 파일

```
src/lib/csv/preview.ts                     (신규)
src/lib/csv/preview.test.ts                (신규 — 먼저)
src/components/upload/Dropzone.tsx         (신규)
src/components/upload/Dropzone.test.tsx    (신규 — 먼저)
src/components/upload/DetectCard.tsx       (신규)
src/components/upload/DetectCard.test.tsx  (신규 — 먼저)
src/components/upload/EmptyState.tsx       (신규)
src/components/upload/EmptyState.test.tsx  (신규 — 먼저)
```

## 먼저 작성할 테스트

### `preview.ts` — 브라우저 안전성
1. **`iconv-lite`·`papaparse`를 import하지 않는다.** 소스를 읽어 검사하라. 이유는 아래 지시문
2. `Buffer`를 참조하지 않는다
3. UTF-8 파일 → `'utf-8'`, cp949 파일 → `'cp949'`
4. 행 수를 센다 (개행 기준, 마지막 빈 줄 제외)
5. 헤더 후보 행의 컬럼 라벨들을 뽑아 반환한다 (있으면)
6. 2MB 초과·비 CSV에 대해 판별을 시도하지 않고 이유를 반환한다
7. 파일 내용을 **어디에도 저장하거나 전송하지 않는다** — 순수 계산만

### `Dropzone`
8. `.csv` 아닌 파일을 놓으면 **거부 문구 + 변환 안내**를 보여준다 (ADR-010: "엑셀에서 CSV로 저장하는 법"). 서버를 부르지 않는다
9. 2MB 초과면 거부 문구를 보여주고 서버를 부르지 않는다
10. 유효한 CSV를 고르면 `DetectCard`가 나타난다
11. **"분석 시작"을 눌러야** `POST /api/uploads`를 부른다 — 파일 선택만으로 업로드하지 않는다
12. 202 응답이면 `/dashboard/uploads/{id}`로 이동한다
13. **409면 "이미 분석한 파일입니다" 안내 + 기존 분석으로 가는 링크**를 보여준다 (`existingUploadId` 사용)
14. 그 외 에러면 **고정 어휘 7개에 대응하는 문구**만 보여준다. 서버 응답의 다른 문자열을 화면에 그대로 띄우지 않는다
15. 업로드 중에는 버튼이 disabled다 (이중 제출 방지)
16. 키보드로 파일 선택이 가능하다 (드롭존이 `<input type="file">`을 감싸고 label로 연결)
17. 드롭존에 접근 가능한 이름이 있다

### `DetectCard`
18. **데이터를 props로만 받는다** — 스스로 파일을 읽지 않는다
19. 카드사·인코딩·행 수·컬럼 매핑·민감정보 제거를 `.fs-detect-row`로 표시한다
20. 카드사를 판별할 수 없으면 그 항목을 **"서버에서 판별"로 표시**한다. 지어내지 마라
21. "카드번호·승인번호는 저장하지 않습니다" 문구가 있다 (PRD의 데이터 처리 원칙을 화면이 말한다)
22. 행 수가 `.num`(tabular-nums)으로 표시된다

### `EmptyState`
23. 업로드 0건일 때 **다음 행동**을 말한다: 업로드 안내 + 카드사별 CSV 내려받는 법
24. **빈 차트를 그리지 않는다** — 차트 요소가 렌더되지 않음을 검사하라
25. CSV 전용·2MB·3,000행 제약을 명시한다

### 디자인 규율
26. step 0의 공통 테스트를 이 step의 파일 목록으로 재사용한다 (raw hex·raw px·weight·이모지·`--color-block-*` 부재)

## Codex 실행 지시문

### `preview.ts`는 브라우저 전용 — `normalize.ts`를 재사용하지 마라

`src/lib/csv/normalize.ts`는 `iconv-lite`(→ `Buffer`)와 `papaparse`를 import한다. 클라이언트 컴포넌트에서 그걸 import하면 **번들에 Node 폴리필이 딸려 들어온다.**

브라우저에는 `TextDecoder('euc-kr')`가 내장돼 있다. cp949 확장 음절이 일부 깨질 수 있지만 **이 카드는 안내용이고 서버 판정이 권위다** — 정확도가 아니라 "우리가 이 파일을 읽었다"를 보여주는 것이 목적이다.

```ts
export interface CsvPreview {
  encoding: 'utf-8' | 'cp949';
  rowCount: number;
  headerLabels: string[] | null;   // 판별 실패 시 null
  issuerHint: string | null;       // 상단 메타에서 카드사명이 읽히면. 아니면 null
}
export function previewCsv(text: string): CsvPreview;
export function decodeForPreview(bytes: ArrayBuffer): { text: string; encoding: 'utf-8' | 'cp949' };
```

**의존성 0개로 만들어라.** 콤마 분리는 대충 해도 된다 — 라벨 표시용이다.

### 자동 판별 카드는 안내다, 판정이 아니다

서버가 `csv_format_mappings` + LLM으로 확정한다. 클라이언트 판별과 다를 수 있다. **"판별했습니다"가 아니라 "이렇게 읽었습니다"의 톤으로 쓰고, 모르는 항목은 "서버에서 판별"로 남겨라.** 지어내면 그게 틀렸을 때 신뢰가 깨진다.

### 파일 선택 ≠ 업로드

파일을 고르면 판별 카드를 보여주고, **"분석 시작"을 눌러야** 업로드한다. 이유: 사용자가 자기 파일이 맞는지 확인할 기회를 준다. 프로토타입(`flow.jsx`)의 흐름이 그렇다.

### 거부 문구는 다음 행동을 말한다

ADR-010: *"거부 문구가 다음 행동(엑셀 → CSV 저장)을 알려주는지가 검토 기준이 된다."*

`XLSX는 지원하지 않습니다`로 끝내지 마라. **어떻게 CSV로 바꾸는지** 한 줄 덧붙여라.

### 에러 문구는 고정 어휘 7개에서만

DESIGN.md §7: *"실패 문구는 고정 어휘 7개에서만 나온다. 예외 메시지·SQL 에러·모델 원문을 화면에 띄우지 마라."*

`error` 코드 → 한국어 문구 매핑을 한 곳에 두어라 (`src/components/upload/` 안이든 공용이든, **한 곳**). Phase 3 step 3의 실패 화면도 같은 매핑을 쓴다.

### 빈 상태를 먼저 만들어라

DESIGN.md §7: *"빈 상태를 먼저 만든다. … **데이터가 없을 때 빈 차트를 그리지 마라.**"*

`EmptyState`를 나중에 붙이지 말고 이 step에서 완성하라.

### 이 컴포넌트들은 클라이언트 컴포넌트다

`'use client'`. 파일 API·드래그 이벤트가 필요하다.

**서버 데이터를 여기서 페칭하지 마라** — 업로드 목록은 다음 step이 페이지에서 읽어 넘긴다.

## 완료 조건

- 4개 파일 + 테스트가 존재하고 26개 항목이 전부 통과한다
- `preview.ts`가 의존성 0개이고 `Buffer`를 안 쓴다
- 파일 선택만으로 업로드되지 않는다
- 409에서 기존 분석 링크를 보여준다
- 에러 문구가 고정 어휘 7개 매핑에서만 나온다
- 빈 상태가 다음 행동을 말하고 빈 차트가 없다
- 디자인 규율 공통 테스트 통과
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/lib/csv/preview.test.ts src/components/upload
```

직접 확인:

```bash
grep -nE "iconv-lite|papaparse|Buffer" src/lib/csv/preview.ts && echo "FAIL: 브라우저 안전하지 않음" || echo "OK"
grep -rnE "#[0-9a-fA-F]{3,8}\b|\b[0-9]+px\b" src/components/upload/*.tsx && echo "FAIL" || echo "OK"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md §패턴 — 컴포넌트가 데이터를 props로 받는가? 클라이언트에서 Supabase service role·Claude를 부르지 않는가?
   - ADR-010 — CSV only 거부 문구가 다음 행동을 알려주는가?
   - DESIGN.md §6·§7 — 드롭존 → 판별 카드 → 분석 시작 흐름인가? 빈 상태가 있고 빈 차트가 없는가?
   - DESIGN.md §10 — raw hex·raw px·이모지·앱에 파스텔 없는가?
   - 에러 문구가 고정 어휘 7개인가?
3. 결과에 따라 `phases/3-app-ui/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "lib/csv/preview.ts(의존성 0, 브라우저 TextDecoder) + components/upload/{Dropzone,DetectCard,EmptyState}.tsx. 파일 선택→판별 카드→'분석 시작'에서만 POST, 409면 기존 분석 링크, 에러 문구는 고정 어휘 7개 매핑(경로: <파일>) — Phase 3 step 3이 재사용")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단
4. `summary`에 **에러 코드 → 문구 매핑 파일의 경로**를 남겨라 — step 3이 재사용한다.

## commit 기준

`feat(3-app-ui): step 1 — upload-dropzone`

포함: `src/lib/csv/preview.{ts,test.ts}` · `src/components/upload/**`

## 금지사항

- **클라이언트 컴포넌트에서 `lib/csv/normalize.ts`를 import하지 마라.** 이유: `iconv-lite`가 `Buffer`에 의존해 번들에 Node 폴리필이 딸려 들어온다.
- **클라이언트 판별 결과를 서버 판정처럼 단언하지 마라.** 이유: 서버가 `csv_format_mappings` + LLM으로 확정한다. 지어낸 판별이 틀리면 신뢰가 깨진다.
- **파일 선택만으로 업로드하지 마라.** 이유: 사용자가 자기 파일이 맞는지 확인할 기회를 준다.
- **서버 에러 메시지를 화면에 그대로 띄우지 마라.** 이유: 고정 어휘 7개뿐이다(DESIGN.md §7).
- **빈 상태에 빈 차트를 그리지 마라.** 이유: 데이터가 없을 때 차트는 정보가 아니라 소음이다.
- **XLSX·PDF 파서를 붙이지 마라.** 이유: MVP는 CSV only이고 명확한 거부 + 변환 안내가 정답이다(ADR-010).
- **클라이언트에서 Claude·Polar·Supabase service role을 부르지 마라.** 이유: AGENTS.md CRITICAL.
- **파일 내용을 localStorage·sessionStorage에 저장하지 마라.** 이유: 카드 명세서다.
- **진행률 퍼센트를 만들지 마라** — 이 step에는 진행 화면이 없지만, 업로드 진행 표시도 indeterminate로 둔다.
- **raw hex·raw px·이모지·파스텔 블록을 쓰지 마라.**
- **업로드 목록을 여기서 페칭하지 마라** — 다음 step이다.
- 기존 테스트를 깨뜨리지 마라.
