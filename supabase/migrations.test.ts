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
