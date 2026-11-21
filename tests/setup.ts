import { beforeEach } from 'vitest';

/** Minimal in-memory localStorage, so career and settings code runs under Node. */
class MemoryStorage {
  private data = new Map<string, string>();
  get length(): number {
    return this.data.size;
  }
  clear(): void {
    this.data.clear();
  }
  getItem(key: string): string | null {
    return this.data.has(key) ? (this.data.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
  key(i: number): string | null {
    return [...this.data.keys()][i] ?? null;
  }
}

(globalThis as { localStorage?: Storage }).localStorage = new MemoryStorage() as unknown as Storage;

beforeEach(() => localStorage.clear());
