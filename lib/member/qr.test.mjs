import {BrowserQRCodeReader} from '@zxing/browser';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import vm from 'node:vm';
const frameExported={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('../pt-camera.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports:frameExported});
const exported = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(new URL('./qr.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, { exports: exported, TextEncoder });

test('QR byte payload round trips with valid Reed-Solomon syndromes', () => {
  const token = 'repup-demo-only:12345678-1234-4321-8123-123456789abc';
  const svg = decodeURIComponent(exported.demoQRDataURL(token).split(',').slice(1).join(','));
  const matrix = Array.from({ length: 29 }, () => Array(29).fill(0));
  for (const match of svg.matchAll(/M(\d+),(\d+)h1v1h-1z/g)) matrix[Number(match[2]) - 4][Number(match[1]) - 4] = 1;
  // Independently identify version-3 function regions before reading the payload.
  const reserved = (x, y) => x === 6 || y === 6 || (x <= 8 && y <= 8) || (x >= 21 && y <= 8) || (x <= 8 && y >= 21) || (x >= 20 && x <= 24 && y >= 20 && y <= 24);
  const bits = [];
  for (let column = 28; column > 0; column -= 2) {
    if (column === 6) column--;
    const upward = ((column + 1) & 2) === 0;
    for (let row = 0; row < 29; row++) for (let side = 0; side < 2; side++) {
      const x = column - side, y = upward ? 28 - row : row;
      if (!reserved(x, y)) bits.push(matrix[y][x] ^ Number((x + y) % 2 === 0));
    }
  }
  assert.equal(bits.length, 567);
  const number = values => values.reduce((value, bit) => value * 2 + bit, 0);
  assert.equal(number(bits.slice(0, 4)), 4);
  const length = number(bits.slice(4, 12));
  assert.equal(length, token.length);
  const bytes = Array.from({ length }, (_, i) => number(bits.slice(12 + i * 8, 20 + i * 8)));
  assert.equal(Buffer.from(bytes).toString(), token);
  const words = Array.from({ length: 70 }, (_, i) => number(bits.slice(i * 8, i * 8 + 8)));
  const gf = (a, b) => { let product = 0; while (b) { if (b & 1) product ^= a; a <<= 1; if (a & 256) a ^= 0x11d; b >>= 1; } return product; };
  let root = 1;
  for (let i = 0; i < 15; i++) { assert.equal(words.reduce((value, word) => gf(value, root) ^ word, 0), 0); root = gf(root, 2); }
  assert.equal(matrix[21][8], 1);
});
test('QR enforces UTF-8 byte capacity', () => {
  assert.doesNotThrow(() => exported.demoQRDataURL('a'.repeat(53)));
  assert.throws(() => exported.demoQRDataURL('a'.repeat(54)), /too long/);
  assert.throws(() => exported.demoQRDataURL('é'.repeat(27)), /too long/);
});


test('camera fallback decodes the actual PT QR raster without native BarcodeDetector',()=>{
 const token='pt-demo:11111111-1111-4111-8111-111111111111';
 const svg=decodeURIComponent(exported.demoQRDataURL(token).split(',').slice(1).join(','));
 const scale=8;const width=37*scale;const pixels=new Uint8ClampedArray(width*width*4).fill(255);
 for(const match of svg.matchAll(/M(\d+),(\d+)h1v1h-1z/g)){
  const left=Number(match[1])*scale;const top=Number(match[2])*scale;
  for(let y=top;y<top+scale;y++)for(let x=left;x<left+scale;x++){const index=(y*width+x)*4;pixels[index]=17;pixels[index+1]=21;pixels[index+2]=17;}
 }
 const rotated=new Uint8ClampedArray(pixels.length);for(let i=0;i<width*width;i++)rotated.set(pixels.subarray(i*4,i*4+4),(width*width-1-i)*4);
 let flipped=false;const context={setTransform:a=>{flipped=a===-1;},drawImage:()=>{},getImageData:()=>({data:flipped?rotated:pixels})};
 const canvas={width,height:width,getContext:()=>context};
 assert.equal(frameExported.decodePTCameraFrame(new BrowserQRCodeReader(),canvas,{videoWidth:width,videoHeight:width}),token);
});
