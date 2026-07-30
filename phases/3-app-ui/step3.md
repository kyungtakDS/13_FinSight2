# Step 3: analysis-status

## 목적

`/dashboard/uploads/:id`의 **세 상태 중 두 개**를 만든다: `processing`과 `failed`. `completed`(리포트 본문)는 step 4·5다.

라우트는 하나이고 `uploads.status`로 분기한다(DESIGN.md §6). 화면을 나누지 않는다.

두 가지가 이 step의 핵심이다:

1. **진행률을 지어내지 마라.** 서버는 `processing | completed | failed` 3상태만 준다. `.fs-step` 단계 리스트는 *무엇을 하는 중인지* 설명하는 장치이고, 진행바는 **indeterminate**다
2. **"탭을 닫아도 분석은 서버에서 계속됩니다."** 브라우저는 분석의 주체가 아니다(ARCHITECTURE.md)

## 이전 Step과의 의존성

- **step 0 (`app-shell`)** — 셸 + 디자인 규율 공통 테스트
- **step 1 (`upload-dropzone`)** — **에러 코드 → 문구 매핑**. 그 step의 `summary`에 경로가 있다. 재사용하라
- **Phase 2 step 3 (`uploads-detail`)** — `GET /api/uploads/[id]` 응답 형태 (폴링 대상)
- **Phase 2 step 4 (`uploads-retry`)** — `POST .../retry` 응답의 `retriesLeft`

## 읽어야 할 파일

- `/docs/DESIGN.md` — **§6의 `/dashboard/uploads/:id` — 한 라우트, 세 상태** · §5 · §7(반드시 설계하는 상태, 특히 "진행률을 지어내지 마라") · §9
- `/design/prototype/flow.jsx` — 진행 화면 시각 참조
- `/src/styles/theme.css` — `.fs-step` · `.fs-pbar` · `.fs-card` 스펙
- `/docs/ARCHITECTURE.md` — §분석은 비동기 잡이다(2초 폴링) · §오류 처리
- `/docs/ADR.md` — ADR-005(만료면 재시도 불가) · ADR-013(두 층의 실패) · ADR-017
- `/src/app/api/uploads/[id]/route.ts` · `/src/app/api/uploads/[id]/retry/route.ts`
- `/src/components/upload/` — 에러 문구 매핑

## 구현 범위

```
src/components/report/ProcessingPanel.tsx  — .fs-step + indeterminate .fs-pbar
src/components/report/FailedPanel.tsx      — 고정 어휘 문구 + 재시도 버튼
src/components/report/StatusPoller.tsx     — 2초 폴링 (클라이언트)
src/app/dashboard/uploads/[id]/page.tsx    — 서버에서 읽어 상태로 분기
```

## 수정 대상 파일

```
src/components/report/ProcessingPanel.tsx       (신규)
src/components/report/ProcessingPanel.test.tsx  (신규 — 먼저)
src/components/report/FailedPanel.tsx           (신규)
src/components/report/FailedPanel.test.tsx      (신규 — 먼저)
src/components/report/StatusPoller.tsx          (신규)
src/components/report/StatusPoller.test.tsx     (신규 — 먼저)
src/app/dashboard/uploads/[id]/page.tsx         (신규 — tdd-guard 면제)
```

## 먼저 작성할 테스트

### `ProcessingPanel` ← 진행률을 지어내지 마라
1. **퍼센트 문자열(`%`)이 렌더 결과에 없다.** 문자열로 검사하라
2. 진행바에 `aria-valuenow`가 **없다** — indeterminate여야 한다 (`role="progressbar"`에 `aria-valuenow`를 주면 확정 진행률이라고 선언하는 것이다)
3. `.fs-step` 단계 리스트가 *무엇을 하는 중인지* 설명한다 (파일 읽는 중 · 양식 판별 · 분류 · 집계)
4. **"탭을 닫아도 분석은 서버에서 계속됩니다"** 취지의 문구가 있다
5. props로 받은 정보만 쓴다 (경과 시간을 자체 타이머로 만들어 단계를 진행시키지 마라 — 그것도 지어낸 진행률이다)

