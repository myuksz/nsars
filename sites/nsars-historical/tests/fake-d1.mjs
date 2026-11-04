import { DatabaseSync } from "node:sqlite";

export function createFakeD1() {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec("PRAGMA foreign_keys = ON");

  const database = {
    prepare(sql) {
      return new FakeD1Statement(sqlite, sql);
    },
    async batch(statements) {
      sqlite.exec("BEGIN IMMEDIATE");
      try {
        const results = [];
        for (const statement of statements) results.push(await statement.run());
        sqlite.exec("COMMIT");
        return results;
      } catch (error) {
        sqlite.exec("ROLLBACK");
        throw error;
      }
    },
    close() {
      sqlite.close();
    },
  };

  return database;
}

class FakeD1Statement {
  constructor(sqlite, sql, bindings = []) {
    this.sqlite = sqlite;
    this.sql = sql;
    this.bindings = bindings;
  }

  bind(...bindings) {
    return new FakeD1Statement(this.sqlite, this.sql, bindings);
  }

  async run() {
    const result = this.sqlite.prepare(this.sql).run(...this.bindings);
    return {
      success: true,
      results: [],
      meta: {
        changes: Number(result.changes ?? 0),
        last_row_id: Number(result.lastInsertRowid ?? 0),
      },
    };
  }

  async first(column) {
    const row = this.sqlite.prepare(this.sql).get(...this.bindings) ?? null;
    return column && row ? row[column] ?? null : row;
  }

  async all() {
    const results = this.sqlite.prepare(this.sql).all(...this.bindings);
    return { success: true, results, meta: { changes: 0 } };
  }
}
