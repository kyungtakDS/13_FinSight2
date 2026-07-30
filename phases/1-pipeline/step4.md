# Step 4: merchant-dictionary

## 목적

전역 공유 `merchant_dictionary`의 **조회와 적재를 담당하는 유일한 파일**을 만든다.

이 사전이 ADR-001의 전부다. 거래 대부분은 이미 답이 정해진 가맹점(편의점·카페·통신사)이라 LLM이 필요 없고, **사용자가 늘수록 히트율이 올라 분석 원가가 내려간다.**

동시에 이 사전은 **가장 위험한 자산**이다: RLS가 없고, 전 사용자가 공유하며, **잘못된 항목 1건이 전 사용자에게 전파된다**(ADR-001 미해결 항목). 현재 방어는 "고정 목록 검증을 통과한 항목만 적재" 하나뿐이다. 그 하나를 여기서 제대로 구현한다.

## 이전 Step과의 의존성

- **Phase 0 step 2 (`core-types`)** — `ACCOUNT_CODES`(18) · `isAccountCode` · `VERDICTS`
- **Phase 0 step 3 (`db-schema`)** — `merchant_dictionary` 테이블과 그 check 제약
- **Phase 0 step 4 (`supabase-clients`)** — `createServiceClient()`. **`service.ts`의 `userId` 필수 헬퍼는 여기 안 쓴다** — 이 테이블은 사용자 소유가 아니다

## 읽어야 할 파일

- `/docs/ARCHITECTURE.md` — §데이터 흐름의 [분류] 블록 · §RLS 경계 · §Supabase 키 사용 규칙 표의 「전역 사전 갱신」 행 · §Claude API의 마지막 항목(모델 응답을 그대로 사전에 쓰지 마라)
- `/docs/ADR.md` — ADR-001(하이브리드 분류) · ADR-013(uncertain) · ADR-016
- `/docs/PRD.md` — §데이터 처리 원칙의 마지막 항목(전역 공유 자산) · §미해결(전역 사전 오염)
- `/src/types/account-codes.ts` · `/src/types/transaction.ts` — 고정 목록
- `/src/lib/supabase/service.ts` — `createServiceClient()`
- `/supabase/migrations/0001_schema.sql` — `merchant_dictionary` DDL과 check 제약

## 구현 범위

`src/lib/classify/dictionary.ts` 하나.

```ts
export interface DictEntry {
  merchantKey: string;
  accountCode: AccountCode;
  defaultVerdict: 'expense' | 'personal';   // 'uncertain' 은 사전에 저장하는 값이 아니다
  reason: string | null;
}

/** 여러 상호명을 한 번에 조회한다. 없는 키는 결과 Map에 없다. */
export async function lookupMerchants(keys: string[]): Promise<Map<string, DictEntry>>;

/** 검증을 통과한 항목만 적재한다. 통과하지 못한 항목은 조용히 버리고 개수를 반환한다. */
export async function upsertMerchants(entries: unknown[]): Promise<{ inserted: number; rejected: number }>;

/** 상호명 → 사전 키. 조회와 적재가 같은 함수를 써야 한다. */
export function merchantKey(merchant: string): string;
```

## 수정 대상 파일

```
src/lib/classify/dictionary.ts        (신규)
src/lib/classify/dictionary.test.ts   (신규 — 먼저)
```

## 먼저 작성할 테스트

`vi.mock('@/lib/supabase/service')`로 `createServiceClient`를 갈아끼운다. 실제 DB가 필요하면 안 된다.

### `merchantKey` — 조회와 적재의 대칭성
1. 앞뒤 공백 제거, 연속 공백 1칸
2. 유니코드 정규화(NFC) — `가` 조합형/완성형이 다른 키가 되면 히트율이 조용히 떨어진다
3. 대소문자 통일 (라틴 문자만. 한글에는 영향 없다)
4. **`lookupMerchants`와 `upsertMerchants`가 같은 `merchantKey`를 쓴다** — 다르면 적재한 항목을 영원히 못 찾는다. 두 함수 모두에서 호출됨을 assert하라
5. 결정적이다

