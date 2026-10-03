// Ask Kit (2026-10-03): the conversation, four ways, side by side and live. The buttons switch
// every phone between just opened, one question and a follow-up (no reload), and light or dark.
import '../brand/brand.css';

function fourConversations() {
  const el = document.createElement('div');
  el.className = 'bt';
  const looks = [
    ['proposals-ask-kit--chat', 'A conversation: your questions and Kit’s answers, the saves it found in a row of cards'],
    ['proposals-ask-kit--grid', 'Answers laid out like the Library; earlier turns fold to one line'],
    ['proposals-ask-kit--half', 'A half sheet: the Library above becomes Kit’s answer, the conversation stays below'],
    ['proposals-ask-kit--trail', 'No bubbles: what Kit understood, as chips you can take away; the saves as a list'],
  ];
  const src = (id, theme, state) => `./app/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent(`device:iphone-17-pro;theme:${theme}`)}&args=${encodeURIComponent(`state:${state}`)}`;
  el.innerHTML = `
    <header class="bt-intro"><div><h1>Ask Kit</h1><p>Pritam picked “Ask Kit” above the dock, opening at the bottom by the thumb — and asked for a conversation: “recent post I saved from Twitter”, then “about cats”, and Kit keeps up, narrowing what was asked instead of starting over. Four ways to hold it. Under each: what to ask next, as chips, and the field. Type or tap in any phone. Kit here is a stand-in reading the sample library; the real one answers on the backend.</p></div></header>
    <div class="bt-states" role="group" aria-label="State">
      <button type="button" data-state="open" aria-pressed="false">Just opened</button><button type="button" data-state="first" aria-pressed="false">One question</button><button type="button" data-state="followup" aria-pressed="true">A follow-up</button>
      <span class="bt-gap"></span><button type="button" data-theme="light" aria-pressed="true">Light</button><button type="button" data-theme="dark" aria-pressed="false">Dark</button>
    </div>
    <div class="bt-phones bt-phones-four">${looks.map(([id, name]) => `<figure><iframe loading="lazy" data-story="${id}" title="${name}" src="${src(id, 'light', 'followup')}"></iframe><figcaption>${name}</figcaption></figure>`).join('')}</div>`;
  let theme = 'light', state = 'followup';
  el.querySelector('.bt-states').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const key = button.dataset.state ? 'state' : 'theme';
    el.querySelectorAll(`.bt-states button[data-${key}]`).forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    if (key === 'theme') { theme = button.dataset.theme; el.querySelectorAll('iframe[data-story]').forEach(frame => { frame.src = src(frame.dataset.story, theme, state); }); return; }
    state = button.dataset.state;
    el.querySelectorAll('iframe[data-story]').forEach(frame => frame.contentWindow?.__STORYBOOK_ADDONS_CHANNEL__?.emit('updateStoryArgs', { storyId: frame.dataset.story, updatedArgs: { state } }));
  });
  return el;
}

export default { title: 'Ask Kit', tags: ['!autodocs'], parameters: { layout: 'fullscreen' } };
export const FourConversations = { name: 'Four conversations', render: fourConversations };
