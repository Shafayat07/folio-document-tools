/** Small insertion-ordered LRU with an eviction hook. */
export class Lru<K, V> {
  private map = new Map<K, V>();

  constructor(
    private capacity: number,
    private onEvict?: (key: K, value: V) => void,
  ) {}

  get(key: K): V | undefined {
    if (!this.map.has(key)) return undefined;
    const value = this.map.get(key)!;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  set(key: K, value: V): void {
    if (this.map.has(key)) {
      const previous = this.map.get(key)!;
      if (previous !== value) this.onEvict?.(key, previous);
      this.map.delete(key);
    }
    this.map.set(key, value);
    while (this.map.size > this.capacity) {
      const oldest = this.map.keys().next();
      if (oldest.done) break;
      const evicted = this.map.get(oldest.value)!;
      this.map.delete(oldest.value);
      this.onEvict?.(oldest.value, evicted);
    }
  }

  delete(key: K): void {
    if (!this.map.has(key)) return;
    const value = this.map.get(key)!;
    this.map.delete(key);
    this.onEvict?.(key, value);
  }

  /** Remove every entry whose key satisfies the predicate. */
  deleteWhere(predicate: (key: K) => boolean): void {
    [...this.map.keys()].filter(predicate).forEach((key) => this.delete(key));
  }

  clear(): void {
    [...this.map.keys()].forEach((key) => this.delete(key));
  }

  get size() {
    return this.map.size;
  }
}
