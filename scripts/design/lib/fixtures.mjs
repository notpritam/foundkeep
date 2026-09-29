// The pages the extension is captured on. They are stand-ins for the web the
// dock lives on (a long-form article and an X timeline) — the page is the
// backdrop; everything FoundKeep draws on top of it is the real extension.
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const html = value => String(value).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

// The article embeds its own font, so text wraps identically where it is
// captured and wherever a tile of it is viewed (highlight flashes are drawn
// over exact line boxes).
export async function articlePage(repo) {
  const font = (await readFile(path.join(repo, 'apps/extension/assets/fonts/geist-latin.woff2'))).toString('base64');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The half-life of a good idea — The Margin</title>
<meta name="description" content="Most of what we read is gone within a week. A small practice of keeping changes what stays.">
<meta name="author" content="Lena Kovacs">
<style>
@font-face{font-family:"Margin Sans";src:url(data:font/woff2;base64,${font}) format("woff2");font-weight:100 900;font-display:block}
*{box-sizing:border-box}
html{background:#fff}
body{margin:0;color:#1d1f23;font:17px/1.72 "Margin Sans",system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.site{display:flex;align-items:center;gap:28px;height:60px;padding:0 40px;border-bottom:1px solid #ececec;background:#fff}
.logo{font-weight:760;font-size:19px;letter-spacing:-.02em;color:#111}
.logo span{color:#c2410c}
.site nav{display:flex;gap:22px;font-size:14px;color:#5b5f66}
.site .spacer{flex:1}
.site .subscribe{font-size:13px;font-weight:600;color:#fff;background:#111;border-radius:999px;padding:8px 16px}
.site .signin{font-size:14px;color:#5b5f66}
main{max-width:700px;margin:0 auto;padding:44px 0 120px}
.kicker{font-size:12px;font-weight:650;letter-spacing:.12em;text-transform:uppercase;color:#c2410c}
h1{font-size:44px;line-height:1.08;letter-spacing:-.03em;font-weight:720;margin:12px 0 14px}
.dek{font-size:20px;line-height:1.5;color:#55585e;margin:0 0 22px}
.byline{display:flex;align-items:center;gap:12px;font-size:14px;color:#6b6f76;padding-bottom:26px;border-bottom:1px solid #ececec;margin-bottom:26px}
.avatar{width:38px;height:38px;border-radius:50%;background:linear-gradient(135deg,#fbbf24,#c2410c);color:#fff;display:grid;place-items:center;font-weight:650;font-size:13px}
.byline b{color:#1d1f23;font-weight:600}
p{margin:0 0 20px}
h2{font-size:25px;letter-spacing:-.02em;line-height:1.25;margin:38px 0 12px;font-weight:680}
blockquote{margin:30px 0;padding:4px 0 4px 22px;border-left:3px solid #c2410c;font-size:22px;line-height:1.45;color:#2b2e33}
figure{margin:32px 0}
figure svg{display:block;width:100%;height:auto;border-radius:10px;background:#faf7f2}
figcaption{font-size:13px;color:#7a7e85;margin-top:10px}
</style></head><body>
<header class="site"><div class="logo">The Margin<span>.</span></div><nav><a>Essays</a><a>Science</a><a>Culture</a><a>Books</a></nav><div class="spacer"></div><a class="signin">Sign in</a><a class="subscribe">Subscribe</a></header>
<main><article>
<div class="kicker">Essay · Memory</div>
<h1>The half-life of a good idea</h1>
<p class="dek">Most of what we read is gone within a week. A small practice of keeping — not hoarding — changes what stays.</p>
<div class="byline"><div class="avatar">LK</div><div><b>Lena Kovacs</b><br>Sep 24, 2026 · 9 min read</div></div>
<p id="p1">In 1885 Hermann Ebbinghaus sat alone in a room memorising nonsense syllables and testing himself at intervals. What he found has been rediscovered by every student since: without review, most of what we take in is gone within days, and the curve of forgetting is steepest in the first hours.</p>
<p id="p2">Reading online makes the curve steeper. We open a tab because a sentence caught us, skim the rest, and close it an hour later with the feeling of having learned something. A week on, we can recall that the article existed, but not what it said or why it mattered.</p>
<h2>Forgetting is the default</h2>
<p id="p3">None of this is a failure of character. Memory is built to discard; keeping everything would be its own kind of noise. The question is not how to remember more, but how to choose, in the moment, the few things worth a second look — and to make that second look easy.</p>
<blockquote>The notes we take are less a record of what we read than a letter to the person who will need it later.</blockquote>
<p id="p4">The people I interviewed who read well share a habit that looks almost too small to matter. They keep the passage, not the page. A highlighted paragraph with a line about why it struck them is worth more than a hundred bookmarks with no context.</p>
<figure><svg viewBox="0 0 700 300" role="img" aria-label="A forgetting curve falling steeply, then flattening after each review">
<g stroke="#e8e1d6" stroke-width="1">${[60, 110, 160, 210, 260].map(y => `<line x1="50" x2="670" y1="${y}" y2="${y}"/>`).join('')}</g>
<path d="M50 60 C 110 190, 160 232, 250 246 L 250 70 C 300 150, 350 178, 430 186 L 430 74 C 490 118, 560 132, 670 136" fill="none" stroke="#c2410c" stroke-width="3" stroke-linecap="round"/>
<path d="M50 60 C 120 210, 220 250, 670 262" fill="none" stroke="#b9b2a7" stroke-width="2" stroke-dasharray="6 6"/>
<g font-size="13" fill="#7a7e85"><text x="54" y="290">Day 0</text><text x="236" y="290">Day 2</text><text x="416" y="290">Day 7</text><text x="628" y="290">Day 30</text></g></svg>
<figcaption>Retention with and without review. Each return to a kept passage resets the curve a little higher.</figcaption></figure>
<p id="p5">Keeping, in this sense, is a practice with three parts: noticing the moment something is worth holding onto, capturing it without breaking the flow of reading, and giving your future self enough context to know why it mattered.</p>
<h2>What to keep</h2>
<p id="p6">Keep sentences that change your mind. Keep numbers you will want to cite. Keep the screenshot of the chart rather than the article about the chart. And when you keep something, add a line in your own words; it is the cheapest review there is.</p>
</article></main></body></html>`;
}

const ICONS = {
  reply: '<path d="M4 11.5C4 7.4 7.4 4 11.6 4h.8C16.6 4 20 7.4 20 11.6c0 4.3-3.5 7.4-7.7 7.4H9.6L5 21.5v-4.1A7.4 7.4 0 0 1 4 11.5z"/>',
  repost: '<path d="M4.5 9.5 7.5 6.5l3 3M7.5 7v7.5A2.5 2.5 0 0 0 10 17h4.5M19.5 14.5l-3 3-3-3M16.5 17V9.5A2.5 2.5 0 0 0 14 7H9.5"/>',
  like: '<path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z"/>',
  views: '<path d="M5 20V11M10 20V5M15 20v-7M20 20v-4"/>',
  bookmark: '<path d="M6.5 4h11v16l-5.5-4-5.5 4z"/>',
  share: '<path d="M12 15V4M7.5 8.5 12 4l4.5 4.5M5 14v5.5h14V14"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" width="18.75" height="18.75" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`;
const POSTS = [
  { name: 'Mina Okafor', handle: 'minaokafor', id: '1839204455192', time: '2h', hue: '#0ea5e9', text: 'The best note-taking advice I ever got: keep the passage, not the page. One highlighted paragraph plus a line about why it mattered beats a hundred bookmarks.', counts: ['38', '112', '1.4K', '96K'] },
  { name: 'Design Signals', handle: 'designsignals', id: '1839198810023', time: '5h', hue: '#a855f7', text: 'A good empty state answers three questions: what is this, why is it empty, and what should I do next. Most answer none of them.', counts: ['12', '41', '530', '28K'], card: true },
  { name: 'Theo Park', handle: 'theopark', id: '1839187765120', time: '9h', hue: '#f59e0b', text: 'Shipping small, reversible changes every day beats a big launch every quarter. You learn faster and nobody has to be a hero.', counts: ['7', '19', '284', '12K'] },
];
const post = p => `<article data-testid="tweet" class="post" tabindex="0">
<div class="avatar" style="background:${p.hue}">${p.name[0]}</div>
<div class="content">
<div class="meta" data-testid="User-Name"><span class="name">${html(p.name)}</span><span class="handle">@${p.handle}</span><span class="dot">·</span><a href="/${p.handle}/status/${p.id}"><time>${p.time}</time></a></div>
<div data-testid="tweetText" class="text">${html(p.text)}</div>
${p.card ? '<div class="card"><div class="card-art"></div><div class="card-body"><span>designsignals.co</span><b>Empty states that do their job</b></div></div>' : ''}
<div role="group" class="actions" aria-label="Post actions">
<div class="act"><button data-testid="reply" aria-label="Reply">${icon('reply')}</button><span>${p.counts[0]}</span></div>
<div class="act"><button data-testid="retweet" aria-label="Repost">${icon('repost')}</button><span>${p.counts[1]}</span></div>
<div class="act"><button data-testid="like" aria-label="Like">${icon('like')}</button><span>${p.counts[2]}</span></div>
<div class="act"><a class="views" aria-label="Views">${icon('views')}</a><span>${p.counts[3]}</span></div>
<div class="act end"><button data-testid="bookmark" aria-label="Bookmark">${icon('bookmark')}</button><button data-testid="share" aria-label="Share">${icon('share')}</button></div>
</div></div></article>`;

/** An X home timeline, light ("Default") or dark ("Lights out"). */
export function xTimeline({ dark = false } = {}) {
  const c = dark
    ? { bg: '#000', text: '#e7e9ea', muted: '#71767b', line: '#2f3336', panel: '#16181c', hover: '#080808' }
    : { bg: '#fff', text: '#0f1419', muted: '#536471', line: '#eff3f4', panel: '#f7f9f9', hover: '#f7f7f7' };
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Home / X</title><style>
*{box-sizing:border-box}
html{background:${c.bg}}
body{margin:0;background:${c.bg};color:${c.text};font:15px/20px system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
a{color:inherit;text-decoration:none}
.layout{display:flex;justify-content:center;min-height:100vh}
.nav{width:275px;padding:4px 12px;display:flex;flex-direction:column;gap:2px;border-right:1px solid ${c.line}}
.brand{font-size:30px;font-weight:800;padding:10px 12px;letter-spacing:-.04em}
.nav a{font-size:20px;padding:12px;border-radius:999px}
.nav a.on{font-weight:700}
.nav .post-btn{margin-top:14px;background:${c.text};color:${c.bg};text-align:center;font-weight:700;font-size:17px;padding:14px;border-radius:999px}
.timeline{width:600px;border-right:1px solid ${c.line}}
.tabs{display:flex;border-bottom:1px solid ${c.line};height:53px}
.tabs div{flex:1;display:grid;place-items:center;color:${c.muted};font-weight:500}
.tabs div.on{color:${c.text};font-weight:700;box-shadow:inset 0 -4px 0 #1d9bf0}
.compose{display:flex;gap:12px;padding:16px;border-bottom:1px solid ${c.line};color:${c.muted};font-size:20px}
.compose .avatar{background:#64748b}
.post{display:flex;gap:12px;padding:12px 16px;border-bottom:1px solid ${c.line};outline:none}
.post:hover{background:${c.hover}}
.avatar{flex:none;width:40px;height:40px;border-radius:50%;display:grid;place-items:center;color:#fff;font-weight:700}
.content{flex:1;min-width:0}
.meta{display:flex;gap:4px;align-items:baseline}
.name{font-weight:700}.handle,.dot,.meta a{color:${c.muted}}
.text{margin-top:2px;white-space:pre-wrap}
.card{margin-top:12px;border:1px solid ${c.line};border-radius:16px;overflow:hidden}
.card-art{height:150px;background:linear-gradient(120deg,#c4b5fd,#f0abfc 45%,#fde68a)}
.card-body{padding:10px 12px;display:flex;flex-direction:column;color:${c.muted};font-size:14px}
.card-body b{color:${c.text};font-weight:400}
.actions{display:flex;justify-content:space-between;align-items:center;margin-top:10px;max-width:520px;color:${c.muted};font-size:13px}
.act{display:flex;align-items:center}
.act.end{gap:0}
.act button,.act a{display:inline-flex;align-items:center;justify-content:center;width:34.75px;height:34.75px;margin:-8px 0 -8px -8px;border:0;padding:0;background:transparent;color:inherit;border-radius:999px}
.aside{width:350px;padding:8px 24px}
.search{background:${c.panel};border-radius:999px;padding:12px 18px;color:${c.muted}}
.box{margin-top:16px;border:1px solid ${c.line};border-radius:16px;padding:12px 16px}
.box h3{margin:0 0 10px;font-size:20px}
.trend{padding:10px 0}.trend small{display:block;color:${c.muted};font-size:13px}.trend b{display:block}
</style></head><body>
<div class="layout">
<header class="nav"><div class="brand">X</div><a class="on">Home</a><a>Explore</a><a>Notifications</a><a>Messages</a><a>Bookmarks</a><a>Profile</a><a class="post-btn">Post</a></header>
<main class="timeline"><div class="tabs"><div class="on">For you</div><div>Following</div></div>
<div class="compose"><div class="avatar">Y</div><div>What is happening?!</div></div>
${POSTS.map(post).join('\n')}
</main>
<aside class="aside"><div class="search">Search</div><div class="box"><h3>What’s happening</h3>
<div class="trend"><small>Technology · Trending</small><b>#ReadingHabits</b></div>
<div class="trend"><small>Design · Trending</small><b>Empty states</b></div>
<div class="trend"><small>Trending in Books</small><b>Ebbinghaus</b></div></div></aside>
</div></body></html>`;
}
