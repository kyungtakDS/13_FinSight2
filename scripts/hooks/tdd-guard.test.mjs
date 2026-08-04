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

// 훅은 ROOT(=cwd) 밖 파일을 아예 검사하지 않는다. 그래서 경로 패턴 테스트는
// 반드시 실제 루트 밑에서 해야 한다 — 예전처럼 가짜 "D:\p\" 를 쓰면 면제 로직을
// 타는 게 아니라 "레포 밖"이라 건너뛰어져서, 통과해도 아무것도 검증하지 못한다.
const winRoot = process.cwd().replace(/\//g, "\\");
const posixRoot = process.cwd().replace(/\\/g, "/");
const win = (rel) => `${winRoot}\\${rel.replace(/\//g, "\\")}`;
const posix = (rel) => `${posixRoot}/${rel}`;

// --- 면제: Windows 백슬래시 경로 (실제로 훅에 넘어오는 형태) ---
check(edit(win("design/prototype/ds-bundle.js")), "ALLOW", "벤더링된 디자인 참조 자산");
check(edit(win("src/types/index.ts")), "ALLOW", "types/");
check(edit(win("src/app/layout.tsx")), "ALLOW", "Next 프레임워크 파일");
check(edit(win("src/app/page.tsx")), "ALLOW", "Next 프레임워크 파일");
check(edit(win("src/app/loading.tsx")), "ALLOW", "Next 프레임워크 파일");
check(edit(win("src/app/error.tsx")), "ALLOW", "Next 프레임워크 파일");
check(edit(win("src/app/not-found.tsx")), "ALLOW", "Next 프레임워크 파일");

// --- 면제: POSIX 슬래시 경로 ---
check(edit(posix("design/prototype/app.jsx")), "ALLOW", "슬래시 경로도 동일하게 면제");
check(edit(posix("src/types/index.ts")), "ALLOW", "슬래시 경로도 동일하게 면제");
check(edit(posix("src/app/page.tsx")), "ALLOW", "슬래시 경로도 동일하게 면제");

// --- 면제: 확장자 기반 (슬래시와 무관) ---
check(edit(win("tailwind.config.ts")), "ALLOW", "설정 파일");
check(edit(win("src/app/globals.css")), "ALLOW", "스타일");
check(edit(win("docs/DESIGN.md")), "ALLOW", "문서");
check(edit(win("src/lib/csv/normalize.test.ts")), "ALLOW", "테스트 파일 자체");

// --- 차단: 테스트가 먼저 있어야 하는 구현 코드 ---
// 이 블록은 '테스트가 하나도 없는' 빈 임시 루트에서 돌린다.
// 실제 레포 경로를 픽스처로 쓰면, 그 모듈이 나중에 정당하게 테스트를 갖는 순간
// 가드는 올바르게 ALLOW 를 내는데 기대값만 낡아서 빨개진다. Phase 1~2 에서 실제로
// 그렇게 됐다 (normalize.test.ts · route.test.ts · middleware.test.ts 가 생기면서 6건 실패).
// 여기서 검증하려는 것은 '이 경로 모양이 면제 목록에 없다'이지 '레포에 테스트가 없다'가 아니다.
const bare = fs.mkdtempSync(path.join(os.tmpdir(), "tdd-guard-bare-"));
const bareWin = (rel) => `${bare.replace(/\//g, "\\")}\\${rel.replace(/\//g, "\\")}`;
const barePosix = (rel) => `${bare.replace(/\\/g, "/")}/${rel}`;

check(edit(bareWin("src/lib/csv/normalize.ts")), "DENY", "순수 로직", bare);
check(edit(bareWin("src/components/Report.tsx")), "DENY", "컴포넌트", bare);
check(edit(bareWin("src/app/api/uploads/route.ts")), "DENY", "라우트 핸들러", bare);
check(edit(barePosix("src/services/claude/map.ts")), "DENY", "외부 SDK 래퍼", bare);
// AGENTS.md: middleware.ts 는 면제가 아니다
check(edit(bareWin("src/middleware.ts")), "DENY", "middleware 는 면제 아님", bare);

// --- Codex apply_patch: 프리폼 패치 원문에서 경로를 뽑아야 한다 ---
// 패치 봉투의 경로는 상대경로라 훅의 cwd 기준으로 해석된다 → 같은 빈 루트에서 돌린다.
const addPatch = "*** Begin Patch\n*** Add File: src/lib/csv/normalize.ts\n+export const x = 1;\n*** End Patch";
const updatePagePatch = "*** Begin Patch\n*** Update File: src/app/page.tsx\n+// hi\n*** End Patch";

check(addPatch, "DENY", "apply_patch 문자열 payload — 테스트 없는 새 구현 파일", bare);
check(updatePagePatch, "ALLOW", "apply_patch 문자열 payload — 면제 대상", bare);
check({ command: addPatch }, "DENY", "apply_patch 가 {command} 로 감싸져 와도 동일", bare);
check({ input: addPatch }, "DENY", "apply_patch 가 {input} 으로 감싸져 와도 동일", bare);
check(
  { command: "*** Begin Patch\n*** Delete File: src/lib/csv/old.ts\n*** End Patch" },
  "ALLOW",
  "파일 삭제는 테스트를 요구하지 않는다",
  bare,
);

fs.rmSync(bare, { recursive: true, force: true });

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

// --- 레포 밖 파일은 이 프로젝트의 TDD 규칙 대상이 아니다 ---
// 훅은 Claude Code 세션의 모든 Edit|Write 에 붙는다. ROOT 검사가 없으면
// ~/.claude/statusline.js 같은 개인 설정 파일까지 .js 라는 이유로 차단된다.
const outside = fs.mkdtempSync(path.join(os.tmpdir(), "tdd-guard-outside-"));
fs.mkdirSync(path.join(outside, ".claude"), { recursive: true });

check(edit(path.join(outside, ".claude", "statusline.js")), "ALLOW", "레포 밖 개인 설정 파일");
check(edit(path.join(outside, "impl.ts")), "ALLOW", "레포 밖 .ts 는 이 레포 소관이 아니다");

// ROOT 와 문자열 접두사만 같은 형제 디렉토리는 레포 밖이다 (startsWith 함정)
check(edit(`${process.cwd()}-sibling/src/lib/impl.ts`), "ALLOW", "ROOT 접두사만 같은 형제 경로");

// Windows 는 드라이브 문자 대소문자를 구분하지 않는다 — 여전히 레포 안이다
const cwdWin = process.cwd().replace(/\//g, "\\");
const flipped = /^[a-zA-Z]:/.test(cwdWin)
  ? (cwdWin[0] === cwdWin[0].toLowerCase() ? cwdWin[0].toUpperCase() : cwdWin[0].toLowerCase()) + cwdWin.slice(1)
  : cwdWin;
check(edit(`${flipped}\\src\\lib\\naked_case.ts`), "DENY", "드라이브 문자 대소문자가 달라도 레포 안");

fs.rmSync(outside, { recursive: true, force: true });

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