### `lookupMerchants`
6. 빈 배열을 주면 **DB를 호출하지 않고** 빈 Map을 반환한다
7. 중복 키는 한 번만 조회한다
8. 없는 키는 결과 Map에 **없다** (null 값으로도 넣지 않는다)
9. 조회 쿼리에 **사용자 식별자가 들어가지 않는다** — 전역 테이블이다
10. 키가 아주 많을 때(예: 1,500개) 쿼리를 배치로 쪼갠다 (URL 길이·파라미터 상한)

### `upsertMerchants` ← 이 step의 핵심
11. `accountCode`가 18개 고정 목록 밖이면 **그 항목을 버린다** (전체 실패가 아니라 그 항목만)
12. `defaultVerdict`가 `expense`/`personal`이 아니면 버린다. **`uncertain`도 버린다** — 사전에 저장할 값이 아니다
13. `merchantKey`가 빈 문자열이거나 공백뿐이면 버린다
14. `reason`이 지나치게 길면 잘라내거나 버린다 (근거는 **한 줄**이다)
15. 버려진 개수가 `rejected`로 반환된다
16. **적재 행에 사용자 식별자 필드가 없다** — 넣으면 RLS 예외의 전제가 깨진다. INSERT 페이로드를 검사하라
17. 빈 배열이면 DB를 호출하지 않는다
18. 이미 있는 키는 upsert된다 (`merchant_key`가 PK다)
19. `updated_at`이 갱신된다

### PII
20. `console.*` 호출 0회 — 상호명이 다 들어오는 함수다

## Codex 실행 지시문

### 이 파일이 사전 쓰기의 **유일한 경로**다

ARCHITECTURE.md §Supabase 키 사용 규칙: *"쓰기 경로를 `lib/classify/dictionary.ts` 하나로 제한"*.

다른 곳에서 `merchant_dictionary`에 INSERT/UPDATE하지 마라. 경로가 둘이 되면 검증이 한쪽에만 있는 날이 온다.

### 검증은 "통과한 것만 적재", 전체 실패가 아니다

```ts
// ❌ 하나 틀렸다고 배치 전체를 버리지 마라 — 모델이 20개 중 1개를 틀리면 19개를 잃는다
// ✅ 항목 단위로 거른다
const valid = entries.filter(isValidEntry);
```

거부 사유를 로그로 남기지 마라 (상호명이 들어 있다). **개수만** 반환한다.

### 왜 애플리케이션 검증인가 (DB check가 있는데도)

DB에 check 제약이 있어도 애플리케이션에서 한 번 더 거르는 이유: check 위반은 **배치 INSERT 전체를 실패시킨다.** 항목 단위로 거르려면 애플리케이션이 먼저 걸러야 한다. 두 겹이 중복이 아니라 역할이 다르다.

### `defaultVerdict`에 `uncertain`이 없는 이유

`uncertain`은 판정 결과가 아니라 **"사전에 없다"의 결과**다. 사전에 `uncertain`을 저장하면 "모른다는 것을 안다"가 되어 다음 분석에서 LLM에 다시 묻지 않게 되고, 사전이 채워질수록 오히려 `uncertain`이 고착된다.

### service role 사용

`createServiceClient()`를 쓴다. **`service.ts`의 `userId` 필수 헬퍼는 쓰지 않는다** — 이 테이블은 사용자 소유가 아니라 전역 자산이다.

읽기(`lookupMerchants`)도 service role로 한다. 이유: `after()` 워커 안에서 요청 컨텍스트가 사라질 수 있다(ADR-017).

### 배치 크기

`in (...)` 조회는 한 번에 500개 정도로 쪼갠다. 3,000행 파일에서 고유 상호명이 1,000개를 넘을 수 있다.

### 로깅

`console.*` 금지. 상호명이 PII다.

## 완료 조건

- `lookupMerchants`·`upsertMerchants`·`merchantKey`·`DictEntry`가 존재하고 20개 테스트가 전부 통과한다
- 고정 목록 밖 `accountCode`가 적재되지 않는다
- `defaultVerdict`에 `uncertain`이 적재되지 않는다
- INSERT 페이로드에 사용자 식별자가 없다
- 조회와 적재가 같은 `merchantKey`를 쓴다
- `console.*` 호출 0회
- 실제 DB 없이 테스트가 돈다
- `npm run lint && npm run build && npm run test` 통과

