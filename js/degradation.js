// Browser-local, deterministic image transformations for robustness experiments.
export const DEGRADATION_PROFILES = [
  { id: 'jpeg55', label: 'JPEG compression · 55%', description: 'Lossy JPEG re-encoding at quality 0.55.' },
  { id: 'downscale50', label: 'Downscale · 50%', description: 'Reduce each dimension by half, then enlarge to the original size.' },
  { id: 'blur2', label: 'Gaussian blur · 2 px', description: 'Apply a 2-pixel canvas blur before raster export.' },
  { id: 'noise18', label: 'Pixel noise · ±18', description: 'Add deterministic RGB noise while preserving alpha.' },
  { id: 'crop12', label: 'Center crop · 12%', description: 'Remove 12% from each edge and stretch the remaining image.' }
];
const loadImage = src => new Promise((resolve, reject) => {
  const image = new Image();
  image.onload = () => resolve(image);
  image.onerror = () => reject(new Error('Could not decode the source image.'));
  image.src = src;
});
const canvas = (width, height) => {
  const node = document.createElement('canvas');
  node.width = width; node.height = height;
  return node;
};
const exportImage = (node, mime = 'image/png', quality) => {
  const dataUrl = mime === 'image/jpeg' ? node.toDataURL(mime, quality) : node.toDataURL('image/png');
  return { dataUrl, mime: mime === 'image/jpeg' ? 'image/jpeg' : 'image/png', bytes: Math.max(0, Math.round((dataUrl.length - dataUrl.indexOf(',') - 1) * .75)) };
};
export async function createDegradationVariants(sourceDataUrl) {
  if (typeof document === 'undefined') throw new Error('Image degradation requires a browser canvas.');
  if (typeof sourceDataUrl !== 'string' || !sourceDataUrl.startsWith('data:image/')) throw new Error('A local image data URL is required.');
  const image = await loadImage(sourceDataUrl), width = image.naturalWidth, height = image.naturalHeight;
  if (!width || !height || width > 4096 || height > 4096 || width * height > 8000000) throw new Error('Source image dimensions are invalid or too large (maximum 4096 px per side and 8 megapixels).');
  const base = canvas(width, height), baseCtx = base.getContext('2d', { willReadFrequently: true });
  baseCtx.drawImage(image, 0, 0, width, height);
  const variants = [];
  const add = (id, output, mime, quality) => {
    const profile = DEGRADATION_PROFILES.find(item => item.id === id), encoded = exportImage(output, mime, quality);
    variants.push({ ...profile, ...encoded, width, height });
  };
  add('jpeg55', base, 'image/jpeg', .55);

  const half = canvas(Math.max(1, Math.round(width / 2)), Math.max(1, Math.round(height / 2)));
  half.getContext('2d').drawImage(image, 0, 0, half.width, half.height);
  const enlarged = canvas(width, height);
  enlarged.getContext('2d').drawImage(half, 0, 0, width, height);
  add('downscale50', enlarged);

  const blurred = canvas(width, height), blurCtx = blurred.getContext('2d');
  blurCtx.filter = 'blur(2px)'; blurCtx.drawImage(image, 0, 0, width, height); blurCtx.filter = 'none';
  add('blur2', blurred);

  const noisy = canvas(width, height), noiseCtx = noisy.getContext('2d', { willReadFrequently: true });
  noiseCtx.drawImage(image, 0, 0, width, height);
  const pixels = noiseCtx.getImageData(0, 0, width, height), data = pixels.data;
  let seed = 0xC0FFEE;
  const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < data.length; i += 4) for (let channel = 0; channel < 3; channel++) data[i + channel] = Math.max(0, Math.min(255, data[i + channel] + Math.round((random() * 2 - 1) * 18)));
  noiseCtx.putImageData(pixels, 0, 0);
  add('noise18', noisy);

  const cropped = canvas(width, height), cropCtx = cropped.getContext('2d');
  const insetX = Math.round(width * .12), insetY = Math.round(height * .12);
  cropCtx.drawImage(image, insetX, insetY, Math.max(1, width - insetX * 2), Math.max(1, height - insetY * 2), 0, 0, width, height);
  add('crop12', cropped);
  return variants;
}
