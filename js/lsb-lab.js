import { encodeLSB, decodeLSB, lsbCapacityBytes } from './lsb.js';

export function mountLsbLab(root) {
  if (!root || root.dataset.mounted === '1') return;
  root.dataset.mounted = '1';
  const $ = selector => root.querySelector(selector);
  const file = $('#lsbFile'), message = $('#lsbMessage'), image = $('#lsbImage');
  const inspector = $('#lsbInspector'), pixelInfo = $('#lsbPixelInfo');
  const status = $('#lsbStatus'), capacity = $('#lsbCapacity'), encode = $('#lsbEncode');
  let loaded = false, currentName = 'image';

  const say = (text, type = '') => { status.textContent = text; status.className = type; };
  const refreshCapacity = () => {
    if (!loaded) { capacity.textContent = 'Load an image to calculate its capacity.'; encode.disabled = true; return; }
    const bytes = lsbCapacityBytes(image.width, image.height);
    capacity.textContent = `${image.width} × ${image.height} pixels · ${(image.width * image.height * 3).toLocaleString()} RGB channels · ${bytes.toLocaleString()} UTF-8 payload bytes maximum`;
    encode.disabled = !message.value.length || bytes < 1;
  };
  const drawInspector = (x, y) => {
    const ctx = image.getContext('2d', { willReadFrequently: true });
    const d = ctx.getImageData(x, y, 1, 1).data;
    const values = [d[0], d[1], d[2]];
    const bits = values.map(v => v.toString(2).padStart(8, '0'));
    const zoom = inspector.getContext('2d');
    const scale = 18;
    inspector.width = scale * 8; inspector.height = scale * 8;
    zoom.imageSmoothingEnabled = false;
    zoom.fillStyle = `rgb(${values[0]},${values[1]},${values[2]})`;
    zoom.fillRect(0, 0, inspector.width, inspector.height);
    zoom.strokeStyle = 'rgba(255,255,255,.45)';
    for (let i = 0; i <= 8; i++) {
      zoom.beginPath(); zoom.moveTo(i * scale, 0); zoom.lineTo(i * scale, inspector.height); zoom.stroke();
      zoom.beginPath(); zoom.moveTo(0, i * scale); zoom.lineTo(inspector.width, i * scale); zoom.stroke();
    }
    pixelInfo.textContent = `Pixel (${x}, ${y}) · R ${values[0]} = ${bits[0]} · G ${values[1]} = ${bits[1]} · B ${values[2]} = ${bits[2]} · LSBs: ${values.map(v => v & 1).join(' / ')}`;
  };

  file.addEventListener('change', () => {
    const selected = file.files?.[0];
    if (!selected) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(selected.type)) { say('Choose a PNG, JPEG or WebP image.', 'bad'); return; }
    const url = URL.createObjectURL(selected), bitmap = new Image();
    bitmap.onload = () => {
      const maxSide = 1600, factor = Math.min(1, maxSide / Math.max(bitmap.naturalWidth, bitmap.naturalHeight));
      image.width = Math.max(1, Math.round(bitmap.naturalWidth * factor));
      image.height = Math.max(1, Math.round(bitmap.naturalHeight * factor));
      image.getContext('2d', { willReadFrequently: true }).drawImage(bitmap, 0, 0, image.width, image.height);
      URL.revokeObjectURL(url); loaded = true; currentName = selected.name.replace(/\.[^.]+$/, '') || 'image';
      refreshCapacity(); say('Image loaded. Click a pixel to inspect its RGB values and least-significant bits.');
      pixelInfo.textContent = 'Select a pixel in the image to inspect its RGB channels.';
      const ctx = inspector.getContext('2d'); ctx.clearRect(0, 0, inspector.width, inspector.height);
    };
    bitmap.onerror = () => { URL.revokeObjectURL(url); say('The image could not be decoded by this browser.', 'bad'); };
    bitmap.src = url;
  });
  message.addEventListener('input', refreshCapacity);
  image.addEventListener('click', event => {
    if (!loaded) return;
    const rect = image.getBoundingClientRect();
    const x = Math.min(image.width - 1, Math.max(0, Math.floor((event.clientX - rect.left) * image.width / rect.width)));
    const y = Math.min(image.height - 1, Math.max(0, Math.floor((event.clientY - rect.top) * image.height / rect.height)));
    drawInspector(x, y);
  });
  encode.addEventListener('click', () => {
    if (!loaded) return;
    try {
      const ctx = image.getContext('2d', { willReadFrequently: true });
      const original = ctx.getImageData(0, 0, image.width, image.height);
      const result = encodeLSB(original, message.value);
      ctx.putImageData(new ImageData(result.data, image.width, image.height), 0, 0);
      $('#lsbDecode').disabled = false; $('#lsbDownload').disabled = false;
      say(`Encoded ${result.payloadBytes} UTF-8 bytes. ${result.changedChannels.toLocaleString()} RGB channel values changed by at most 1. Download as PNG to preserve the payload.`, 'ok');
      drawInspector(0, 0);
    } catch (error) { say(error.message, 'bad'); }
  });
  $('#lsbDecode').addEventListener('click', () => {
    if (!loaded) return;
    try {
      const decoded = decodeLSB(image.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, image.width, image.height));
      $('#lsbDecoded').value = decoded;
      say('Message recovered successfully from the current image.', 'ok');
    } catch (error) { $('#lsbDecoded').value = ''; say(error.message, 'bad'); }
  });
  $('#lsbDownload').addEventListener('click', () => {
    if (!loaded) return;
    image.toBlob(blob => {
      if (!blob) { say('PNG export failed.', 'bad'); return; }
      const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = `night-cipher-lsb-${currentName}.png`; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000); say('PNG downloaded. Avoid JPEG re-saving: lossy compression can destroy LSB data.', 'ok');
    }, 'image/png');
  });
  $('#lsbReset').addEventListener('click', () => {
    loaded = false; file.value = ''; message.value = ''; $('#lsbDecoded').value = '';
    image.width = 0; image.height = 0; inspector.width = 0; inspector.height = 0;
    refreshCapacity(); say('Reset. Load an image to begin.');
    pixelInfo.textContent = 'Select a pixel in the image to inspect its RGB channels.';
    $('#lsbDecode').disabled = true; $('#lsbDownload').disabled = true;
  });
  refreshCapacity();
}
