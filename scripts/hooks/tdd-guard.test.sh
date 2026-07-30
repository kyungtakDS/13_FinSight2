#!/bin/bash
# tdd-guard.sh 회귀 테스트
#
# 실행: bash scripts/hooks/tdd-guard.test.sh
#
# 이 테스트가 없어서 "면제 패턴이 Windows 백슬래시 경로에 하나도 안 걸린다"는
# 버그가 오래 숨어 있었다. 면제 목록을 건드릴 때마다 이걸 돌려라.

HOOK="$(dirname "$0")/tdd-guard.sh"
PASS=0
FAIL=0

# check <경로> <ALLOW|DENY> <설명>
check() {
  local path="$1" expect="$2" desc="$3" actual
  if [ -z "$(jq -nc --arg p "$path" '{tool_input:{file_path:$p}}' | bash "$HOOK")" ]; then
    actual=ALLOW
  else
    actual=DENY
  fi
  if [ "$actual" = "$expect" ]; then
    PASS=$((PASS + 1))
  else
    FAIL=$((FAIL + 1))
    printf 'FAIL  expected=%-5s got=%-5s  %s\n        %s\n' "$expect" "$actual" "$desc" "$path"
  fi
}

# --- 면제: Windows 백슬래시 경로 (실제로 훅에 넘어오는 형태) ---
check 'D:\p\design\prototype\ds-bundle.js' ALLOW '벤더링된 디자인 참조 자산'
check 'D:\p\src\types\index.ts'            ALLOW 'types/'
check 'D:\p\src\app\layout.tsx'            ALLOW 'Next 프레임워크 파일'
check 'D:\p\src\app\page.tsx'              ALLOW 'Next 프레임워크 파일'
check 'D:\p\src\app\loading.tsx'           ALLOW 'Next 프레임워크 파일'
check 'D:\p\src\app\error.tsx'             ALLOW 'Next 프레임워크 파일'
check 'D:\p\src\app\not-found.tsx'         ALLOW 'Next 프레임워크 파일'

# --- 면제: POSIX 슬래시 경로 ---
check 'D:/p/design/prototype/app.jsx'      ALLOW '슬래시 경로도 동일하게 면제'
check 'D:/p/src/types/index.ts'            ALLOW '슬래시 경로도 동일하게 면제'
check 'D:/p/src/app/page.tsx'              ALLOW '슬래시 경로도 동일하게 면제'

# --- 면제: 확장자 기반 (슬래시와 무관) ---
check 'D:\p\tailwind.config.ts'            ALLOW '설정 파일'
check 'D:\p\src\app\globals.css'           ALLOW '스타일'
check 'D:\p\docs\DESIGN.md'                ALLOW '문서'
check 'D:\p\src\lib\csv\normalize.test.ts' ALLOW '테스트 파일 자체'

# --- 차단: 테스트가 먼저 있어야 하는 구현 코드 ---
check 'D:\p\src\lib\csv\normalize.ts'          DENY '순수 로직'
check 'D:\p\src\components\Report.tsx'         DENY '컴포넌트'
check 'D:\p\src\app\api\uploads\route.ts'      DENY '라우트 핸들러'
check 'D:/p/src/services/claude/map.ts'        DENY '외부 SDK 래퍼'
# CLAUDE.md: middleware.ts 는 면제가 아니다
check 'D:\p\src\middleware.ts'                 DENY 'middleware 는 면제 아님'

printf '\n%d passed, %d failed\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ]
