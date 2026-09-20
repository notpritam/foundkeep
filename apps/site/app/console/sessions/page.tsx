import { serverApi } from '../../../lib/server';

type Site = {
  site: string; status: 'healthy' | 'pending' | 'absent' | 'cooling' | 'failing' | 'expired';
  reason: string | null; checkedAt: number | null; okAt: number | null; failures: number;
};
const labels: Record<string, string> = { x: 'X', reddit: 'Reddit', instagram: 'Instagram', linkedin: 'LinkedIn', bluesky: 'Bluesky', youtube: 'YouTube' };
const statusLabels: Record<Site['status'], string> = { healthy: 'Healthy', pending: 'Waiting for first check', absent: 'No session', cooling: 'Cooling down', failing: 'Check failed', expired: 'Needs new session' };
const date = (value: number | null) => value === null ? 'Not yet' : new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(value) + ' UTC';

export default async function SessionsPage() {
  const { sites } = await serverApi<{ sites: Site[] }>('/admin/social-sessions');
  return <>
    <h1>Social sessions</h1>
    <p className="muted">Public posts are checked every six hours. Session warnings go to administrators with notifications enabled on a paired device.</p>
    <div className="session-table-wrap">
      <table className="ctable">
        <caption className="session-caption">Platform availability and the latest checks</caption>
        <thead><tr><th scope="col">Platform</th><th scope="col">Status</th><th scope="col">Last checked</th><th scope="col">Last healthy</th><th scope="col">Details</th></tr></thead>
        <tbody>{sites.map(site => <tr key={site.site}>
          <th scope="row">{labels[site.site] ?? site.site}</th>
          <td><span className={`pill session-${site.status}`}>{statusLabels[site.status]}</span></td>
          <td>{date(site.checkedAt)}</td><td>{date(site.okAt)}</td>
          <td>{site.reason ?? (site.status === 'absent' ? 'No cookie file loaded. Public access may still work.' : site.status === 'healthy' ? 'The probe post returned readable content.' : 'The first check runs shortly after startup.')}
            {site.status === 'expired' && <p>Re-export your cookies and replace <code>{site.site}.txt</code>. If the probe post was removed, update its target instead.</p>}
          </td>
        </tr>)}</tbody>
      </table>
    </div>
    <section className="card">
      <h2>Refresh a session</h2>
      <p>Export a fresh cookie file from your signed-in browser and replace the matching file in <code>~/.config/foundkeep/social-sessions/</code>, with permissions <code>600</code>. The file reloads within 30 seconds; the next scheduled check updates this page.</p>
      <p className="muted">Checks use one public post per platform. To replace a deleted or unavailable test post, set the platform’s URL in <code>probes.json</code> in the same directory. A successful public read confirms availability; it may not require the cookie.</p>
      <a href="/console/sessions">Refresh status</a>
    </section>
  </>;
}
