import { TRAIN, MORSE, BR } from './ciphers.js';
import { uri } from './security.js';

const alpha = letter => letter.charCodeAt(0) - 64;
const binary = value => value.toString(2).padStart(5, '0');
const escapeHtml = value => String(value).replace(/[&<>\"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
}[char]));

function describe(index, letter) {
  const value = alpha(letter);
  switch (index) {
    case 0: return { clue: (value * 12 + 10) + ' px building height', conversion: '(' + (value * 12 + 10) + ' − 10) ÷ 12 = ' + value };
    case 1: return { clue: MORSE[letter], conversion: 'Morse code for ' + letter };
    case 2: {
      const degrees = (value - 1) * 360 / 26;
      return { clue: degrees.toFixed(1) + '° needle angle', conversion: 'Angle maps to alphabet position ' + value };
    }
    case 3: return { clue: binary(value), conversion: binary(value) + '₂ = ' + value + '₁₀' };
    case 4: return { clue: 'Braille dots ' + BR[value - 1], conversion: 'Raised-dot pattern for ' + letter };
    case 5: {
      const hue = Math.floor((value - 1) / 26 * 360);
      return { clue: hue + '° hue', conversion: 'A–Z colour-wheel position ' + value };
    }
    case 6: return { clue: value + ' gold dots', conversion: 'Count the gold dots: ' + value };
    case 7: return { clue: (value + 2) + ' polygon sides', conversion: (value + 2) + ' − 2 = ' + value };
    case 8: return { clue: value + ' petals', conversion: 'Count the petals: ' + value };
    case 9: return { clue: binary(value), conversion: 'Tall = 1, short = 0; ' + binary(value) + '₂ = ' + value };
    default: return { clue: '—', conversion: '—' };
  }
}

export function mountStructuralSandbox(root) {
  if (!root || root.dataset.mounted === '1') return;
  const select = root.querySelector('#structuralScheme');
  const message = root.querySelector('#structuralMessage');
  const seed = root.querySelector('#structuralSeed');
  const seedValue = root.querySelector('#structuralSeedValue');
  const preview = root.querySelector('#structuralPreview');
  const capacity = root.querySelector('#structuralCapacity');
  const breakdown = root.querySelector('#structuralBreakdown');
  const status = root.querySelector('#structuralStatus');

  select.innerHTML = TRAIN.map((item, index) =>
    '<option value="' + index + '">' + (index + 1) + '. ' + escapeHtml(item.n) + '</option>'
  ).join('');

  function render() {
    const raw = message.value.toUpperCase();
    const clean = raw.replace(/[^A-Z]/g, '').slice(0, 12);
    const index = Number(select.value);
    const cipher = TRAIN[index];
    seedValue.textContent = seed.value;
    if (!clean) {
      preview.removeAttribute('src');
      preview.alt = 'Enter letters A to Z to generate a structural cipher image';
      capacity.textContent = 'Enter at least one letter to calculate the nominal symbol capacity.';
      breakdown.innerHTML = '<p class="report-empty">The letter-by-letter encoding breakdown will appear here.</p>';
      status.textContent = 'Only English letters A–Z are supported by these training schemes.';
      return;
    }
    const svg = cipher.g(clean, Number(seed.value));
    preview.src = uri(svg);
    preview.alt = cipher.n + ' structural encoding of ' + clean;
    const rows = [...clean].map((letter, position) => {
      const detail = describe(index, letter);
      return '<tr><td>' + (position + 1) + '</td><td><b>' + letter + '</b></td><td>' +
        escapeHtml(detail.clue) + '</td><td>' + escapeHtml(detail.conversion) + '</td></tr>';
    }).join('');
    breakdown.innerHTML = '<div class="sandbox-table-wrap"><table class="sandbox-table"><thead><tr><th>#</th><th>Letter</th><th>Visible state</th><th>Decoding rule</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    if (index === 1) {
      const marks = [...clean].reduce((total, letter) => total + MORSE[letter].length, 0);
      capacity.textContent = clean.length + ' letter groups · ' + marks + ' Morse marks · variable-length code. Morse has no fixed bits-per-letter capacity; spacing is part of the decoding.';
    } else {
      const bits = clean.length * Math.log2(26);
      capacity.textContent = clean.length + ' visual groups · 26 nominal states per group · ' +
        bits.toFixed(2) + ' theoretical bits across this message (log₂ 26 per group). This is an alphabet-level upper bound, not a guarantee of reliable visual decoding.';
    }
    status.textContent = 'Live preview uses the existing ' + cipher.n + ' training encoder. Change the message or scheme to see the encoded structure update.';
  }

  message.addEventListener('input', render);
  select.addEventListener('change', render);
  seed.addEventListener('input', render);
  root.dataset.mounted = '1';
  render();
}
