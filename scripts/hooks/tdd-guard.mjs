#!/usr/bin/env node
// TDD Guard Hook — PreToolUse[apply_patch|Edit|Write]
// 구현 코드를 작성하려 할 때, 해당 모듈의 테스트 파일이 먼저 존재하는지 체크.
// 테스트 없이 구현 코드를 작성하려 하면 차단.
//
// payload 두 가지를 모두 받는다:
//   - Codex apply_patch — 프리폼 패치라 파일 경로가 봉투 헤더(*** Add/Update File:)에만 있다.
//   - Claude Code Edit|Write — tool_input.file_path 로 온다.
// bash 가 아니라 node 로 쓴 이유: Codex 는 훅을 cmd.exe 로 실행하는데 이 머신 PATH 에 bash 가 없다.

import fs from "node:fs";
import path from "node:path";

const EXTS = ["ts", "tsx", "js", "jsx"];
const ROOT = process.cwd().replace(/\\/g, "/");

/** 훅 payload 에서 이번에 쓰려는 파일 경로들을 뽑는다. */
function extractPaths(payload) {
  const input = payload?.tool_input;

  if (input && typeof input === "object" && typeof input.file_path === "string") {
    return [input.file_path];
  }

  // apply_patch 는 값이 문자열이거나 {command|input: "<패치 원문>"} 형태로 온다.
  // 어느 쪽이든 직렬화해서 봉투 헤더만 훑으면 된다.
  const text = typeof input === "string" ? input : JSON.stringify(input ?? "");
  const paths = [];
  const re = /\*\*\* (?:Add|Update) File: (.+?)(?:\\n|\n|"|$)/g;
  let m;
  while ((m = re.exec(text)) !== null) paths.push(m[1].trim());
  return paths;
}

/** 이 레포 안의 파일인가. 밖이면 이 프로젝트의 TDD 규칙 대상이 아니다. */
function isInsideRoot(file) {
  // 상대경로는 ROOT 기준으로 해석되므로 언제나 레포 안이다.
  const abs = /^([a-zA-Z]:)?\//.test(file) ? file : `${ROOT}/${file}`;
  // Windows 는 경로 대소문자를 구분하지 않는다.
  const norm = (p) => (process.platform === "win32" ? p.toLowerCase() : p);
  const target = norm(abs);
  const root = norm(ROOT).replace(/\/$/, "");
  // `${root}/` 로 비교해야 ROOT 와 접두사만 같은 형제 디렉토리가 안 걸린다.
  return target === root || target.startsWith(`${root}/`);
}

/** 테스트가 필요 없는 파일인가. */
function isExempt(file) {
  // 테스트 파일 자체를 수정하는 건 허용
  if (/test|spec|__tests__/.test(file)) return true;

  // 설정/타입/스타일 파일은 테스트 불필요
  if (/\.(json|css|scss|md|yml|yaml)$/.test(file)) return true;
  if (/\.env|\.config\.|tailwind|postcss|next\.config|tsconfig/.test(file)) return true;

  // types/ 폴더는 테스트 불필요
  if (/\/types\//.test(file) || /\/types(\.d)?\.ts$/.test(file)) return true;

  // design/prototype/ 은 벤더링된 디자인 참조 자산 — 빌드도 import 도 되지 않는다
  if (/\/design\/prototype\//.test(file)) return true;

  // Next.js 프레임워크 파일
  if (/\/(layout|page)\.(tsx|ts)$/.test(file)) return true;
  if (/\/(loading|error|not-found)\.tsx$/.test(file)) return true;
  if (/\/globals\.css$/.test(file)) return true;

  return false;
}

/** 같은 폴더 · __tests__/ · src/__tests__/ 에 테스트가 있는가. */
function hasTest(file) {
  const dir = path.posix.dirname(file);
  const parent = path.posix.dirname(dir);
  const base = path.posix.basename(file).replace(/\.(ts|tsx|js|jsx)$/, "");

  for (const ext of EXTS) {
    const candidates = [
      `${dir}/${base}.test.${ext}`,
      `${dir}/${base}.spec.${ext}`,
      `${dir}/__tests__/${base}.test.${ext}`,
      `${parent}/__tests__/${base}.test.${ext}`,
      `${ROOT}/src/__tests__/${base}.test.${ext}`,
    ];
    if (candidates.some((c) => fs.existsSync(c))) return true;
  }
  return false;
}

function deny(base) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason:
          `TDD GUARD: '${base}'에 대한 테스트 파일이 존재하지 않습니다. ` +
          `구현 코드를 작성하기 전에 테스트를 먼저 작성하세요. (테스트 파일 예: ${base}.test.ts)`,
      },
    }),
  );
}

let payload;
try {
  payload = JSON.parse(fs.readFileSync(0, "utf8"));
} catch {
  process.exit(0); // payload 를 못 읽으면 통과시킨다 — 가드가 작업을 막아선 안 된다
}

for (const raw of extractPaths(payload)) {
  // Windows 에서는 백슬래시 경로가 넘어온다. 아래 패턴은 전부 '/' 기준이라
  // 정규화하지 않으면 */types/* · */page.tsx 같은 면제가 통째로 죽는다.
  const file = raw.replace(/\\/g, "/");

  // 훅은 세션의 모든 Edit|Write 에 붙는다. 레포 밖 파일(예: ~/.claude/statusline.js)까지
  // 검사하면 이 프로젝트와 무관한 편집이 차단된다.
  if (!isInsideRoot(file)) continue;

  if (!/\.(ts|tsx|js|jsx)$/.test(file)) continue;
  if (isExempt(file)) continue;
  if (hasTest(file)) continue;

  deny(path.posix.basename(file).replace(/\.(ts|tsx|js|jsx)$/, ""));
  break;
}

process.exit(0);
