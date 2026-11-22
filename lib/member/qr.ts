// Fixed version 3-L QR encoder for short, nonpersonal demo tokens (53 UTF-8 bytes).
// Byte mode, Reed-Solomon parity, mask 0. No network or third-party service.
export function demoQRDataURL(token: string): string {
  const bytes = new TextEncoder().encode(token);
  if (bytes.length > 53) throw new Error('Demo QR token too long');
  const bits: number[] = [];
  const append = (value: number, length: number) => { for (let i = length - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  append(4, 4); append(bytes.length, 8); bytes.forEach(value => append(value, 8));
  append(0, Math.min(4, 440 - bits.length));
  while (bits.length % 8) bits.push(0);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) data.push(bits.slice(i, i + 8).reduce((value, bit) => value * 2 + bit, 0));
  for (let i = 0; data.length < 55; i++) data.push(i % 2 ? 0x11 : 0xec);
  const multiply = (a: number, b: number) => { let result = 0; for (let i = 7; i >= 0; i--) { result = (result << 1) ^ ((result >>> 7) * 0x11d); result ^= ((b >>> i) & 1) * a; } return result; };
  const divisor = Array<number>(15).fill(0); divisor[14] = 1;
  let root = 1;
  for (let i = 0; i < 15; i++) { for (let j = 0; j < 15; j++) { divisor[j] = multiply(divisor[j], root); if (j + 1 < 15) divisor[j] ^= divisor[j + 1]; } root = multiply(root, 2); }
  const parity = Array<number>(15).fill(0);
  for (const value of data) { const factor = value ^ parity.shift()!; parity.push(0); for (let i = 0; i < 15; i++) parity[i] ^= multiply(divisor[i], factor); }
  const codewords = [...data, ...parity];
  const size = 29;
  const modules = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
  const set = (x: number, y: number, dark: boolean) => { modules[y][x] = dark; reserved[y][x] = true; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const x = cx + dx, y = cy + dy, distance = Math.max(Math.abs(dx), Math.abs(dy)); if (x >= 0 && y >= 0 && x < size && y < size) set(x, y, distance !== 2 && distance !== 4); }
  }
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(22 + dx, 22 + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  const format = 0x77c4; // Error correction L, mask 0, BCH-protected format bits.
  const bit = (index: number) => ((format >>> index) & 1) !== 0;
  for (let i = 0; i <= 5; i++) set(8, i, bit(i));
  set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
  set(8, size - 8, true);
  let index = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical++) for (let offset = 0; offset < 2; offset++) {
      const x = right - offset, y = ((right + 1) & 2) === 0 ? size - 1 - vertical : vertical;
      if (reserved[y][x]) continue;
      const dark = index < codewords.length * 8 && ((codewords[index >>> 3] >>> (7 - (index & 7))) & 1) !== 0;
      modules[y][x] = dark !== ((x + y) % 2 === 0); index++;
    }
  }
  const path = modules.flatMap((row, y) => row.flatMap((dark, x) => dark ? [`M${x + 4},${y + 4}h1v1h-1z`] : [])).join('');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 37 37" shape-rendering="crispEdges"><path fill="white" d="M0 0h37v37H0z"/><path fill="#111511" d="${path}"/></svg>`)}`;
}
