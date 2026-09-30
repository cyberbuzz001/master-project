declare module 'lru-cache' {
  class LRU<K = any, V = any> {
    constructor(options?: { max?: number; maxAge?: number; ttl?: number; [key: string]: any });
    set(key: K, value: V, maxAge?: number): any;
    get(key: K): V | undefined;
    has(key: K): boolean;
    del(key: K): boolean;
    delete(key: K): boolean;
    reset(): void;
    clear(): void;
    keys(): any;
    values(): any;
    readonly length: number;
    readonly size: number;
  }
  export default LRU;
  export = LRU;
}
