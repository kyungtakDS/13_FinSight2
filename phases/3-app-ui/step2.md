# Step 2: uploads-history

## 목적

과거 업로드 목록을 만들고 `/dashboard` 페이지를 완성한다.

목록은 **기간과 거래 수로 식별한다**(PRD UC-10). 파일명은 보조 정보다 — 사용자가 `카드내역.csv`를 세 번 올렸으면 파일명으로는 구분이 안 된다.

## 이전 Step과의 의존성

- **step 0 (`app-shell`)** — 셸 + 디자인 규율 공통 테스트
- **step 1 (`upload-dropzone`)** — `Dropzone`·`EmptyState`. 이 페이지가 둘을 조립한다
- **Phase 2 step 2 (`uploads-ingest`)** — `GET /api/uploads` 응답 형태
- **Phase 0 step 4** — `lib/supabase/server.ts`의 `createClient`/`getUser` (페이지가 서버에서 읽는다)

## 읽어야 할 파일

- `/docs/DESIGN.md` — §6의 `/dashboard` · §5 · §7(빈 상태) · §8(숫자 표기) · §9
- `/docs/PRD.md` — UC-10 · UC-11 · §구독 종료 후 접근 정책(무료 화면은 과거 분석 전부에 계속 열린다)
- `/docs/ARCHITECTURE.md` — §패턴(페칭은 페이지가 한다) · §분석은 비동기 잡이다
- `/src/components/upload/**` — step 1 산출물
- `/src/app/api/uploads/route.ts` — GET 응답 형태
- `/src/styles/theme.css` — `.fs-card` · `.fs-table` · `.fs-tablewrap` · `.fs-chip` · `.num`

## 구현 범위

```
src/components/upload/UploadList.tsx  — 목록. 데이터는 props
src/app/dashboard/page.tsx            — 서버에서 읽어 조립 (자리표시를 대체)
```

## 수정 대상 파일

```
src/components/upload/UploadList.tsx       (신규)
src/components/upload/UploadList.test.tsx  (신규 — 먼저)
src/app/dashboard/page.tsx                 (수정 — Phase 0 step 5의 자리표시를 대체. tdd-guard 면제)
```

## 먼저 작성할 테스트

### `UploadList` — props로만 받는다
1. **`uploads` 배열을 props로 받는다.** 스스로 fetch하지 않는다 — `global.fetch`를 spy해서 호출 0회를 assert하라
2. 빈 배열이면 `EmptyState`를 렌더한다 (또는 부모가 그렇게 하도록 `null`을 반환하고 그 계약을 테스트)

### 식별 정보
3. 각 항목이 **기간(`period_start`~`period_end`)과 거래 수**로 식별된다
4. 기간이 `null`인 항목(분석 중이라 아직 모름)은 그 사실을 표시한다. `1970-01-01` 같은 값을 만들지 마라
5. 거래 수가 `.num`(tabular-nums)이다
6. 파일명은 보조 정보로 표시된다 (있으면)

### 상태 표시
7. `processing` 항목에 진행 중 표시가 있다. **퍼센트가 없다**(DESIGN.md §7)
8. `completed` 항목이 리포트로 링크된다 (`/dashboard/uploads/{id}`)
9. `failed` 항목이 실패임을 표시하고, **고정 어휘 7개 문구**를 쓴다 (step 1의 매핑 재사용)
10. `expires_at`이 지난 항목이 "원본 만료"를 표시한다 — 리포트는 열리지만 재시도가 안 된다는 사실을 사용자가 알아야 한다(ADR-005)

### 삭제
11. 삭제 버튼에 `aria-label`이 있다
12. 삭제는 **확인 단계를 거친다**. `window.confirm`을 쓰지 마라 — 인라인 확인 UI로. 이유: 브라우저 모달은 스타일이 안 맞고 테스트가 어렵다
13. 확인하면 `DELETE /api/uploads/{id}`를 부른다
14. 삭제 성공 시 목록에서 사라진다
15. 삭제 실패 시 고정 어휘 문구를 보여주고 항목이 남는다

### 접근성·표
16. 표를 쓴다면 `<th scope>`를 갖춘 실제 `<table>`이다. **div로 표를 흉내 내지 마라**(DESIGN.md §9)
17. 표가 `.fs-tablewrap`(가로 스크롤) 안에 있다

### 페이지 조립
18. `/dashboard`가 서버에서 업로드 목록을 읽어 props로 넘긴다
19. 0건이면 `EmptyState`가 나온다
20. `Dropzone`이 항상 위에 있다 (0건이든 아니든 다음 행동은 업로드다)

### 디자인 규율
21. step 0 공통 테스트를 이 step의 파일 목록으로 재사용

## Codex 실행 지시문

### 페칭은 페이지가 한다

ARCHITECTURE.md §패턴: *"차트·리포트 컴포넌트는 데이터를 props로 받는다. 페칭은 페이지가 한다."*

`src/app/dashboard/page.tsx`는 Server Component다. `lib/supabase/server.ts`로 세션을 읽고 업로드 목록을 조회해 `UploadList`에 넘긴다.

**클라이언트에서 `GET /api/uploads`를 부르지 마라.** 그 라우트는 필요할 때(폴링·삭제 후 갱신) 쓰이는 것이고, 초기 렌더는 서버가 한다.

### `processing` 항목의 갱신

