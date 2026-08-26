import * as SQLite from 'expo-sqlite';
import { migrateDatabase } from './migrations';

let databasePromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('mamacare.db').then(async (database) => {
      await database.execAsync('PRAGMA foreign_keys = ON;');
      await migrateDatabase(database);
      return database;
    });
  }
  return databasePromise;
}
