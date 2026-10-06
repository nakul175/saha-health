// Valid synthetic RGB noise PNG, not a patient photograph; real decoder can render it.
import {deflateSync} from 'node:zlib';
function crc(b){let n=0xffffffff;for(const x of b){n^=x;for(let k=0;k<8;k++)n=(n>>>1)^((n&1)?0xedb88320:0);}return (n^0xffffffff)>>>0;}
function chunk(type,b){const head=Buffer.from(type),all=Buffer.concat([head,b]),out=Buffer.alloc(12+b.length);out.writeUInt32BE(b.length);all.copy(out,4);out.writeUInt32BE(crc(all),8+b.length);return out;}
export function syntheticPng(width=480,height=480,seed=3){const raw=Buffer.alloc(height*(width*3+1));let state=seed;for(let y=0;y<height;y++)for(let x=1;x<=width*3;x++){state^=state<<13;state^=state>>>17;state^=state<<5;raw[y*(width*3+1)+x]=state&255;}const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=2;return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);}