목록에 `processing` 항목이 있으면 사용자는 그게 끝나는 걸 보고 싶어한다. 하지만 **목록 페이지에서 폴링을 돌리지 마라** — 리포트 페이지(step 3)가 폴링 대상이다.

목록에서는 `processing` 항목을 클릭하면 리포트 페이지로 가고, 거기서 폴링이 돈다. 목록 자체는 새로고침으로 갱신된다. 이유: 폴링 지점이 둘이면 요청이 두 배가 되고, 사용자가 실제로 기다리는 화면은 리포트 쪽이다.

### 기간이 없는 항목

분석 중이면 `period_start`/`period_end`가 `null`이다. **가짜 값을 만들지 마라.** "분석 중"으로 표시하고 기간 칸은 비운다.

### 만료 표시

`expires_at < now()`이면 "원본 만료 — 재시도 불가"를 표시한다. ADR-005: *"90일이 지나면 재시도가 불가능해지므로 UI가 그 사실을 말해야 한다."*

**리포트 자체는 열린다.** 만료된 것은 원본 파일뿐이다.

### 삭제 확인은 인라인으로

`window.confirm`을 쓰지 마라. 브라우저 모달은 스타일이 안 맞고, jsdom 테스트에서 stub이 필요하고, DESIGN.md의 `.fs-scrim`/`.fs-modal` 스펙이 이미 있다.

삭제는 **DB 행 + Storage 원본이 함께 사라진다**는 것을 문구로 알려라(PRD UC-11).

### 숫자 표기

금액·거래 수에 `.num`. 기간은 `toLocaleString('ko-KR')` 기반 날짜 포맷.

### 무료/유료 구분이 없다

목록은 무료 화면이다. 구독이 끝나도 **과거 분석 전부에 대해 계속 열린다**(PRD §구독 종료 후 접근 정책). 목록에 잠금 표시를 넣지 마라.

## 완료 조건

- `UploadList` + `/dashboard` 페이지가 존재하고 21개 테스트가 전부 통과한다
- `UploadList`가 fetch하지 않는다
- 기간·거래 수로 식별한다
- 진행률 퍼센트가 없다
- 만료 항목이 재시도 불가를 말한다
- `window.confirm`을 쓰지 않는다
- 표가 실제 `<table>`이다
- 디자인 규율 공통 테스트 통과
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/components/upload/UploadList.test.tsx
```

직접 확인:

```bash
grep -n "window.confirm\|confirm(" src/components/upload/UploadList.tsx && echo "FAIL" || echo "OK"
grep -nE "fetch\(|useEffect.*setInterval" src/components/upload/UploadList.tsx && echo "확인 필요: 컴포넌트가 페칭/폴링" || echo "OK"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md §패턴 — 페칭은 페이지가, 컴포넌트는 props로만 받는가?
   - ADR-005 — 만료 표시가 재시도 불가 사유를 말하는가?
   - ADR-008 — 목록이 구독 상태와 무관하게 열리는가?
   - DESIGN.md §7 — 빈 상태가 다음 행동을 말하는가? 진행률 퍼센트가 없는가?
   - DESIGN.md §8·§9 — `.num`, 실제 `<table>`, `aria-label`
   - 새 라우트를 만들지 않았는가?
3. 결과에 따라 `phases/3-app-ui/index.json`의 step 2를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "components/upload/UploadList.tsx(props 전용) + dashboard/page.tsx가 서버에서 목록을 읽어 조립. 기간·거래 수로 식별, processing은 퍼센트 없이 표시(폴링은 리포트 페이지 소관), 만료 항목은 '재시도 불가' 표시, 삭제는 인라인 확인 후 DELETE. 실제 table + .fs-tablewrap")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단

## commit 기준

`feat(3-app-ui): step 2 — uploads-history`

포함: `src/components/upload/UploadList.{tsx,test.tsx}` · `src/app/dashboard/page.tsx`

## 금지사항

- **컴포넌트가 스스로 페칭하게 하지 마라.** 이유: 같은 컴포넌트를 테스트가 픽스처로 렌더해야 한다(ARCHITECTURE.md §패턴).
- **목록 페이지에서 폴링을 돌리지 마라.** 이유: 폴링 지점이 둘이면 요청이 두 배가 되고, 사용자가 실제로 기다리는 화면은 리포트 쪽이다.
- **진행률 퍼센트를 만들지 마라.** 이유: 서버는 3상태만 준다. 근거 없는 숫자다(DESIGN.md §7).
- **기간이 `null`일 때 가짜 값을 만들지 마라.**
- **`window.confirm`을 쓰지 마라.** 이유: 스타일이 안 맞고 테스트가 어렵다. `.fs-scrim`/`.fs-modal` 스펙이 이미 있다.
- **div로 표를 흉내 내지 마라.** 이유: 세무사에게 넘기는 자료라 복사·스크린리더가 실제로 쓰인다(DESIGN.md §9).
- **목록에 잠금 표시를 넣지 마라.** 이유: 목록은 무료 화면이고 구독이 끝나도 계속 열린다(ADR-008).
- **여러 업로드를 합산한 요약·시계열을 만들지 마라.** 이유: 리포트의 단위는 업로드 1건이고, 합산은 MVP 제외다(ADR-014).
- **raw hex·raw px·이모지·파스텔 블록을 쓰지 마라.**
- **새 라우트를 만들지 마라.**
- 기존 테스트를 깨뜨리지 마라.
