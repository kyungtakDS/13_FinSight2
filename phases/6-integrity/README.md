# Phase 6 — `6-integrity` (하네스 밖에서 실행된 완료 기록)

> **이 phase는 재실행 대상이 아니다.**
>
> `scripts/execute.py`가 실행한 적이 없고, `step{N}.md` 파일도 **일부러 만들지 않았다.**
> step 파일이 있으면 재실행 가능한 것처럼 보이는데, 이 작업들은 이미 main에 머지된
> GitHub 이슈·PR이라 다시 돌릴 대상이 없다.
>
> `python scripts/execute.py 6-integrity`를 실행하지 마라. `index.json`의 step이 전부
> `completed`라 `_execute_all_steps`가 아무것도 집지 않고 끝나지만, `feat-6-integrity`
> 브랜치만 새로 생긴다.

## 무엇인가

Phase 4가 끝난 뒤(2026-08-04) Phase 5 Billing을 시작하기 전에, **실제 카드사 명세서로
돌려 보며 드러난 결함**을 고친 15개의 PR이다. 하네스의 phase 단위 실행이 아니라
GitHub 이슈 → PR → 머지로 진행됐다.

`phases/index.json`에 `completed`로 올린 이유는 그 파일이 "이 레포에서 무엇이 끝났는가"의
기계 판독 권위이기 때문이다. 여기에 없으면 Phase 4와 Phase 5 사이의 3일이 통째로 비어 보인다.

## 이 기록의 성질

| | 정상 phase | 이 phase |
|---|---|---|
| `step{N}.md` | 있음 | **없음 (의도적)** |
| 실행 주체 | `execute.py` → `codex exec` | 사람 + 대화형 에이전트 |
| 브랜치 | `feat-6-integrity` | PR별 개별 브랜치 |
| `started_at` | execute.py 기록 | **없음** |
| `completed_at` | execute.py 기록 | **git 커밋 날짜에서 역산** |
| `steps[].name` | step 파일명과 1:1 | 커밋과 1:1 (kebab-case 요약) |

`completed_at`이 커밋 날짜라는 점을 특히 유의하라 — 실제 작업 시각이 아니라 머지 시각이다.

## 무엇이 바뀌었나 (요약)

- **인프라 결함 2건** — 브라우저 클라이언트의 `NEXT_PUBLIC_*` 정적 참조(#20), 테이블
  GRANT 전면 누락(#21). 후자는 `uploads` 0행의 원인이었다 — 업로드가 한 번도 성공한 적이
  없었다. `0005_grants.sql`이 여기서 나왔다.
- **CSV 정규화 3건** — 취소 거래 상태값 처리(#25), 한국어 날짜 표기(#34),
  승인취소만 남은 명세서(#36/PR #38).
- **분류·상류 내성 5건** — personal 강등 경로(#23), 사전 조회 URL 길이 분할(#27),
  배치 백오프 재시도(#28), 부분 결과 보존(#26), 구조화 응답 JSON 경계(#37).
- **관측성 2건** — 분류 schema 실패 원인 구분(#22), 상태 판정 실패 격리(#32).
- **재계산 1건** — `completed` 업로드 재계산(#30/PR #39). `0007_upload_recompute.sql`.
- **문서·UI 2건** — `rows_unreadable` 고정 어휘 편입(#35), 랜딩 CTA(#24).

## 남긴 마이그레이션

| 파일 | PR |
|---|---|
| `0005_grants.sql` | #21 |
| `0006_upload_error_detail.sql` | #26 |
| `0007_upload_recompute.sql` | #39 |

**이 세 개 때문에 Phase 5 계획서가 예약해 뒀던 `0005_polar_event_fn.sql` 번호가 충돌했다.**
Polar 이벤트 함수는 `0008`로 옮겼다 — `phases/PLAN.md` D-17 참고.

## 검증 상태 (2026-08-07, main `d7f9a54`)

```
npm run test    744 passed / 63 files
```

- 마이그레이션 `0001`~`0007` **live DB 적용 완료** (PLAN.md B-2 해소)
- 실제 카드사 명세서 재계산 실검증 **12/12 통과** (PLAN.md B-3 해소)
- Issue #29 · #30 · #33 · #36 CLOSED
