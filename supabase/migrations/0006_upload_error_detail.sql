-- 0006_upload_error_detail.sql — 실패 원인 진단 정보 컬럼
--
-- 문제: uploads.error_code 는 클라이언트로 나가는 고정 어휘라 상류 실패를 전부
-- 'upstream' 한 단어로 뭉갠다. 429(rate limit) 인지 529(overloaded) 인지
-- 400(invalid request) 인지 구분할 수 없어, 재현될 때까지 원인을 좁힐 방법이 없다.
-- 실제 증상: 국민카드 업로드가 두 번 연속 'upstream' 으로 실패했는데 두 실패가
-- 같은 원인인지조차 알 수 없었다.
--
-- 담는 것: status(HTTP 상태) · errorType(오류 유형) · requestId(요청 식별자) ·
-- retryable(재시도 가능 여부). 상류 예외 메시지와 응답 본문은 담지 않는다 —
-- 요청 내용이 되비쳐 나올 수 있다(AGENTS.md: 로그에 PII 금지).
--
-- 노출: 애플리케이션의 클라이언트 대상 조회는 모두 명시적 컬럼 목록이라 이 컬럼이
-- 딸려 나가지 않는다. 0005 의 GRANT 는 테이블 단위라 새 컬럼도 그대로 상속되며,
-- 담긴 값에 PII 가 없으므로 컬럼 단위 회수는 하지 않는다.
--
-- 재실행 안전: if not exists 로 멱등이다.

alter table public.uploads
  add column if not exists error_detail jsonb;

comment on column public.uploads.error_detail is
  '실패 진단용 상류 오류 정보(status·errorType·requestId·retryable). 예외 메시지·본문은 담지 않는다.';
