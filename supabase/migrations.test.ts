import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { VERDICTS } from "../src/types/transaction";
import { UPLOAD_STATUSES } from "../src/types/upload";

const migrationsDirectory = path.join(process.cwd(), "supabase", "migrations");

function migrationFiles(): string[] {
  return fs
    .readdirSync(migrationsDirectory)
    .filter((filename) => filename.endsWith(".sql"))
    .sort();
}

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(migrationsDirectory, filename), "utf8");
}

function allSql(): string {
  return migrationFiles().map(readMigration).join("\n");
}

function tableDefinition(sql: string, tableName: string): string {
  const match = sql.match(
    new RegExp(
      `create\\s+table\\s+if\\s+not\\s+exists\\s+(?:public\\.)?${tableName}\\s*\\(([\\s\\S]*?)\\n\\);`,
      "i",
    ),
  );

  expect(match, `${tableName} table definition`).not.toBeNull();
  return match?.[1] ?? "";
}

function functionSource(sql: string, functionName: string): string {
  const match = sql.match(
    new RegExp(
      `create\\s+or\\s+replace\\s+function\\s+(?:public\\.)?${functionName}\\s*\\([\\s\\S]*?\\$\\$;`,
      "i",
    ),
  );

  expect(match, `${functionName} function definition`).not.toBeNull();
  return match?.[0] ?? "";
}

function statement(sql: string, pattern: RegExp): string {
  const match = sql.match(pattern);

  expect(match, `${pattern.source} statement`).not.toBeNull();
  return match?.[0] ?? "";
}

