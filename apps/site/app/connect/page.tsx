import Link from 'next/link';
import {headers} from 'next/headers';
import type {Metadata} from 'next';
import {ThemeControl} from '../../components/appearance/theme';
import {CollectionIcon,collectionIcons} from '../../components/collections/public-chrome';
import '../customer.css';
import '../beta/beta.css';
import './connect.css';

export const metadata:Metadata={title:'Connect FoundKeep to Claude & Codex',description:'Give Claude and Codex access to your FoundKeep library over MCP. No token — you sign in through your browser.',alternates:{canonical:'/connect'}};

const CODEX_CONFIG=`[mcp_servers.foundkeep]
command = "npx"
args = ["-y", "mcp-remote", "https://foundkeep.app/api/mcp"]`;

export default async function ConnectPage(){
 const isDev=(await headers()).get('host')?.split(':')[0]==='dev.foundkeep.app';
 const origin=isDev?'https://dev.foundkeep.app':'https://foundkeep.app';
 const mcpbUrl='https://github.com/notpritam/foundkeep-claude/releases/latest/download/foundkeep.mcpb';
 return <div className="customer-body beta-page"><a className="skip-link" href="#main">Skip to content</a>
 <header className="beta-header"><Link className="brand" href={origin}><img src="/assets/studio-mark.svg?v=bookmark-evolved-1" width={32} height={32} alt=""/><span>FoundKeep</span></Link><nav aria-label="Connect navigation"><ThemeControl compact/><Link href={origin+'/dashboard'}>Open my library<CollectionIcon>{collectionIcons.arrow}</CollectionIcon></Link></nav></header>
 <main id="main">
 <section className="beta-hero"><h1>Bring FoundKeep<br/>into Claude & Codex.</h1><p>Let your AI assistant save to and search your FoundKeep library — read your saves, add new ones, organize folders and tags. It connects over MCP, so it stays in sync with everything else.</p><p className="beta-environment-note"><strong>No token to copy.</strong> You approve the connection by signing in to FoundKeep in your browser, and you can revoke it any time in <Link href={origin+'/dashboard/apps'}>Settings → Agent connections</Link>.</p></section>

 <section id="install" className="beta-install" aria-labelledby="connect-install-title"><div className="beta-section-heading"><h2 id="connect-install-title">Choose your assistant.</h2><p>Each one signs you in the same way — a quick browser approval, then it just works.</p></div><div className="beta-install-grid">

 <article><div className="beta-install-icon"><CollectionIcon><path d="M4 5h16v14H4z"/><path d="M8 9l-2 3 2 3M16 9l2 3-2 3"/></CollectionIcon></div><span className="beta-device-label">Claude Code</span><h3>Install as a plugin.</h3><p>In Claude Code, add the FoundKeep marketplace and install the plugin. It brings the FoundKeep tools plus <code>/foundkeep-save</code> and <code>/foundkeep-recall</code>.</p>
 <pre className="connect-code"><code>/plugin marketplace add notpritam/foundkeep-claude{'\n'}/plugin install foundkeep</code></pre>
 <p className="beta-small">On first use Claude opens your browser to approve access. Done.</p></article>

 <article><div className="beta-install-icon"><CollectionIcon><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/></CollectionIcon></div><span className="beta-device-label">Claude Desktop</span><h3>One-click extension.</h3><p>Download the FoundKeep extension and open it — Claude Desktop installs it and asks you to sign in.</p>
 <a className="button" href={mcpbUrl}>Download for Claude Desktop</a>
 <details><summary>How to install</summary><ol><li>Download <code>foundkeep.mcpb</code> above.</li><li>Double-click it (or drag it into Claude Desktop → Settings → Extensions).</li><li>Approve the sign-in in your browser.</li></ol><p className="beta-small">Requires Node.js 18+ installed (the extension uses it to reach FoundKeep).</p></details></article>

 <article><div className="beta-install-icon"><CollectionIcon><path d="M4 17l6-6-6-6M12 19h8"/></CollectionIcon></div><span className="beta-device-label">Codex CLI</span><h3>Add one config block.</h3><p>Add this to <code>~/.codex/config.toml</code>. The first run opens your browser to authorize; Codex remembers it after that.</p>
 <pre className="connect-code"><code>{CODEX_CONFIG}</code></pre>
 <p className="beta-small">Requires Node.js 18+ (used to fetch the <code>mcp-remote</code> bridge).</p></article>

 </div></section>

 <section className="beta-install" aria-labelledby="connect-what-title"><div className="beta-section-heading"><h2 id="connect-what-title">What your assistant can do.</h2></div><div className="beta-install-grid">
 <article><h3>See your library</h3><p>Search and read your saves, folders and tags to answer questions and pull up what you kept.</p></article>
 <article><h3>Add and organize</h3><p>Create new saves, folders and tags on your behalf — always from your explicit instructions, never from something it read inside a saved item.</p></article>
 <article><h3>Download your files</h3><p>Read your saved files and attachments when you ask it to work with them.</p></article>
 </div><p className="beta-environment-note">Revoke any connection instantly in <Link href={origin+'/dashboard/apps'}>Settings → Agent connections</Link>. Prefer a manual token instead? You can still create one there.</p></section>

 </main>
 <footer className="beta-footer"><Link href={origin}>foundkeep.app</Link> · <Link href={origin+'/privacy'}>Privacy</Link> · <Link href={origin+'/support'}>Support</Link></footer>
 </div>;
}
