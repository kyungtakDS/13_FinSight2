#!/usr/bin/env node
// Stop Hook — 세션이 끝날 때 lint · build · test 를 돌린다.
//
// Codex 훅은 stdout 이 JSON 이거나 비어 있어야 한다. npm 출력이 stdout 으로 새면
// 세 명령이 전부 통과해도 훅이 "Stop Failed" 로 잡혀 성공/실패 구분이 사라진다
// (측정: stdout 없는 훅 → Completed / 텍스트를 뱉는 훅 → Failed).
// 그래서 npm 출력을 전부 삼키고, 실패했을 때만 stderr 로 이유를 낸다.

import { spawnSync } from "node:child_process";

const COMMANDS = ["npm run lint", "npm run build", "npm run test"];
const TAIL = 2000; // 실패 출력이 길면 꼬리만 남긴다

for (const command of COMMANDS) {
  const r = spawnSync(command, { shell: true, encoding: "utf8" });

  if (r.status !== 0) {
    const output = ((r.stdout ?? "") + (r.stderr ?? "")).trim().slice(-TAIL);
    process.stderr.write(
      `Stop hook 실패: \`${command}\` (exit ${r.status ?? r.error?.message ?? "unknown"})\n${output}\n`,
    );
    process.exit(1);
  }
}

process.exit(0);
