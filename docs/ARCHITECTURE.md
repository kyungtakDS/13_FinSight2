# 아키텍처

## 디렉토리 구조
```
src/
├── app/               # 페이지 + API 라우트
├── components/        # UI 컴포넌트
├── types/             # TypeScript 타입 정의
├── lib/               # 유틸리티 + 헬퍼
└── services/          # 외부 API 래퍼 (anthropic, polar, supabase)
```

## 패턴
- Server Components 기본. 파일 업로드·차트 인터랙션처럼 상태가 필요한 곳만 Client Component.
- 외부 API 호출(Anthropic, Polar, Supabase service role)은 `app/api/` 라우트 핸들러에서만 한다. 클라이언트 번들에 키가 실리지 않는다.
- **LLM 호출은 항상 캐시 조회 뒤에 온다.** 캐시를 우회하는 직접 호출 경로를 만들지 않는다.
- 유료 기능 게이트는 서버에서 판정한다. 클라이언트가 보낸 구독 상태를 신뢰하지 않는다.

## 데이터 흐름
```
[업로드]
Client(파일 선택) → API Route
  → 인코딩 감지 (cp949 / utf-8)
  → 헤더 지문 해시 → csv_format_mappings 조회
        ├ 히트 → 즉시 정규화                          [LLM 0회]
        └ 미스 → 상위 20행만 Claude → 매핑 저장        [LLM 1회, 전역 재사용]
  → transactions 정규화 저장
  → 원본은 Storage private 버킷 (90일 후 자동 삭제)

[분류]
가맹점명 추출 → merchant_dictionary 조회
        ├ 히트 (대부분) → 즉시 분류                    [LLM 0회]
        └ 미스 → 상호명 배열만 배치 전송 → 사전 갱신    [LLM 1회, 전역 재사용]
  → 거래별 분류 확정 → 계정과목 집계 → 리포트

[게이트]
무료 → 절세 추정액 + 상위 3개 인사이트
유료 → 전체 분류 내역 + 시계열 대시보드 + 다운로드
```

**LLM 호출 지점은 위 두 곳뿐이고, 둘 다 캐시 뒤에 있다.** 두 캐시는 사용자별이 아니라 **전역 공유**다. 사용자가 늘수록 히트율이 오르고 분석 원가가 내려간다.

**개인정보는 서버 밖으로 나가지 않는다.** Anthropic에 전송되는 것은 ① CSV 상위 20행(헤더 구조 판별용) ② 가맹점 상호명 문자열 배열뿐이다. 금액·날짜·카드번호·사용자 식별자는 전송 대상이 아니다.

## 데이터 모델
| 테이블 | 범위 | 비고 |
|---|---|---|
| `uploads` | 사용자별 (RLS) | 원본 파일 참조 + 만료일. 90일 배치 삭제 |
| `transactions` | 사용자별 (RLS) | 정규화된 거래 + 분류 결과. 카드번호·승인번호는 저장 전 제거 |
| `merchant_dictionary` | **전역** | 가맹점명 → 업종·경비 분류. 개인정보 아님, 읽기 공유 |
| `csv_format_mappings` | **전역** | 헤더 지문 해시 → 컬럼 매핑 |
| `subscriptions` | 사용자별 | Polar 웹훅이 갱신 |

## 상태 관리
- 서버 상태는 Server Components에서 직접 조회한다. 클라이언트 캐시 계층을 따로 두지 않는다.
- 클라이언트 상태는 `useState` / `useReducer`. 전역 상태 라이브러리는 도입하지 않는다.
- 구독 상태는 Polar 웹훅이 갱신한 `subscriptions` 테이블이 단일 진실 공급원이다.
