import "server-only";
import { getEnv } from "./cf";

type Param = string | number | null;

export async function db(): Promise<D1Database> {
  return (await getEnv()).DB;
}

export async function all<T>(sql: string, ...params: Param[]): Promise<T[]> {
  const { results } = await (await db())
    .prepare(sql)
    .bind(...params)
    .all<T>();
  return results;
}

export async function first<T>(sql: string, ...params: Param[]): Promise<T | null> {
  return (await db())
    .prepare(sql)
    .bind(...params)
    .first<T>();
}

export async function run(sql: string, ...params: Param[]): Promise<D1Result> {
  return (await db())
    .prepare(sql)
    .bind(...params)
    .run();
}

/** Runs several statements atomically. */
export async function batch(statements: [string, ...Param[]][]): Promise<D1Result[]> {
  const d = await db();
  return d.batch(statements.map(([sql, ...params]) => d.prepare(sql).bind(...params)));
}

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
