# Supabase 설정

이 디렉터리는 실행 가능한 마이그레이션 SQL만 제공한다. 이 step에서는 원격 DB에 적용하지
않았다. 프로젝트 관리자가 아래 순서대로 적용해야 한다.

## 마이그레이션 적용

Supabase Dashboard의 SQL Editor에서 다음 파일을 번호 순서대로 실행한다.

1. `migrations/0001_schema.sql`
2. `migrations/0002_rls.sql`
3. `migrations/0003_storage.sql`
4. `migrations/0004_expiry_cron.sql`

Supabase CLI가 연결된 환경에서는 프로젝트 루트에서 다음 명령으로 같은 순서를 적용할 수 있다.

```sh
supabase db push
```

## 콘솔 설정

- Authentication > Providers에서 Google provider를 활성화한다.
- Google OAuth 앱과 Supabase URL Configuration 양쪽에 실제 배포 도메인의
  `https://<domain>/auth/callback`을 redirect URL로 등록한다. 로컬 개발 시
  `http://localhost:3000/auth/callback`도 등록한다.
- Database > Extensions에서 `pg_cron`을 활성화해야 할 수 있다. 확장 권한 문제로
  `0004_expiry_cron.sql` 적용이 실패하면 Dashboard에서 확장을 먼저 활성화한 뒤 다시 실행한다.

## 90일 만료 잡 수동 확인

`0004_expiry_cron.sql`은 만료된 `csv-uploads`의 `storage.objects` 행을 지우고
`uploads.storage_path`를 `null`로 만든다. `transactions`와 `uploads.summary`는 유지한다.

**프로젝트 설정에 따라 `storage.objects` 행을 SQL로 삭제했을 때 실제 오브젝트 스토리지의
바이트까지 파기되는지 다를 수 있다. Supabase 콘솔에서 만료 테스트 객체를 만든 뒤 잡을
실행하고, Storage 화면에서 실제 객체가 사라졌는지 반드시 눈으로 확인한다.** 실제 바이트가
남는 환경이면 SQL 행 삭제만으로 운영하지 말고 Supabase가 지원하는 Storage 삭제 경로를
별도로 구성한 뒤 개인정보처리방침의 90일 파기 약속을 검증한다.
