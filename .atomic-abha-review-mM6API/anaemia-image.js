import { IMAGE_BYTES } from './anaemia/contract.js';
export function packRGB(rgb, sourceWidth = 224, sourceHeight = 224) { if (rgb.length !== IMAGE_BYTES)
    throw Error('The image crop has an invalid size.'); let binary = ''; for (let i = 0; i < rgb.length; i += 8192)
    binary += String.fromCharCode(...rgb.subarray(i, i + 8192)); return { width: 224, height: 224, format: 'rgb-u8', pixels: btoa(binary), sourceWidth, sourceHeight }; }
// Engineering fixtures, never anatomical examples or labelled clinical cases.
export function syntheticImage(kind) { const rgb = new Uint8Array(IMAGE_BYTES); for (let y = 0; y < 224; y++)
    for (let x = 0; x < 224; x++) {
        const i = (y * 224 + x) * 3, n = ((x * 37 + y * 19 + x * y * 7) % 61) - 30;
        rgb[i] = kind === 'flat' ? 125 : 150 + n;
        rgb[i + 1] = kind === 'flat' ? 125 : 94 + Math.trunc(n / 2);
        rgb[i + 2] = kind === 'flat' ? 125 : 100 + Math.trunc(n / 3);
    } return packRGB(rgb); }
export function cropImage(bitmap, crop) { if (!Object.values(crop).every(Number.isFinite) || crop.x < 0 || crop.y < 0 || crop.width < 1 || crop.height < 1 || crop.x + crop.width > 100 || crop.y + crop.height > 100)
    throw Error('Keep the crop inside the image.'); const canvas = document.createElement('canvas'); canvas.width = 224; canvas.height = 224; const ctx = canvas.getContext('2d', { willReadFrequently: true }); if (!ctx)
    throw Error('Image processing is unavailable on this device.'); const width = Math.floor(bitmap.width * crop.width / 100), height = Math.floor(bitmap.height * crop.height / 100); ctx.drawImage(bitmap, bitmap.width * crop.x / 100, bitmap.height * crop.y / 100, width, height, 0, 0, 224, 224); const rgba = ctx.getImageData(0, 0, 224, 224).data, rgb = new Uint8Array(IMAGE_BYTES); for (let i = 0; i < 224 * 224; i++) {
    rgb[i * 3] = rgba[i * 4];
    rgb[i * 3 + 1] = rgba[i * 4 + 1];
    rgb[i * 3 + 2] = rgba[i * 4 + 2];
} return packRGB(rgb, width, height); }
