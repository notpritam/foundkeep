// A product's flows at a glance: one row per flow, every screen a live
// thumbnail in the order a person meets it, with a Current / Proposal switch.
// A thumbnail opens that screen in the full simulator.
import { useState } from 'react';

export type FlowStep = { label: string; current: string; proposal?: string };
export type Flow = { title: string; note?: string; steps: FlowStep[] };

export function FlowMap({ flows, base, width, height, globals = '' }: { flows: Flow[]; base: string; width: number; height: number; globals?: string }) {
  const [view, setView] = useState<'current' | 'proposal'>('current');
  const scale = 0.32;
  const proposals = flows.some(f => f.steps.some(s => s.proposal));
  const tab = (value: typeof view, label: string) => <button type="button" onClick={() => setView(value)} aria-pressed={view === value}
    style={{ font: '500 13px Inter, system-ui', padding: '6px 14px', borderRadius: 999, border: '1px solid #d9dbde', background: view === value ? '#0d7a50' : '#fff', color: view === value ? '#fff' : '#202020', cursor: 'pointer' }}>{label}</button>;
  return <div style={{ font: '14px Inter, system-ui, sans-serif', color: '#202020', padding: 24, background: '#fafafa', minHeight: '100vh', boxSizing: 'border-box' }}>
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 20 }}>
      {tab('current', 'Current')}{tab('proposal', 'Proposal')}
      <span style={{ color: '#686868', fontSize: 13, marginLeft: 8 }}>{view === 'proposal' && !proposals ? 'No proposals yet: they appear here flow by flow.' : 'Click a screen to open it in the simulator.'}</span>
    </div>
    {flows.map(flow => <section key={flow.title} style={{ marginBottom: 28 }}>
      <h2 style={{ font: '600 16px Inter, system-ui', margin: '0 0 4px' }}>{flow.title}</h2>
      {flow.note ? <p style={{ margin: '0 0 10px', color: '#686868', fontSize: 13 }}>{flow.note}</p> : null}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, overflowX: 'auto', paddingBottom: 8 }}>
        {flow.steps.map((step, i) => {
          const id = view === 'proposal' ? step.proposal : step.current;
          return <div key={step.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {i ? <span aria-hidden="true" style={{ color: '#929292', fontSize: 20 }}>→</span> : null}
            <figure style={{ margin: 0, width: width * scale }}>
              {id ? <a href={`${base}?path=/story/${id}`} target="_top" title={`Open “${step.label}”`} style={{ display: 'block', width: width * scale, height: height * scale, overflow: 'hidden', borderRadius: 10, border: '1px solid #e4e4e4', background: '#fff', position: 'relative' }}>
                <iframe title={step.label} loading="lazy" tabIndex={-1} src={`iframe.html?id=${id}&viewMode=story&simulator=inner&globals=${encodeURIComponent(globals)}`}
                  style={{ width, height, border: 0, transform: `scale(${scale})`, transformOrigin: 'top left', pointerEvents: 'none' }} />
              </a> : <div style={{ width: width * scale, height: height * scale, borderRadius: 10, border: '1px dashed #cfd2d6', display: 'grid', placeItems: 'center', color: '#929292', fontSize: 12 }}>No proposal yet</div>}
              <figcaption style={{ marginTop: 6, fontSize: 12, color: '#3a3d42' }}>{step.label}</figcaption>
            </figure>
          </div>;
        })}
      </div>
    </section>)}
  </div>;
}
