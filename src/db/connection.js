import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const schemaPath = fileURLToPath(new URL('./schema.sql', import.meta.url));
const defaultPath = path.resolve(process.cwd(), 'data/event-ticketing.sqlite');

export function createDatabase(filename = process.env.DATABASE_PATH ?? defaultPath) {
  if (filename !== ':memory:') mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const database = new DatabaseSync(filename);
  database.exec(readFileSync(schemaPath, 'utf8'));
  return database;
}
