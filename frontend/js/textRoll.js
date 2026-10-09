export function textRoll(control, label) {
  control.classList.add('roll-link');
  control.setAttribute('aria-label', label);
  const text = document.createElement('span'); text.className = 'roll-text'; text.setAttribute('aria-hidden', 'true');
  for (const copy of [false, true]) {
    const row = document.createElement('span'); row.className = copy ? 'roll-copy' : 'roll-original';
    Array.from(label).forEach((letter, index, letters) => {
      const character = document.createElement('span'); character.textContent = letter === ' ' ? '\u00a0' : letter;
      character.style.setProperty('--delay', `${Math.abs(index - (letters.length - 1) / 2) * 35}ms`);
      row.append(character);
    });
    text.append(row);
  }
  control.replaceChildren(text);
}
