// bash-guard.mjs 회귀 테스트
//
// 실행: node scripts/hooks/bash-guard.test.mjs

import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const HOOK = fileURLToPath(new URL("./bash-guard.mjs", import.meta.url));
let pass = 0;
let fail = 0;

function check(toolInput, expect, desc) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ hook_event_name: "PreToolUse", tool_input: toolInput }),
    encoding: "utf8",
  });
  const actual = r.stdout.trim() === "" ? "ALLOW" : "DENY";
  if (actual === expect) {
    pass += 1;
  } else {
    fail += 1;
    console.log(`FAIL  expected=${expect} got=${actual}  ${desc}`);
  }
}

// --- 차단 ---
check({ command: "rm -rf node_modules" }, "DENY", "rm -rf");
check({ command: "git push --force origin main" }, "DENY", "force push");
check({ command: "git reset --hard HEAD~1" }, "DENY", "hard reset");
check({ command: "psql -c 'DROP TABLE transactions'" }, "DENY", "DROP TABLE");
check("rm -rf /tmp/x", "DENY", "payload 가 문자열로 와도 동일");

// --- 허용 ---
check({ command: "npm run build" }, "ALLOW", "일반 빌드");
check({ command: "git status" }, "ALLOW", "일반 git");
check({ command: "rm dist/bundle.js" }, "ALLOW", "-rf 없는 rm");
check({}, "ALLOW", "빈 payload");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
