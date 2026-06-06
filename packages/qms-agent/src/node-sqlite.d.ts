declare module 'node:sqlite' {
  interface DatabaseSyncOptions {
    open?: boolean;
  }

  interface StatementResulting {
    changes: number;
    lastInsertRowid: number | bigint;
  }

  export class DatabaseSync {
    constructor(location: string, options?: DatabaseSyncOptions);
    exec(sql: string): StatementResulting;
    prepare(sql: string): StatementSync;
    close(): void;
  }

  interface StatementSync {
    get(...params: unknown[]): Record<string, unknown> | undefined;
    all(...params: unknown[]): Record<string, unknown>[];
    run(...params: unknown[]): StatementResulting;
  }
}