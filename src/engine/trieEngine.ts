export class BinaryTrieEngine {
  private data: Uint32Array;

  constructor(buffer: ArrayBuffer | Uint8Array) {
    const view =
      buffer instanceof Uint8Array
        ? new Uint32Array(buffer.buffer, buffer.byteOffset, buffer.byteLength / 4)
        : new Uint32Array(buffer);
    this.data = view;
  }

  public hasWord(word: string): boolean {
    const upper = word.trim().toUpperCase();
    if (upper.length < 2 || this.data.length === 0) return false;

    let offset = 0;
    for (let i = 0; i < upper.length; i++) {
      const charIdx = upper.charCodeAt(i) - 65;
      if (charIdx < 0 || charIdx > 25) return false;

      const mask = this.data[offset];
      if ((mask & (1 << charIdx)) === 0) return false;

      const lowerMask = mask & ((1 << charIdx) - 1);
      const childSlot = this.popcount(lowerMask);
      offset = this.data[offset + 1 + childSlot];
    }

    return (this.data[offset] & (1 << 26)) !== 0;
  }

  private popcount(n: number): number {
    n = n - ((n >>> 1) & 0x55555555);
    n = (n & 0x33333333) + ((n >>> 2) & 0x33333333);
    return (((n + (n >>> 4)) & 0x0f0f0f0f) * 0x01010101) >>> 24;
  }
}
