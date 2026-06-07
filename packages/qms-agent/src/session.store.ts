import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { logger } from './logger.js';

export interface SessionData {
  agentId: string;
  token: string;
}

export class SessionStore {
  private db: DatabaseSync;

  constructor(dataDir: string) {
    const dbPath = path.join(dataDir, 'queue.db');
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.initialize();
  }

  private initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS session (
        id         TEXT PRIMARY KEY,
        token      TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  setSession(agentId: string, token: string): void {
    const stmt = this.db.prepare(
      'INSERT OR REPLACE INTO session (id, token, updated_at) VALUES (?, ?, datetime(\'now\'))',
    );
    stmt.run(agentId, token);
    logger.info('Session saved to local store');
  }

  getSession(): SessionData | null {
    const stmt = this.db.prepare('SELECT id, token FROM session ORDER BY updated_at DESC LIMIT 1');
    const row = stmt.get() as { id: string; token: string } | undefined;
    if (!row?.id || !row?.token) return null;
    return { agentId: row.id, token: row.token };
  }

  clearSession(): void {
    this.db.exec('DELETE FROM session');
    logger.info('Session cleared from local store');
  }

  close(): void {
    this.db.close();
  }
}
