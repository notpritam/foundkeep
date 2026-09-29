import { el, frame, specimens } from './lib.js';
import { card } from './builders.js';

const content = () => [el('<strong style="font: var(--fk-text-title)">The half-life of a good idea</strong>'), el('<span style="color: var(--muted)">A surface that groups controls: 16px padding, 16px corners, a 1px line.</span>')];
export default {
  title: 'Components/Card',
  render: args => frame(card({ ...args, children: content() }), 360),
  args: { raised: false },
  parameters: { layout: 'centered', docs: { description: { component: '`.fk-card` — the surface a group of controls sits on: `--card` fill, 1px `--line`, 16px corners and padding, 12px between its children. **raised** adds the card shadow for surfaces that float over a page (the Add details card is framed and gets its shadow from the dock).' } } },
};
export const Default = {};
export const Raised = { args: { raised: true } };