### `FailedPanel` ← 고정 어휘
6. `error_code` 7개 각각에 대응하는 한국어 문구가 나온다. **step 1의 매핑을 재사용한다** (import 확인)
7. **어휘 밖의 문자열이 화면에 안 나온다** — 알 수 없는 코드가 오면 일반 문구로 대체하고, 코드 원문을 화면에 띄우지 않는다
8. 재시도 버튼에 **잔여 횟수**가 표시된다
9. `retriesLeft === 0`이면 재시도 버튼이 disabled이고 이유를 말한다
10. **`error_code === 'expired'`면 재시도 버튼이 없고 "원본이 만료되어 재시도할 수 없습니다"를 말한다**(ADR-005 · DESIGN.md §6)
11. 재시도 클릭 시 `POST /api/uploads/{id}/retry`를 부른다
12. 재시도 중에는 버튼이 disabled다
13. 재시도 성공(202)이면 화면이 `processing`으로 전환된다
14. 재시도 실패 시 고정 어휘 문구를 보여준다

### `StatusPoller`
15. `status === 'processing'`일 때만 폴링한다
16. **2초 간격**이다
17. `completed`·`failed`가 되면 **폴링을 멈춘다**
18. 언마운트 시 인터벌이 정리된다 (누수 방지)
19. 폴링 응답이 `completed`면 페이지를 갱신한다 (`router.refresh()`)
20. **폴링 실패가 화면을 깨뜨리지 않는다** — 네트워크 오류 시 조용히 다음 주기를 기다린다. 사용자에게 에러를 띄우지 마라 (분석은 서버에서 계속 돌고 있다)
21. 폴링이 무한히 돌지 않게 상한을 둔다 (예: 10분 후 중단 + "새로고침해 주세요")

### 페이지 분기
22. `status: 'processing'` → `ProcessingPanel` + `StatusPoller`
23. `status: 'failed'` → `FailedPanel`
24. `status: 'completed'` → 이 step에서는 자리표시. **step 4·5가 채운다**
25. 없는 id·타인의 업로드 → Next의 `notFound()` (404 화면)

### 디자인 규율
26. step 0 공통 테스트 재사용

## Codex 실행 지시문

### 진행률을 지어내지 마라 — 이게 이 step의 전부다

DESIGN.md §7:

> **진행률을 지어내지 마라.** 서버는 `processing | completed | failed` 3상태만 준다. `.fs-step` 단계 리스트는 *무엇을 하는 중인지* 설명하는 장치이며, 확정 퍼센트를 계산해 표시하지 마라 — 근거가 되는 데이터가 없다. 진행바는 indeterminate로 둔다.

하지 말아야 할 것들:
- `경과 시간 / 예상 시간 * 100`
- 타이머로 단계를 하나씩 켜기 (사실이 아니다 — 서버는 지금 어느 단계인지 안 알려준다)
- `아마 60% 정도 왔습니다`

해도 되는 것: **모든 단계를 동시에 보여주고 "진행 중"만 표시.** 어떤 일이 일어나는지 설명하는 것이 목적이다.

### 폴링 실패는 조용히

폴링이 실패해도 **분석은 서버에서 계속 돌고 있다.** 사용자에게 "오류가 발생했습니다"를 띄우면 사실이 아닌 것을 말하는 것이다. 조용히 다음 주기를 기다려라.

10분 상한에 걸리면 "예상보다 오래 걸립니다. 새로고침해 주세요"로 바꾼다. 이것도 실패 선언이 아니다.

### `expired`는 재시도 버튼 자체를 없앤다

disabled로 두면 사용자가 계속 누른다. **버튼을 없애고 이유를 말하라.**

ADR-005: *"90일이 지나면 재시도가 불가능해지므로 UI가 그 사실을 말해야 한다."*

### 에러 문구 매핑을 다시 만들지 마라

step 1이 만든 매핑을 import하라. 두 벌이 되면 한쪽만 고쳐진다.

매핑에 없는 코드가 오면 일반 문구(`분석에 실패했습니다`)로 대체하고 **코드 원문을 화면에 띄우지 마라.**

### 페이지는 Server Component, 폴러는 Client Component

```tsx
// page.tsx (server)
const upload = await fetchUpload(userId, id);   // lib/supabase/server
if (!upload) notFound();
if (upload.status === 'processing') return <><ProcessingPanel .../><StatusPoller id={id} /></>;
if (upload.status === 'failed')     return <FailedPanel code={upload.error_code} retriesLeft={...} />;
return <ReportPlaceholder />;   // step 4·5 가 채운다
```