function checkValues(definition: string, columnName: string): string[] {
  const match = definition.match(
    new RegExp(
      `${columnName}[\\s\\S]*?check\\s*\\(\\s*${columnName}\\s+in\\s*\\(([^)]*)\\)\\s*\\)`,
      "i",
    ),
  );

  expect(match, `${columnName} check constraint`).not.toBeNull();
  return [...(match?.[1].matchAll(/'([^']+)'/g) ?? [])]
    .map((value) => value[1])
    .sort();
}

describe("Supabase migration invariants", () => {
  it("has at least four ordered migrations with numeric prefixes", () => {
    const files = migrationFiles();

    expect(files.length).toBeGreaterThanOrEqual(4);
    expect(files).toEqual([...files].sort());
    expect(files.every((filename) => /^\d{4}_/.test(filename))).toBe(true);
  });

  it("contains no destructive table removal statement", () => {
    expect(allSql()).not.toMatch(/drop\s+table/i);
  });

  it("does not define card or approval number columns on transactions", () => {
    const transactions = tableDefinition(allSql(), "transactions");

    expect(transactions).not.toMatch(/\b(?:card_number|card_no|approval)\b/i);
  });

  it("keeps global dictionaries free of user identity references", () => {
    const sql = allSql();

    for (const table of ["merchant_dictionary", "csv_format_mappings"]) {
      const definition = tableDefinition(sql, table);
      expect(definition).not.toMatch(/\buser_id\b/i);
      expect(definition).not.toMatch(/\bauth\.users\b/i);
    }
  });

  it("has a unique upload index for user and file hash", () => {
    expect(allSql()).toMatch(
      /create\s+unique\s+index(?:\s+if\s+not\s+exists)?[\s\S]*?\bon\s+(?:public\.)?uploads\s*\(\s*user_id\s*,\s*file_hash\s*\)/i,
    );
  });

  it("enables RLS on all user-owned tables", () => {
    const sql = allSql();

    for (const table of ["profiles", "uploads", "transactions"]) {
      expect(sql).toMatch(
        new RegExp(
          `alter\\s+table\\s+(?:public\\.)?${table}\\s+enable\\s+row\\s+level\\s+security`,
          "i",
        ),
      );
    }
  });

  it("defines no RLS policies for global dictionaries", () => {
    const sql = allSql();
    const policyStatements = sql.match(/create\s+policy[^;]+;/gi) ?? [];

    for (const table of ["merchant_dictionary", "csv_format_mappings"]) {
      expect(policyStatements).not.toEqual(
        expect.arrayContaining([
          expect.stringMatching(
            new RegExp(`\\bon\\s+(?:public\\.)?${table}\\b`, "i"),
          ),
        ]),
      );
    }
  });

  it("does not define a subscriptions table", () => {
    expect(allSql()).not.toMatch(
      /create\s+table\s+if\s+not\s+exists\s+(?:public\.)?subscriptions\b/i,
    );
  });

  it("keeps the transaction verdict check aligned with TypeScript", () => {
    const definition = tableDefinition(allSql(), "transactions");

    expect(checkValues(definition, "verdict")).toEqual([...VERDICTS].sort());
  });

  it("keeps the upload status check aligned with TypeScript", () => {
    const definition = tableDefinition(allSql(), "uploads");

    expect(checkValues(definition, "status")).toEqual(
      [...UPLOAD_STATUSES].sort(),
    );
  });

  it("requires or documents the user-prefixed storage path", () => {
    const uploads = tableDefinition(allSql(), "uploads");

    expect(uploads).toMatch(/\{user_id\}\//i);
  });
});

describe("upload recompute", () => {
  it("adds the recompute timestamps additively", () => {
    const sql = allSql();

    for (const column of ["recompute_started_at", "recomputed_at"]) {
      expect(sql).toMatch(
        new RegExp(
          `add\\s+column\\s+if\\s+not\\s+exists\\s+${column}\\s+timestamptz`,
          "i",
        ),
      );
    }
  });

  // 재계산은 기존 결과를 지우고 다시 넣는다. 삭제만 커밋되고 삽입이 실패하면
  // 사용자는 멀쩡했던 보고서를 잃는다 — 세 문장이 한 함수 안에 있어야 한다.
  it("replaces transactions and the upload summary in one function body", () => {
    const source = functionSource(allSql(), "replace_upload_result");

    expect(source).toMatch(/language\s+plpgsql/i);
    expect(source).toMatch(/delete\s+from\s+public\.transactions/i);
    expect(source).toMatch(/insert\s+into\s+public\.transactions/i);
    expect(source).toMatch(/update\s+public\.uploads/i);
  });

  it("runs the replacement as security definer with an empty search_path", () => {
    const source = functionSource(allSql(), "replace_upload_result");

    expect(source).toMatch(/security\s+definer/i);
    expect(source).toMatch(/set\s+search_path\s*=\s*''/i);
  });

  // SECURITY DEFINER 는 RLS 를 우회한다. 소유자 필터가 유일한 방어선이다.
  it("scopes every write in the replacement to the owning user", () => {
    const source = functionSource(allSql(), "replace_upload_result");
    const writes = source
      .split(";")
      .filter((part) =>
        /delete\s+from\s+public\.transactions|update\s+public\.uploads/i.test(part),
      );

    expect(writes).toHaveLength(2);
    for (const write of writes) {
      expect(write).toMatch(/user_id\s*=\s*p_user_id/i);
    }
  });

  // 재계산은 실패 재시도 한도를 쓰지 않고, 성공해도 completed 를 다른 상태로
  // 옮길 이유가 없다. 둘 다 SET 절에 나타나면 안 된다 (WHERE 의 상태 가드는 별개다).
  it("leaves status and retry_count untouched when replacing a result", () => {
    const source = functionSource(allSql(), "replace_upload_result");
    const assignments = statement(
      source,
      /update\s+public\.uploads\s+set[\s\S]*?\bwhere\b/i,
    );

    expect(assignments).not.toMatch(/\bstatus\s*=/i);
    expect(assignments).not.toMatch(/\bretry_count\s*=/i);
    expect(assignments).toMatch(/\bsummary\s*=/i);
    expect(assignments).toMatch(/\brecompute_started_at\s*=\s*null/i);
  });

  it("exposes the replacement to service_role only", () => {
    const sql = allSql();
    const revoke = statement(
      sql,
      /revoke\s+execute\s+on\s+function\s+public\.replace_upload_result[^;]*;/i,
    );
    const grant = statement(
      sql,
      /grant\s+execute\s+on\s+function\s+public\.replace_upload_result[^;]*;/i,
    );

    for (const role of ["public", "anon", "authenticated"]) {
      expect(revoke.split(/\bfrom\b/i)[1]).toMatch(new RegExp(`\\b${role}\\b`, "i"));
    }
    expect(grant.split(/\bto\b/i)[1]).toMatch(/\bservice_role\b/i);
    expect(grant.split(/\bto\b/i)[1]).not.toMatch(/\b(anon|authenticated|public)\b/i);
  });

  // create or replace 는 EXECUTE 를 PUBLIC 에 자동으로 준다. 회수가 먼저 오면
  // 그 뒤의 create 가 조용히 다시 열어 놓는다.
  it("revokes the replacement after creating it", () => {
    const sql = allSql();

    expect(
      sql.search(/revoke\s+execute\s+on\s+function\s+public\.replace_upload_result/i),
    ).toBeGreaterThan(
      sql.search(/create\s+or\s+replace\s+function\s+public\.replace_upload_result/i),
    );
  });
});
