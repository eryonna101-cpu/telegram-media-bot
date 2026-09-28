import Database from "better-sqlite3";
import path from "node:path";
import { env } from "../config/env.js";
import { logger } from "../utils/logger.js";
import { runMigrations } from "./migrations/runner.js";

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = env.DATABASE_URL
    ? env.DATABASE_URL.replace(/^sqlite:\/\//, "")
    : path.join(env.DATA_DIR, "bot.db");

  logger.info({ dbPath }, "Opening SQLite database");

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.pragma("busy_timeout = 5000");

  runMigrations(db);
  dbInstance = db;
  return db;
}

export function closeDb(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}