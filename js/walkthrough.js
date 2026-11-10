import { TRAIN, MORSE, BR, annotate } from './ciphers.js';
import { uri } from './security.js';

const alpha = letter => letter.charCodeAt(0) - 64;
const binary = value => value.toString(2).padStart(5, '0');
const esc = value => String(value).replace(/[&<>"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
}[char]));

function describeCipher(index, word) {
  const entries = [...word].map((letter, position) => {
    const value = alpha(letter);
    let symbol = '', conversion = '';
    switch (index) {
      case 0:
        symbol = `${value * 12 + 10} px building height`;
        conversion = `(${value * 12 + 10} − 10) ÷ 12 = ${value}`;
        break;
      case 1:
        symbol = MORSE[letter];
        conversion = `${symbol} = ${letter} in International Morse code`;
        break;
      case 2: {
        const degrees = ((value - 1) * 360 / 26);
        symbol = `${degrees.toFixed(1)}° clockwise from A`;
        conversion = `(${degrees.toFixed(1)} ÷ 360 × 26) + 1 ≈ ${value}`;
        break;
      }
      case 3:
        symbol = binary(value);
        conversion = `${binary(value)}₂ = ${value}_{10}`;
        break;
      case 4: {
        const pattern = BR[value - 1];
        symbol = [...pattern].join(' · ');
        conversion = `Raised Braille dot positions: ${pattern}`;
        break;
      }
      case 5: {
        const hue = Math.floor((value - 1) / 26 * 360);
        symbol = `${hue}° hue`;
        conversion = `Match the balloon to swatch ${value} in the A–Z key`;
        break;
      }
      case 6:
        symbol = `${value} gold dots`;
        conversion = `Count the gold dots: ${value}`;
        break;
      case 7:
        symbol = `${value + 2} polygon sides`;
        conversion = `${value + 2} − 2 = ${value}`;
        break;
      case 8:
        symbol = `${value} petals`;
        conversion = `Count the petals: ${value}`;
        break;
      case 9:
        symbol = binary(value);
        conversion = `Tall = 1, short = 0; ${binary(value)}₂ = ${value}_{10}`;
        break;
    }
    return { position: position + 1, letter, value, symbol, conversion };
  });
  return entries;
}

function methodExplanation(index) {
  const methods = [
    'Each building represents one letter. Measure the building body from the baseline: its height is 10 + 12 × the letter value. Ignore the decorative roof and windows.',
    'Read each group of golden marks from left to right. A short round mark is a dot (·), a long rounded bar is a dash (−), and the wider gap marks the next letter.',
    'Each compass needle represents one letter. The red reference tick is A; the needle rotates clockwise in 26 equal steps around the dial.',
    'Each building has five windows. Read them from top to bottom: a lit window is 1 and a dark window is 0. The five bits form a binary number.',
    'Each framed 2×3 cell is one Braille letter. A gold dot is raised. Dot numbering runs down the left column (1–2–3), then down the right (4–5–6).',
    'Use the colour strip at the top as the A–Z key. Match each balloon to its swatch; the hue wheel is divided into 26 ordered positions.',
    'Each framed cluster is one letter. Count only the gold dots; the unused dark positions are part of the 26-position visual range.',
    'Each polygon represents one letter. Count its edges: triangle (3 sides) is A, quadrilateral (4) is B, and so on.',
    'Each flower represents one letter. Count the separate gold petals around the centre; the centre itself is not a petal.',
    'Each framed group contains five bars. Read from left to right: tall is 1, short is 0. Convert the five-bit binary value to a number.'
  ];
  return methods[index];
}

function renderTable(entries) {
  return `<div class="walk-table-wrap"><table class="walk-table">
    <thead><tr><th>#</th><th>Letter</th><th>Visible clue</th><th>Conversion</th></tr></thead>
    <tbody>${entries.map(entry => `<tr>
      <td>${entry.position}</td><td><b>${entry.letter}</b></td>
      <td>${esc(entry.symbol)}</td><td>${esc(entry.conversion)}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

export function mountCipherWalkthrough(root) {
  if (!root || root.dataset.mounted === '1') return;
  const select = root.querySelector('#walkScheme');
  const image = root.querySelector('#walkImage');
  const content = root.querySelector('#walkStepContent');
  const progress = root.querySelector('#walkProgress');
  const previous = root.querySelector('#walkPrevious');
  const next = root.querySelector('#walkNext');
  const reveal = root.querySelector('#walkReveal');
  let index = 0, step = 0;

  select.innerHTML = TRAIN.map((item, i) =>
    `<option value="${i}">Level ${i + 1} · ${esc(item.n)}</option>`
  ).join('');

  function render() {
    const cipher = TRAIN[index];
    const entries = describeCipher(index, cipher.m);
    const svg = cipher.g(cipher.m, 700 + index);
    const annotated = annotate(svg, index);
    const imageSvg = step === 3 ? annotated : svg;
    image.src = uri(imageSvg);
    image.alt = step === 3
      ? `Annotated ${cipher.n} cipher example`
      : `${cipher.n} cipher example`;
    progress.textContent = `Step ${step + 1} of 4`;
    previous.disabled = step === 0;
    next.disabled = step === 3;
    reveal.hidden = step !== 2;
    next.textContent = step === 2 ? 'Show annotated solution →' : 'Next step →';

    const panels = [
      `<h3>1. Observe the picture</h3>
       <p>Before decoding, identify repeated objects and look for a property that changes from one group to the next.</p>
       <p class="walk-prompt"><b>What to notice:</b> ${esc(cipher.h[0])}</p>
       <p class="walk-muted">This training example uses a fixed message so the same cipher can be studied repeatedly.</p>`,
      `<h3>2. Identify the encoding rule</h3>
       <p>${esc(methodExplanation(index))}</p>
       <p class="walk-prompt"><b>Rule in the training set:</b> ${esc(cipher.s)}</p>
       <p class="walk-muted">The important distinction is between the visible symbol and the numeric or alphabetic value it represents.</p>`,
      `<h3>3. Convert each group</h3>
       <p>Apply the rule independently to each group, then read the resulting letters from left to right.</p>
       ${renderTable(entries)}
       <p class="walk-muted">For binary encodings, the leftmost bit is the most significant bit. Alphabet values use A = 1 through Z = 26.</p>`,
      `<h3>4. Verify the decoded message</h3>
       <p class="walk-answer">Decoded message: <b>${esc(cipher.m)}</b></p>
       <p>The image now highlights the symbols used by the decoder and labels each recovered letter. Compare the highlighted groups with the conversion table from the previous step.</p>
       <p class="walk-muted">This is the deterministic training example, not an AI-generated round. The explanation is derived from the same training scheme definition used by Learn.</p>`
    ];
    content.innerHTML = panels[step];
  }

  select.addEventListener('change', () => {
    index = Number(select.value);
    step = 0;
    render();
  });
  previous.addEventListener('click', () => {
    if (step > 0) { step--; render(); }
  });
  next.addEventListener('click', () => {
    if (step < 3) { step++; render(); }
  });
  reveal.addEventListener('click', () => {
    step = 3;
    render();
  });
  root.dataset.mounted = '1';
  render();
}
