# Step 1: csv-fingerprint

## 목적

두 가지 해시를 만든다. 둘 다 **캐시 키**이고, 둘 다 개인정보를 담지 않아야 한다.

| 해시 | 무엇을 막나 | 어디 저장되나 |
|---|---|---|
| **파일 해시** | 같은 파일 재업로드 (접수 단계에서 거절) | `uploads.file_hash` — 사용자별 |
| **헤더 지문** | 같은 카드사 양식에 LLM을 두 번 묻는 것 | `csv_format_mappings.header_fingerprint` — **전역 공유** |

두 번째가 어렵다. `csv_format_mappings`는 전역 공유 자산이고 RLS가 없다 — **지문에 개인정보가 남으면 전제가 통째로 깨진다**(ARCHITECTURE.md §RLS 경계).

## 이전 Step과의 의존성

- **step 0 (`csv-normalize`)** — `parseRows`. 지문은 파싱된 셀 배열에서 계산한다

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — §디렉토리 구조의 `lib/csv/fingerprint.ts` · §데이터 흐름의 [접수]·[정규화] 블록 · §RLS 경계
- `/docs/ADR.md` — ADR-002(지문 캐싱) · ADR-014(중복은 파일 단위로만)
- `/docs/PRD.md` — §중복 거래 처리
- `/src/lib/csv/normalize.ts` — step 0 산출물
- `/supabase/migrations/0001_schema.sql` — `uploads.file_hash` · `csv_format_mappings.header_fingerprint` 컬럼
- `/phases/PLAN.md` — **D-4(헤더 지문은 "상위 20행의 자릿수 마스킹 해시")**. 왜 이 설계인지 그 항목에 있다

## 구현 범위

`src/lib/csv/fingerprint.ts` 하나. 순수 함수 2개 + 상수 1개.

```
fileHash(bytes: Uint8Array): string
headerFingerprint(rows: string[][]): string
export const FINGERPRINT_ROWS = 20;
```

## 수정 대상 파일

```
src/lib/csv/fingerprint.ts        (신규)
src/lib/csv/fingerprint.test.ts   (신규 — 먼저)
```

## 먼저 작성할 테스트

### `fileHash`
1. 같은 바이트 → 같은 해시 (결정적)
2. 1바이트만 달라도 다른 해시
3. 결과가 소문자 hex 64자 (sha256)
4. 빈 입력도 throw하지 않고 해시를 낸다
5. 2MB 크기 입력이 합리적 시간 안에 끝난다 (상한이 2MB다)

### `headerFingerprint` ← 이 step의 핵심
6. **같은 카드사의 다른 달 명세서가 같은 지문을 낸다.** 픽스처 2개를 만들어라 — 구조는 같고 날짜·금액·가맹점명만 다른 파일. 이게 통과해야 캐시가 의미를 갖는다
7. **다른 카드사(상단 메타 블록 행 수가 다르고 컬럼 구성이 다른 파일)는 다른 지문을 낸다**
8. 같은 컬럼명이지만 순서가 다르면 다른 지문 (컬럼 순서가 매핑의 일부다)
9. 셀 수가 다르면 다른 지문
10. 21번째 행 이후가 달라도 지문이 같다 (상위 20행만 본다)
11. 20행 미만인 파일도 throw하지 않는다
12. **지문에서 원본 숫자를 복원할 수 없다** — 같은 구조에 금액만 다른 두 파일이 같은 지문을 내는 것으로 증명된다 (6번과 같은 검사)
13. **가맹점명이 지문에 영향을 준다면 그것이 어디까지인지 테스트로 못박아라**: 데이터 행의 셀 텍스트가 지문에 들어가면 전역 테이블에 상호명 파편이 남는다. 아래 「지시문」의 마스킹 규칙을 따르면 데이터 행의 한글 텍스트는 지문에 들어간다 — **그래서 데이터 행은 셀 수만 쓰고 텍스트는 헤더 후보 구간에서만 쓴다.** 이 경계를 테스트로 고정하라
14. 결정적이다 — 같은 입력 두 번 호출하면 같은 값

## Codex 실행 지시문

### `fileHash`

Node `crypto`의 sha256. 바이트를 그대로 넣는다 — 디코드하지 마라(인코딩 판별 결과에 따라 해시가 달라지면 "같은 파일"의 정의가 흔들린다).

```ts
export function fileHash(bytes: Uint8Array): string;   // sha256 소문자 hex
```

### `headerFingerprint` — 설계

**왜 헤더 행이 아니라 상위 20행 전체인가**: 헤더 행 위치를 판정하는 게 LLM인데(ADR-002), 지문은 LLM을 부르기 *전에* 필요하다. 순환을 끊으려면 지문이 헤더 위치를 몰라도 계산돼야 한다.

계산 규칙:

1. 상위 `FINGERPRINT_ROWS`(20)행만 본다
2. 각 행에 대해 두 조각을 만든다:
   - **셀 수** (항상)
   - **셀 텍스트** — 단, 아래 마스킹을 거친다