## 검증 명령

```bash
npm run lint && npm run build && npm run test
npx vitest run src/lib/classify/dictionary.test.ts
```

직접 확인:

```bash
grep -n "console\." src/lib/classify/dictionary.ts && echo "FAIL" || echo "OK"
grep -rn "merchant_dictionary" src/ | grep -v "lib/classify/dictionary" && echo "FAIL: 쓰기 경로가 둘 이상" || echo "OK: 단일 경로"
grep -nE "user_id|userId" src/lib/classify/dictionary.ts && echo "FAIL: 전역 테이블에 사용자 식별자" || echo "OK"
```

## 검증 절차

1. 위 AC 커맨드를 실행한다.
2. 아키텍처 체크리스트:
   - ARCHITECTURE.md §디렉토리 구조의 `lib/classify/dictionary.ts` 한 파일인가?
   - §RLS 경계 — 전역 테이블에 사용자 식별자를 넣지 않았는가?
   - §Supabase 키 사용 규칙 — 사전 쓰기 경로가 이 파일 하나뿐인가?
   - §Claude API 마지막 항목 — 모델 응답을 그대로 적재하지 않고 고정 목록 검증을 통과한 항목만 넣는가?
   - AGENTS.md CRITICAL — 로그에 PII 없는가? 테스트가 키를 요구하지 않는가?
3. 결과에 따라 `phases/1-pipeline/index.json`의 step 4를 업데이트한다:
   - 성공 → `"status": "completed"`, `"summary"` 한 줄 (예: "lib/classify/dictionary.ts — merchantKey(NFC+공백정리+대소문자), lookupMerchants(500개 배치, 사용자 식별자 없음), upsertMerchants(항목 단위 검증: 18개 고정 목록 밖·uncertain·빈 키 거부 후 개수만 반환). service role 사용, 사전 쓰기의 유일한 경로")
   - 3회 실패 → `"status": "error"` + `"error_message"`
   - 사람 개입 필요 → `"status": "blocked"` + `"blocked_reason"` 후 중단

## commit 기준

`feat(1-pipeline): step 4 — merchant-dictionary`

포함: `src/lib/classify/dictionary.{ts,test.ts}`

## 금지사항

- **`merchant_dictionary`에 사용자 식별자를 넣지 마라.** 이유: 이 테이블이 RLS 예외인 근거가 "개인정보를 담지 않는다"는 전제다. 넣는 순간 전제가 깨진다(ARCHITECTURE.md §RLS 경계).
- **모델 응답을 검증 없이 적재하지 마라.** 이유: 전역 자산이라 오염이 전 사용자에게 전파된다. 잘못된 항목 1건이 모두에게 간다(ADR-001 미해결).
- **`defaultVerdict`에 `uncertain`을 저장하지 마라.** 이유: `uncertain`은 판정이 아니라 "사전에 없다"의 결과다. 저장하면 다시 묻지 않게 되어 고착된다.
- **검증 실패 시 배치 전체를 버리지 마라.** 이유: 20개 중 1개가 틀렸다고 19개를 잃는다.
- **거부 사유를 로그로 남기지 마라.** 이유: 사유에 상호명이 들어간다. 개수만 남긴다.
- **다른 파일에서 `merchant_dictionary`에 쓰지 마라.** 이유: 경로가 둘이면 검증이 한쪽에만 있는 날이 온다.
- **`hit_count` 같은 통계 컬럼을 추가하지 마라.** 이유: 아무 코드도 그걸 읽지 않는다. 히트율을 실제로 계측할 때 들어온다(ADR 미룬 것 표).
- **신뢰도 점수·출처 추적·롤백 기능을 만들지 마라.** 이유: 미해결로 남긴 문제이고, 설계 없이 만들면 반쪽짜리가 된다(ADR 미해결). 지금 방어는 고정 목록 검증 하나다.
- **`console.*`을 쓰지 마라.**
- **LLM을 여기서 부르지 마라** — 사전 조회와 LLM 호출의 순서(캐시 먼저)는 Phase 2 파이프라인이 정한다.
- 기존 테스트를 깨뜨리지 마라.
