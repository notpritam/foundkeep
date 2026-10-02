// First run (2026-10-02): the four ways proposed for the screen after someone
// first signs in, side by side and live. The buttons above switch every phone
// at once, without reloading: playing by themselves or to try, iPhone or Android.
import '../brand/brand.css';

function fourWays() {
  const el = document.createElement('div');
  el.className = 'bt';
  const looks = [
    ['proposals-first-run--watch', 'Picked · Watch it happen: a post goes Share → FoundKeep → into your library, on a loop'],
    ['proposals-first-run--steps', 'Three steps: Tap Share · Pick FoundKeep · It’s kept, ready for your agent'],
    ['proposals-first-run--closeup', 'The share sheet up close, with the step people miss on iPhone: More, then add FoundKeep'],
    ['proposals-first-run--try', 'Try it once: share a sample post to FoundKeep, here, and watch it land'],
    ['current-onboarding--save-from-anywhere', 'In the app, for now: an X-style post (FoundKeep in the row) and a reel (More, then FoundKeep), each landing as a floating card'],
  ];
  el.innerHTML = `
    <header class="bt-intro"><div><h1>First run</h1><p>The screen right after someone first signs in: how to save from any app. Today it is three paragraphs in a sheet — and people who sign in with Apple or Google never see it. Four ways were proposed; Pritam picked Watch it happen (2 October), and the last phone is it remade for the app with an X-style post and a reel, the iOS 26 share sheet and FoundKeep’s own save sheet. It is provisional: once the other screens are designed, Pritam records the real flow and it is remade from that. All live; the posts are the film’s generated photographs.</p></div></header>
    <div class="bt-states" role="group" aria-label="How they run">
      <button type="button" data-play="true" aria-pressed="true">Playing by themselves</button><button type="button" data-play="false" aria-pressed="false">Try them yourself</button>
      <span class="bt-gap"></span>
      <button type="button" data-os="ios" aria-pressed="true">iPhone</button><button type="button" data-os="android" aria-pressed="false">Android</button>
    </div>
    <div class="bt-phones bt-phones-five">${looks.map(([id, name]) => `<figure>
      <iframe loading="lazy" data-story="${id}" title="${name}" src="./app/iframe.html?id=${id}&viewMode=story&globals=${encodeURIComponent('device:iphone-17-pro')}"></iframe>
      <figcaption>${name}</figcaption></figure>`).join('')}</div>`;
  const chosen = { play: true, os: 'ios' };
  el.querySelector('.bt-states').addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const key = 'play' in button.dataset ? 'play' : 'os';
    chosen[key] = key === 'play' ? button.dataset.play === 'true' : button.dataset.os;
    el.querySelectorAll(`.bt-states button[data-${key}]`).forEach(b => b.setAttribute('aria-pressed', String(b === button)));
    el.querySelectorAll('iframe[data-story]').forEach(frame => frame.contentWindow?.__STORYBOOK_ADDONS_CHANNEL__?.emit('updateStoryArgs', { storyId: frame.dataset.story, updatedArgs: { ...chosen } }));
  });
  return el;
}

export default { title: 'First run', tags: ['!autodocs'], parameters: { layout: 'fullscreen' } };
export const FourWays = { name: 'Four ways', render: fourWays };
