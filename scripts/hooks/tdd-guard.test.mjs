// tdd-guard.mjs 회귀 테스트
//
// 실행: node scripts/hooks/tdd-guard.test.mjs
//
// 이 테스트가 없어서 "면제 패턴이 Windows 백슬래시 경로에 하나도 안 걸린다"는
// 버그가 오래 숨어 있었다. 면제 목록을 건드릴 때마다 이걸 돌려라.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOOK = fileURLToPath(new URL("./tdd-guard.mjs", import.meta.url));
let pass = 0;
let fail = 0;

function run(toolInput, cwd = process.cwd()) {
  const r = spawnSync(process.execPath, [HOOK], {
    input: JSON.stringify({ hook_event_name: "PreToolUse", tool_input: toolInput }),
    cwd,
    encoding: "utf8",
  });
  return r.stdout.trim() === "" ? "ALLOW" : "DENY";
}

function check(toolInput, expect, desc, cwd) {
  const actual = run(toolInput, cwd);
  if (actual === expect) {
    pass += 1;
  } else {
    fail += 1;
    console.log(`FAIL  expected=${expect} got=${actual}  ${desc}`);
    console.log(`        ${JSON.stringify(toolInput).slice(0, 120)}`);
  }
}

/** Claude Code Edit|Write 형태 */
const edit = (p) => ({ file_path: p });

// --- 면제: Windows 백슬래시 경로 (실제로 훅에 넘어오는 형태) ---
check(edit("D:\\p\\design\\prototype\\ds-bundle.js"), "ALLOW", "벤더링된 디자인 참조 자산");
check(edit("D:\\p\\src\\types\\index.ts"), "ALLOW", "types/");
check(edit("D:\\p\\src\\app\\layout.tsx"), "ALLOW", "Next 프레임워크 파일");
check(edit("D:\\p\\src\\app\\page.tsx"), "ALLOW", "Next 프레임워크 파일");
check(edit("D:\\p\\src\\app\\loading.tsx"), "ALLOW", "Next 프레임워크 파일");
check(edit("D:\\p\\src\\app\\error.tsx"), "ALLOW", "Next 프레임워크 파일");
check(edit("D:\\p\\src\\app\\not-found.tsx"), "ALLOW", "Next 프레임워크 파일");

// --- 면제: POSIX 슬래시 경로 ---
check(edit("D:/p/design/prototype/app.jsx"), "ALLOW", "슬래시 경로도 동일하게 면제");
check(edit("D:/p/src/types/index.ts"), "ALLOW", "슬래시 경로도 동일하게 면제");
check(edit("D:/p/src/app/page.tsx"), "ALLOW", "슬래시 경로도 동일하게 면제");

// --- 면제: 확장자 기반 (슬래시와 무관) ---
check(edit("D:\\p\\tailwind.config.ts"), "ALLOW", "설정 파일");
check(edit("D:\\p\\src\\app\\globals.css"), "ALLOW", "스타일");
check(edit("D:\\p\\docs\\DESIGN.md"), "ALLOW", "문서");
check(edit("D:\\p\\src\\lib\\csv\\normalize.test.ts"), "ALLOW", "테스트 파일 자체");

// --- 차단: 테스트가 먼저 있어야 하는 구현 코드 ---
check(edit("D:\\p\\src\\lib\\csv\\normalize.ts"), "DENY", "순수 로직");
check(edit("D:\\p\\src\\components\\Report.tsx"), "DENY", "컴포넌트");
check(edit("D:\\p\\src\\app\\api\\uploads\\route.ts"), "DENY", "라우트 핸들러");
check(edit("D:/p/src/services/claude/map.ts"), "DENY", "외부 SDK 래퍼");
// AGENTS.md: middleware.ts 는 면제가 아니다
check(edit("D:\\p\\src\\middleware.ts"), "DENY", "middleware 는 면제 아님");

// --- Codex apply_patch: 프리폼 패치 원문에서 경로를 뽑아야 한다 ---
const addPatch = "*** Begin Patch\n*** Add File: src/lib/csv/normalize.ts\n+export const x = 1;\n*** End Patch";
const updatePagePatch = "*** Begin Patch\n*** Update File: src/app/page.tsx\n+// hi\n*** End Patch";

check(addPatch, "DENY", "apply_patch 문자열 payload — 테스트 없는 새 구현 파일");
check(updatePagePatch, "ALLOW", "apply_patch 문자열 payload — 면제 대상");
check({ command: addPatch }, "DENY", "apply_patch 가 {command} 로 감싸져 와도 동일");
check({ input: addPatch }, "DENY", "apply_patch 가 {input} 으로 감싸져 와도 동일");
check(
  { command: "*** Begin Patch\n*** Delete File: src/lib/csv/old.ts\n*** End Patch" },
  "ALLOW",
  "파일 삭제는 테스트를 요구하지 않는다",
);

// --- 테스트가 실제로 존재하면 통과해야 한다 ---
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "tdd-guard-"));
fs.mkdirSync(path.join(tmp, "src", "lib"), { recursive: true });
fs.mkdirSync(path.join(tmp, "src", "__tests__"), { recursive: true });
fs.writeFileSync(path.join(tmp, "src", "lib", "covered.test.ts"), "");
fs.writeFileSync(path.join(tmp, "src", "__tests__", "rooted.test.ts"), "");

check(edit("src/lib/covered.ts"), "ALLOW", "같은 폴더에 테스트가 있으면 통과", tmp);
check(edit("src/lib/rooted.ts"), "ALLOW", "src/__tests__/ 에 테스트가 있으면 통과", tmp);
check(edit("src/lib/naked.ts"), "DENY", "테스트가 없으면 차단", tmp);
check(
  "*** Begin Patch\n*** Update File: src/lib/covered.ts\n+// hi\n*** End Patch",
  "ALLOW",
  "apply_patch 도 테스트가 있으면 통과",
  tmp,
);

fs.rmSync(tmp, { recursive: true, force: true });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
