import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { logger } from './logger.js';

export class AgentQueue {
  private db: DatabaseSync;

  constructor(dataDir: string) {
    fs.mkdirSync(dataDir, { recursive: true });
    const dbPath = path.join(dataDir, 'queue.db');
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA journal_mode = WAL');
    this.initialize();
  }

  private initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS config (
        key   TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS command_queue (
        id          TEXT PRIMARY KEY,
        type        TEXT NOT NULL,
        params      TEXT,
        status      TEXT NOT NULL DEFAULT 'pending',
        error       TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);
  }

  get(key: string): string | null {
    const stmt = this.db.prepare('SELECT value FROM config WHERE key = ?');
    const row = stmt.get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  set(key: string, value: string) {
    const stmt = this.db.prepare('INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)');
    stmt.run(key, value);
  }

  enqueueCommand(id: string, type: string, params?: string) {
    const stmt = this.db.prepare('INSERT OR IGNORE INTO command_queue (id, type, params) VALUES (?, ?, ?)');
    stmt.run(id, type, params ?? null);
    logger.info(`Command queued locally: ${type} (${id})`);
  }

  dequeuePending(): Array<{ id: string; type: string; params: string | null }> {
    const stmt = this.db.prepare('SELECT id, type, params FROM command_queue WHERE status = ? ORDER BY created_at ASC LIMIT 10');
    return stmt.all('pending') as Array<{ id: string; type: string; params: string | null }>;
  }

  markCommandCompleted(id: string) {
    const stmt = this.db.prepare("UPDATE command_queue SET status = 'completed' WHERE id = ?");
    stmt.run(id);
  }

  markCommandFailed(id: string, error: string) {
    const stmt = this.db.prepare('UPDATE command_queue SET status = ?, error = ? WHERE id = ?');
    stmt.run('failed', error, id);
  }

  close() {
    this.db.close();
  }
}
