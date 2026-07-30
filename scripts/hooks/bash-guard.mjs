#!/usr/bin/env node
// Bash Guard Hook — PreToolUse[Bash|shell]
// 되돌릴 수 없는 명령어를 차단한다.
//
// 이전에는 .claude/settings.json 에 인라인 셸 스니펫으로 있었지만,
// Codex 는 훅 payload 를 stdin JSON 으로 넘기고 (환경변수가 아니다) 훅을 cmd.exe 로
// 실행하므로 (이 머신 PATH 에 bash 가 없다) node 스크립트로 옮겼다.

import fs from "node:fs";

const FORBIDDEN = /rm\s+-rf|git\s+push\s+--force|git\s+reset\s+--hard|DROP\s+TABLE/i;

let payload;
try {
  payload = JSON.parse(fs.readFileSync(0, "utf8"));
} catch {
  process.exit(0);
}

const input = payload?.tool_input;
const command =
  typeof input === "string" ? input : (input?.command ?? JSON.stringify(input ?? ""));

if (FORBIDDEN.test(command)) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: "BLOCKED: 위험한 명령어가 감지되었습니다.",
      },
    }),
  );
}

process.exit(0);
