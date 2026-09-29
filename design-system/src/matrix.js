// A live overview of one control: one block per state, each showing the
// control in light and dark side by side. Blocks wrap to the canvas width, so
// nothing is ever clipped. Each theme cell takes theme.css's own token
// declarations, so both show at once whatever the toolbar says. Hover /
// focus / pressed are forced per cell by storybook-addon-pseudo-states
// through PSEUDO (pass it as parameters.pseudo).
const rules = () => [...document.styleSheets].flatMap(sheet => { try { return [...sheet.cssRules]; } catch { return []; } });
export const tokens = theme => rules().find(rule => rule.selectorText === (theme === 'dark' ? ':root[data-theme="dark"]' : ':root'))?.style.cssText || '';

export const PSEUDO = {
  hover: ['.is-hover button', '.is-hover input', '.is-hover select', '.is-hover textarea', '.is-pressed button'],
  active: ['.is-pressed button'],
  focus: ['.is-focus input', '.is-focus select', '.is-focus textarea', '.is-focus button'],
  focusVisible: ['.is-focus button', '.is-focus input'],
};

/** columns: [{ label, state?: 'hover'|'focus'|'pressed', make: () => Node }] */
export function matrix(columns, { width = 300 } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'fk-matrix';
  wrap.style.setProperty('--cell', `${width}px`);
  for (const column of columns) {
    const block = document.createElement('section');
    block.className = 'fk-state';
    block.append(Object.assign(document.createElement('h4'), { className: 'fk-head', textContent: column.label }));
    const pair = document.createElement('div'); pair.className = 'fk-pair';
    for (const theme of ['light', 'dark']) {
      const cell = document.createElement('div');
      cell.className = 'fk-cell' + (column.state ? ` is-${column.state}` : '');
      cell.dataset.theme = theme;
      cell.style.cssText = tokens(theme);
      cell.append(column.make());
      pair.append(cell);
    }
    block.append(pair);
    wrap.append(block);
  }
  return wrap;
}