`ProcessingPanel`·`FailedPanel`은 **데이터를 props로만 받는다.** `StatusPoller`만 클라이언트에서 fetch한다.

### `retriesLeft` 계산

`2 - upload.retry_count`. 서버에서 계산해 props로 넘겨라. 클라이언트가 계산하면 상한 값이 두 곳에 박힌다.

## 완료 조건

- 3개 컴포넌트 + 페이지가 존재하고 26개 테스트가 전부 통과한다
- 렌더 결과에 퍼센트가 없고 `aria-valuenow`가 없다
- "탭을 닫아도 계속됩니다" 문구가 있다
- `expired`면 재시도 버튼이 없다
- 에러 문구가 step 1 매핑에서 온다 (import 확인)
- 폴링이 2초이고 종료 조건과 언마운트 정리가 있다
- 폴링 실패가 화면을 깨뜨리지 않는다
- 디자인 규율 공통 테스트 통과
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/components/report
```

직접 확인:

```bash
grep -nE "aria-valuenow|%|percent|진행률" src/components/report/ProcessingPanel.tsx && echo "확인 필요: 지어낸 진행률" || echo "OK"
grep -n "error_code\|errorCode" src/components/report/FailedPanel.tsx
# → 코드 원문을 화면에 렌더하지 않는지 확인
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - DESIGN.md §6 — 한 라우트, 세 상태로 분기하는가? 새 라우트를 만들지 않았는가?
   - DESIGN.md §7 — 진행률을 지어내지 않는가? 실패 문구가 고정 어휘 7개인가?
   - ADR-005 — `expired`면 재시도 불가 사유를 말하는가?
   - ADR-017 — "탭을 닫아도 계속됩니다"를 말하는가?
   - ARCHITECTURE.md §패턴 — 컴포넌트가 props로만 받는가?
   - DESIGN.md §10 — raw hex·raw px·이모지·파스텔 없는가?
3. 결과에 따라 `phases/3-app-ui/index.json`의 step 3을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "components/report/{ProcessingPanel,FailedPanel,StatusPoller}.tsx + dashboard/uploads/[id]/page.tsx가 status로 분기. 진행바 indeterminate(퍼센트·aria-valuenow 없음), '탭 닫아도 계속' 문구, expired면 재시도 버튼 제거, 에러 문구는 step1 매핑 재사용, 폴링 2초+종료조건+10분 상한+실패 시 무음. completed 분기는 자리표시 — step 4·5가 채운다")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단

## commit 기준

`feat(3-app-ui): step 3 — analysis-status`

포함: `src/components/report/{ProcessingPanel,FailedPanel,StatusPoller}.{tsx,test.tsx}` · `src/app/dashboard/uploads/[id]/page.tsx`

## 금지사항

- **진행률 퍼센트를 계산해 표시하지 마라.** 이유: 근거가 되는 데이터가 없다. 서버는 3상태만 준다(DESIGN.md §7).
- **타이머로 단계를 하나씩 켜지 마라.** 이유: 서버가 지금 어느 단계인지 알려주지 않으므로 그건 사실이 아니다.
- **`role="progressbar"`에 `aria-valuenow`를 주지 마라.** 이유: 확정 진행률이라고 선언하는 것이다.
- **폴링 실패를 사용자에게 에러로 띄우지 마라.** 이유: 분석은 서버에서 계속 돌고 있다. 사실이 아닌 것을 말하게 된다.
- **폴링을 무한히 돌리지 마라.** 이유: 탭을 열어둔 채 잊은 사용자가 서버를 계속 두드린다.
- **`expired`에 재시도 버튼을 disabled로 남기지 마라.** 이유: 사용자가 계속 누른다. 없애고 이유를 말하라.
- **에러 코드 원문을 화면에 띄우지 마라.** 이유: 고정 어휘 7개의 한국어 문구만 나간다.
- **에러 문구 매핑을 새로 만들지 마라.** 이유: step 1의 것을 재사용한다. 두 벌이면 한쪽만 고쳐진다.
- **`/api/uploads/:id/status` 같은 전용 폴링 라우트를 만들지 마라.** 이유: `GET /api/uploads/:id`가 폴링 대상이다(ADR-020 미룬 것 표).
- **`completed` 리포트 본문을 여기서 만들지 마라** — step 4·5다.
- **raw hex·raw px·이모지·파스텔 블록을 쓰지 마라.**
- 기존 테스트를 깨뜨리지 마라.
