// stop-check.mjs 회귀 테스트
//
// 실행: node scripts/hooks/stop-check.test.mjs
//
// 핵심은 "stdout 이 비어 있는가"다. npm 출력이 stdout 으로 새면 Codex 가 훅을
// Failed 로 잡아서, 통과했는지 실패했는지 구분할 수 없게 된다.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOOK = fileURLToPath(new URL("./stop-check.mjs", import.meta.url));

const OK = "node --eval 1";
const NOISY = 'node --eval "console.log(\'NOISE\'.repeat(500))"';
const FAILS = "node --eval process.exit(3)";

let pass = 0;
let fail = 0;

function check(desc, ok, detail = "") {
  if (ok) {
    pass += 1;
  } else {
    fail += 1;
    console.log(`FAIL  ${desc}${detail ? "\n        " + detail : ""}`);
  }
}

/** 임시 프로젝트에 package.json 을 깔고 훅을 돌린다. */
function run(scripts) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "stop-check-"));
  fs.writeFileSync(
    path.join(dir, "package.json"),
    JSON.stringify({ name: "fixture", version: "1.0.0", scripts }),
  );
  const r = spawnSync(process.execPath, [HOOK], { cwd: dir, encoding: "utf8" });
  fs.rmSync(dir, { recursive: true, force: true });
  return r;
}

// --- 성공: 조용히 exit 0 ---
const allPass = run({ lint: OK, build: OK, test: OK });
check("셋 다 통과하면 exit 0", allPass.status === 0, `status=${allPass.status}`);
check("셋 다 통과하면 stdout 없음", allPass.stdout === "", JSON.stringify(allPass.stdout.slice(0, 120)));
check("셋 다 통과하면 stderr 없음", allPass.stderr === "", JSON.stringify(allPass.stderr.slice(0, 120)));

// --- 성공했지만 명령이 수다스러운 경우: 그래도 stdout 은 비어야 한다 ---
const noisy = run({ lint: NOISY, build: NOISY, test: NOISY });
check("출력이 많아도 exit 0", noisy.status === 0, `status=${noisy.status}`);
check("출력이 많아도 stdout 은 비어 있다", noisy.stdout === "", `${noisy.stdout.length}자가 샜다`);

// --- 실패: non-zero + stderr 에 원인 ---
const buildFails = run({ lint: OK, build: FAILS, test: OK });
check("하나라도 실패하면 non-zero", buildFails.status !== 0, `status=${buildFails.status}`);
check("실패해도 stdout 은 비어 있다", buildFails.stdout === "", JSON.stringify(buildFails.stdout.slice(0, 120)));
check(
  "stderr 가 실패한 명령을 지목한다",
  buildFails.stderr.includes("npm run build"),
  JSON.stringify(buildFails.stderr.slice(0, 200)),
);

// --- 첫 실패에서 멈춘다 (뒤 명령을 더 돌리지 않는다) ---
const lintFails = run({ lint: FAILS, build: FAILS, test: OK });
check("첫 실패 명령을 보고한다", lintFails.stderr.includes("npm run lint"));
check(
  "첫 실패 뒤 명령은 돌리지 않는다",
  !lintFails.stderr.includes("npm run build"),
  JSON.stringify(lintFails.stderr.slice(0, 200)),
);

// --- package.json 이 없으면 실패로 잡힌다 (스캐폴딩 전 레포 상태) ---
const noPkg = spawnSync(process.execPath, [HOOK], {
  cwd: fs.mkdtempSync(path.join(os.tmpdir(), "stop-check-empty-")),
  encoding: "utf8",
});
check("package.json 이 없으면 non-zero", noPkg.status !== 0, `status=${noPkg.status}`);
check("package.json 이 없어도 stdout 은 비어 있다", noPkg.stdout === "");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
