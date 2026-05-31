declare module 'node:sqlite' {
  export interface DatabaseSyncOptions {
    readonly?: boolean;
  }

  export interface StatementSyncResult {
    lastInsertRowid: number | bigint;
    changes: number;
  }

  export class StatementSync {
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): StatementSyncResult;
    sourceSQL: string;
  }

  export class DatabaseSync {
    constructor(path: string, options?: DatabaseSyncOptions);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
    close(): void;
  }

  export default DatabaseSync;
}
