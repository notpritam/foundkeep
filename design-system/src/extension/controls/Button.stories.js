import { button } from '../../card.js';
import { matrix, PSEUDO } from '../../matrix.js';

const LABELS = { primary: 'Save details', secondary: 'Create', quiet: 'Cancel' };
export default {
  title: 'Extension/Card controls/Button',
  render: args => button(args),
  args: { kind: 'primary', label: 'Save details', disabled: false },
  argTypes: { kind: { control: 'inline-radio', options: ['primary', 'secondary', 'quiet'] } },
  parameters: { surface: 'card', docs: { description: { component: 'theme.css `.btn`: 6px radius, 10×15 padding, 13px/550. **Primary** (Save details): `--button` fill, `--button-hover` on hover. **Secondary** (Add, Create): `--panel` fill with a `--line` border. **Quiet** (Cancel, Retry, New folder): no fill, `--muted` text, `--panel` on hover. Pressed moves down 1px; disabled is 50% opacity.' } } },
};
export const Primary = {};
export const Secondary = { args: { kind: 'secondary', label: 'Create' } };
export const Quiet = { args: { kind: 'quiet', label: 'Cancel' } };
export const Hover = { parameters: { pseudo: { hover: true } } };
export const Focus = { parameters: { pseudo: { focusVisible: true } } };
export const Pressed = { parameters: { pseudo: { hover: true, active: true } } };
export const Disabled = { args: { disabled: true } };
export const AllStates = {
  name: 'All variants · light & dark',
  render: () => {
    const wrap = document.createElement('div'); wrap.style.cssText = 'display:grid;gap:28px';
    for (const kind of ['primary', 'secondary', 'quiet']) {
      const title = Object.assign(document.createElement('h3'), { textContent: kind[0].toUpperCase() + kind.slice(1) });
      title.style.cssText = 'margin:0;font:600 13px/1 var(--font);color:#8a8f98';
      const make = extra => () => button({ kind, label: LABELS[kind], ...extra });
      wrap.append(title, matrix([
        { label: 'Default', make: make() }, { label: 'Hover', state: 'hover', make: make() }, { label: 'Focus', state: 'focus', make: make() },
        { label: 'Pressed', state: 'pressed', make: make() }, { label: 'Disabled', make: make({ disabled: true }) },
      ], { width: 170 }));
    }
    return wrap;
  },
  parameters: { surface: false, pseudo: PSEUDO },
};
