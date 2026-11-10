const MAGIC = [0x4e, 0x43, 0x31]; // "NC1"
export const LSB_HEADER_BYTES = 7; // magic (3) + UTF-8 payload length (4)
const HEADER_BYTES = LSB_HEADER_BYTES;

/** Maximum UTF-8 payload bytes for RGB, one LSB per channel. */
export function lsbCapacityBytes(width, height) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) return 0;
  return Math.max(0, Math.floor((width * height * 3) / 8) - HEADER_BYTES);
}

function bytesToBits(bytes) {
  const bits = new Uint8Array(bytes.length * 8);
  for (let i = 0; i < bytes.length; i++) {
    for (let bit = 0; bit < 8; bit++) bits[i * 8 + bit] = (bytes[i] >> (7 - bit)) & 1;
  }
  return bits;
}

function bitsToBytes(bits) {
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) {
    let value = 0;
    for (let bit = 0; bit < 8; bit++) value = (value << 1) | bits[i * 8 + bit];
    bytes[i] = value;
  }
  return bytes;
}

function makePayload(message) {
  const body = new TextEncoder().encode(message);
  const header = new Uint8Array(HEADER_BYTES);
  header.set(MAGIC, 0);
  new DataView(header.buffer).setUint32(3, body.length, false);
  const payload = new Uint8Array(header.length + body.length);
  payload.set(header);
  payload.set(body, header.length);
  return payload;
}

/**
 * Encodes UTF-8 text in the least-significant bit of each RGB channel.
 * Alpha is never modified. Returns a fresh pixel buffer; the input is untouched.
 */
export function encodeLSB(imageData, message) {
  if (!imageData?.data || !Number.isInteger(imageData.width) || !Number.isInteger(imageData.height)) {
    throw new TypeError('A valid ImageData object is required.');
  }
  if (typeof message !== 'string' || !message.length) throw new Error('Enter a message before encoding.');
  const capacityBytes = lsbCapacityBytes(imageData.width, imageData.height);
  const payload = makePayload(message);
  if (payload.length - HEADER_BYTES > capacityBytes) {
    throw new Error(`Message is too large: ${payload.length - HEADER_BYTES} UTF-8 bytes, but this image holds ${capacityBytes} bytes.`);
  }
  const bits = bytesToBits(payload);
  const output = new Uint8ClampedArray(imageData.data);
  let bitIndex = 0;
  let changedChannels = 0;
  for (let i = 0; i < output.length && bitIndex < bits.length; i++) {
    if (i % 4 === 3) continue; // Preserve alpha.
    const next = (output[i] & 0xfe) | bits[bitIndex++];
    if (next !== output[i]) changedChannels++;
    output[i] = next;
  }
  return { data: output, payloadBytes: payload.length - HEADER_BYTES, capacityBytes, changedChannels };
}

/** Decodes the NC1 length-prefixed UTF-8 payload from RGB LSBs. */
export function decodeLSB(imageData) {
  if (!imageData?.data || !Number.isInteger(imageData.width) || !Number.isInteger(imageData.height)) {
    throw new TypeError('A valid ImageData object is required.');
  }
  const channelCount = imageData.width * imageData.height * 3;
  const readBytes = count => {
    const bits = new Uint8Array(count * 8);
    let bitIndex = 0;
    for (let i = 0; i < imageData.data.length && bitIndex < bits.length; i++) {
      if (i % 4 === 3) continue;
      bits[bitIndex++] = imageData.data[i] & 1;
    }
    if (bitIndex !== bits.length) throw new Error('The image does not contain enough RGB channels.');
    return bitsToBytes(bits);
  };
  if (channelCount < HEADER_BYTES * 8) throw new Error('Image is too small to contain an LSB header.');
  const header = readBytes(HEADER_BYTES);
  if (!MAGIC.every((byte, i) => header[i] === byte)) {
    throw new Error('No Night Cipher LSB payload found. This image may not have been encoded by this lab.');
  }
  const length = new DataView(header.buffer).getUint32(3, false);
  const capacityBytes = lsbCapacityBytes(imageData.width, imageData.height);
  if (length > capacityBytes) throw new Error('The payload length is invalid or the image was altered.');
  if (!length) throw new Error('The image contains an empty LSB payload.');
  const all = readBytes(HEADER_BYTES + length);
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(all.subarray(HEADER_BYTES));
  } catch {
    throw new Error('The payload header exists, but its text is not valid UTF-8. The image may have been altered.');
  }
}