3. 마스킹: 모든 숫자를 `#`로 치환하고, 앞뒤 공백을 제거하고, 연속 공백을 1칸으로 줄인다
4. **한글·영문이 포함된 셀 중 숫자 마스킹 후에도 텍스트가 남는 셀만** 지문에 넣는다. 즉 `2025.03.14` → `####.##.##` → 텍스트 없음 → 셀 수만 기여. `이용일자` → 그대로 → 텍스트 기여
5. 행 구분자 ``, 셀 구분자 ``로 이어붙여 sha256

> 이 규칙의 효과: 헤더 행과 상단 메타 블록의 **라벨 텍스트**(`이용일자`·`가맹점명`·`이용금액`·`◈ 신한카드 이용내역`)는 지문에 들어가고, 데이터 행의 날짜·금액은 마스킹돼 사라진다. 같은 카드사의 다른 달이 같은 지문을 내는 이유가 이것이다.

**남는 위험을 인지하라**: 상위 20행에 데이터 행이 포함되면 그 행의 **가맹점명이 지문 입력에 들어간다.** 전역 테이블에 상호명 파편이 남을 수 있다. 이걸 막아라 —

> **데이터 행으로 보이는 행의 텍스트 셀은 지문에서 제외한다.** 판별: 그 행에 마스킹으로 `#`만 남은 셀이 2개 이상이면(날짜 + 금액) 데이터 행으로 보고 **셀 수만** 기여시킨다. 헤더·메타 행은 `#`만 남은 셀이 거의 없다.

이 판별을 테스트 13번으로 못박아라.

### 해시 함수는 sha256 하나

`md5`·`crc32`를 쓰지 마라. 충돌이 나면 **다른 카드사 양식이 같은 매핑을 쓰게 되고**, 그 결과는 조용히 틀린 컬럼 매핑이다. 지문 계산은 업로드당 한 번이라 sha256 비용은 무의미하다.

### PII

`console.*`을 쓰지 마라. 셀 값이 다 들어오는 함수다.

에러 메시지에 셀 값을 넣지 마라.

## 완료 조건

- `fileHash`·`headerFingerprint`·`FINGERPRINT_ROWS`가 존재하고 14개 테스트가 전부 통과한다
- **같은 카드사 다른 달 픽스처 2개가 같은 지문을 낸다** (6번)
- **다른 카드사 픽스처가 다른 지문을 낸다** (7번)
- 데이터 행의 상호명이 지문 입력에 들어가지 않는다 (13번)
- sha256만 쓴다
- `console.*` 없음, DB·네트워크·env 접근 없음
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/lib/csv/fingerprint.test.ts
```

직접 확인:

```bash
grep -nE "md5|crc32|sha1\b" src/lib/csv/fingerprint.ts && echo "FAIL: 약한 해시" || echo "OK"
grep -n "console\." src/lib/csv/fingerprint.ts && echo "FAIL: 로깅" || echo "OK"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md §디렉토리 구조의 `lib/csv/fingerprint.ts` 한 파일인가?
   - §RLS 경계 — 전역 공유 테이블에 들어갈 값에 개인정보가 없는가?
   - ADR-014 — 거래 지문(교차 파일 중복 판정용)을 만들지 않았는가? **여기서 만드는 것은 파일 해시와 포맷 지문 둘뿐이다**
   - AGENTS.md CRITICAL — 로그에 PII 없는가?
3. 결과에 따라 `phases/1-pipeline/index.json`의 step 1을 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "lib/csv/fingerprint.ts — fileHash(sha256 hex), headerFingerprint(상위 20행, 숫자→# 마스킹, 데이터 행은 셀 수만 기여해 상호명이 전역 테이블에 안 남음). 같은 카드사 다른 달 = 같은 지문 테스트로 고정")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단

## commit 기준

`feat(1-pipeline): step 1 — csv-fingerprint`

포함: `src/lib/csv/fingerprint.{ts,test.ts}` · 추가 픽스처

## 금지사항

- **거래 단위 지문(`txn fingerprint`)이나 `is_duplicate` 플래그를 만들지 마라.** 이유: 리포트가 업로드 1건 단위라 우리가 합산하지 않고, 합산하지 않으면 중복 계상이 생기지 않는다. 지금 만들면 아무 코드도 읽지 않는 장치가 된다(ADR-014). 다중 파일 합산을 도입할 때 함께 들어온다.
- **md5·crc32·sha1을 쓰지 마라.** 이유: 지문 충돌은 "다른 카드사 양식에 남의 컬럼 매핑을 적용"으로 이어지고, 그 결과는 조용히 틀린 데이터다.
- **지문 입력에 데이터 행의 상호명을 넣지 마라.** 이유: `csv_format_mappings`는 RLS 없는 전역 테이블이고, "개인정보를 담지 않는다"는 전제 위에 예외가 성립한다(ARCHITECTURE.md §RLS 경계).
- **파일 바이트를 디코드한 뒤 해시하지 마라.** 이유: 인코딩 판별 결과에 따라 해시가 흔들리면 "같은 파일"의 정의가 무너진다.
- **`console.*`을 쓰지 마라.**
- **DB에 저장하는 코드를 여기 넣지 마라** — 조회·저장은 Phase 2의 파이프라인이 한다. 이 파일은 순수 계산만.
- 기존 테스트를 깨뜨리지 마라.
