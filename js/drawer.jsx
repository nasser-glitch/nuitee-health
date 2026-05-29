/* Side drawer — slides from right. Variants: supplier, partner, cell. */

function Drawer({ payload, data, rag, onClose }) {
  React.useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  let body = null;
  if (payload.type === 'supplier') body = <SupplierDrawer data={data} rag={rag} name={payload.name} />;
  else if (payload.type === 'partner') body = <PartnerDrawer data={data} rag={rag} name={payload.name} />;
  else if (payload.type === 'cell') body = <CellDrawer data={data} rag={rag} partner={payload.partner} supplier={payload.supplier} />;
  return (
    <div className="drawer-scrim" onMouseDown={onClose}>
      <aside className="drawer" onMouseDown={e => e.stopPropagation()}>
        <button className="drawer-close" onClick={onClose} aria-label="Close">✕</button>
        {body}
      </aside>
    </div>
  );
}

function DSection({ title, children, note }) {
  return (
    <div className="d-section">
      <div className="d-section-h">{title}{note && <span className="d-section-note">{note}</span>}</div>
      {children}
    </div>
  );
}
function Hyp({ items }) {
  return <ul className="hyp">{items.map((t, i) => <li key={i}><span className="hyp-dot" />{t}</li>)}</ul>;
}

/* ---------- Supplier ---------- */
function SupplierDrawer({ data, rag, name }) {
  const sup = data.suppliers.find(s => s.name === name);
  if (!sup) return null;
  const fr = 100 - sup.health;
  const donut = [
    { value: sup.donut.f2, color: 'var(--accent-2)', label: 'Uncompetitive (F2)' },
    { value: sup.donut.f1, color: 'var(--accent)', label: 'No rate (F1)' },
    { value: sup.donut.f4, color: 'var(--rag-amber)', label: 'High latency (F4)' },
    { value: sup.donut.f3, color: 'var(--rag-red)', label: 'Booking failed (F3)' },
  ];
  const f1r = 100 * sup.f1 / sup.searches, f2r = 100 * sup.f2 / sup.searches, f3r = 100 * sup.f3 / sup.searches, f4r = 100 * sup.f4 / sup.searches;
  const hyp = [];
  if (f1r > 12) hyp.push(`Returns no rate for ${f1r.toFixed(0)}% of searches — likely thin or missing inventory for the hotel types routed here.`);
  if (f2r > 50) hyp.push(`Rate is uncompetitive on ${f2r.toFixed(0)}% of searches — markup or contracted rates may be running above market.`);
  if (f4r > 8) hyp.push(`High latency on ${f4r.toFixed(0)}% of searches (p95 ${NF.int(sup.p95)}ms) — slow responses risk timing out before results render.`);
  if (f3r > 0.3) hyp.push(`Booking fails on ${f3r.toFixed(2)}% of attempts — confirm rate-recheck and inventory-lock behaviour.`);
  if (!hyp.length) hyp.push('Performing within healthy bounds across availability, competitiveness and reliability.');
  return (
    <div className="d-body">
      <div className="d-head">
        <div className="d-eyebrow">Supplier</div>
        <div className="d-title-row"><h3 className="d-title">{sup.name}</h3><HealthScore value={sup.health} rag={rag(fr)} size="lg" /></div>
        <div className="d-substat">{NF.int(sup.searches)} searches · p95 {NF.int(sup.p95)}ms · combined failure {NF.pct(fr)}</div>
      </div>
      <DSection title="Failure breakdown" note="share of failures">
        <div className="donut-wrap">
          <Donut segments={donut} center={{ top: NF.pct(fr), bottom: 'fail rate' }} />
          <div className="donut-legend">
            {donut.map((d, i) => <div key={i} className="legend-item"><span className="legend-swatch" style={{ background: d.color }} /><span className="legend-name">{d.label}</span><span className="legend-val">{NF.int(d.value)}</span></div>)}
          </div>
        </div>
      </DSection>
      <DSection title="Week-on-week trend">
        <div className="spark-grid">
          <SparkStat label="Availability" series={sup.weekly.map(w => w && w.avail)} last={sup.availability} color="var(--accent)" />
          <SparkStat label="Competitiveness" series={sup.weekly.map(w => w && w.compet)} last={sup.competitiveness} color="var(--accent-2)" />
          <SparkStat label="Reliability" series={sup.weekly.map(w => w && w.rel)} last={sup.reliability} color="var(--accent)" dp={2} />
        </div>
      </DSection>
      <div className="d-2col">
        <DSection title="Worst hotels">
          <div className="rank-list">
            {sup.topHotels.map((h, i) => <div key={i} className="rank-item"><span className="rank-i">{i + 1}</span><span className="mono">#{h.hotel}</span><span className="rank-v">{NF.int(h.fails)} fails</span></div>)}
          </div>
        </DSection>
        <DSection title="Partners most affected">
          <div className="rank-list">
            {sup.topPartners.map((p, i) => <div key={i} className="rank-item"><span className="rank-i">{i + 1}</span><span>{p.partner}</span><span className="rank-v" style={{ color: ragColor(rag(p.failRate)) }}>{NF.pct(p.failRate)}</span></div>)}
          </div>
        </DSection>
      </div>
      <DSection title="Likely causes">
        <Hyp items={hyp} />
      </DSection>
    </div>
  );
}

function SparkStat({ label, series, last, color, dp = 1 }) {
  const clean = series.filter(x => x != null);
  const delta = clean.length > 1 ? clean[clean.length - 1] - clean[0] : 0;
  return (
    <div className="spark-stat">
      <div className="spark-stat-top"><span className="spark-stat-lbl">{label}</span><span className="spark-stat-d" style={{ color: delta >= 0 ? 'var(--rag-green)' : 'var(--rag-red)' }}>{delta >= 0 ? '+' : ''}{delta.toFixed(dp)}</span></div>
      <div className="spark-stat-val">{Number(last).toFixed(dp)}%</div>
      <Sparkline values={clean} color={color} width={132} height={28} />
    </div>
  );
}

/* ---------- Partner ---------- */
function PartnerDrawer({ data, rag, name }) {
  const p = data.partners.find(x => x.name === name);
  if (!p) return null;
  const stages = [
    { label: 'Searched', value: p.searched }, { label: 'Shown', value: p.shown },
    { label: 'Clicked', value: p.clicked }, { label: 'Booked', value: p.booked }];
  const notShown = 100 - p.showRate;
  const notClicked = 100 - p.clickThrough;
  const leak = [];
  if (notShown > 70) leak.push(`${notShown.toFixed(0)}% of searches never surface a result — supplier availability or surfacing logic is the dominant leak.`);
  if (notClicked > 50) leak.push(`${notClicked.toFixed(0)}% of shown results are never clicked — possible pricing or relevance issue at the point of display.`);
  if (p.f5rate > 40) leak.push(`On ${p.f5rate.toFixed(0)}% of their searches a competitive rate existed but wasn't surfaced (F5) — recoverable demand.`);
  if (!leak.length) leak.push('Funnel is converting in line with platform norms at each stage.');
  const convRag = p.conv >= 2.5 ? 'green' : p.conv >= 1.6 ? 'amber' : 'red';
  return (
    <div className="d-body">
      <div className="d-head">
        <div className="d-eyebrow">Demand partner</div>
        <div className="d-title-row"><h3 className="d-title">{p.name}</h3><span className="d-bigconv" style={{ color: ragColor(convRag) }}>{NF.pct(p.conv, 2)}<small>conversion</small></span></div>
        <div className="d-substat">{NF.int(p.searched)} searches · {p.booked} bookings · engagement {p.engagement === 'up' ? 'rising' : p.engagement === 'down' ? 'falling' : 'flat'}</div>
      </div>
      <DSection title="Conversion funnel">
        <div className="funnel">
          {stages.map((s, i) => {
            const pct = 100 * s.value / stages[0].value;
            const stepPct = i ? 100 * s.value / stages[i - 1].value : 100;
            return (
              <div key={i} className="funnel-step">
                <div className="funnel-step-top"><span className="funnel-lbl">{s.label}</span><span className="funnel-abs">{NF.int(s.value)}</span></div>
                <div className="funnel-track"><div className="funnel-fill" style={{ width: Math.max(1.5, pct) + '%' }} /></div>
                <div className="funnel-pct">{pct.toFixed(pct < 10 ? 2 : 1)}% of searches{i > 0 && <span className="funnel-step-conv"> · {stepPct.toFixed(1)}% step</span>}</div>
              </div>
            );
          })}
        </div>
      </DSection>
      <div className="d-2col">
        <DSection title="Revenue"><div className="d-statpair"><div><span>GMV</span><b>{NF.money0(p.revenue)}</b></div><div><span>Margin</span><b>{NF.money0(p.margin)}</b></div></div></DSection>
        <DSection title="Unsurfaced rates"><div className="d-statpair"><div><span>F5 rate</span><b style={{ color: ragColor(rag(p.f5rate)) }}>{NF.pct(p.f5rate)}</b></div><div><span>Margin share</span><b>{NF.pct(p.marginShare)}</b></div></div></DSection>
      </div>
      <DSection title="Where they leak most">
        <Hyp items={leak} />
      </DSection>
      <div className="d-2col">
        <DSection title="Best-served by">
          <div className="rank-list">{p.bestSuppliers.map((s, i) => <div key={i} className="rank-item"><span>{s.supplier}</span><HealthScore value={s.health} rag={rag(100 - s.health)} size="sm" /></div>)}</div>
        </DSection>
        <DSection title="Worst-served by">
          <div className="rank-list">{p.worstSuppliers.map((s, i) => <div key={i} className="rank-item"><span>{s.supplier}</span><HealthScore value={s.health} rag={rag(100 - s.health)} size="sm" /></div>)}</div>
        </DSection>
      </div>
    </div>
  );
}

/* ---------- Cell (partner × supplier) ---------- */
function CellDrawer({ data, rag, partner, supplier }) {
  const c = data.matrix[partner][supplier];
  const sup = data.suppliers.find(s => s.name === supplier);
  if (!c) return null;
  const fr = c.failRate;
  const supAvg = sup ? sup.health : c.health;
  const diff = c.health - supAvg;
  const f1r = 100 * c.f1 / c.searches, f2r = 100 * c.f2 / c.searches, f5r = 100 * c.f5 / c.searches;
  const hyp = [];
  if (f1r > 12) hyp.push(`${supplier} returns no rate for ${f1r.toFixed(0)}% of ${partner}'s searches — likely missing inventory for the hotel types this partner requests.`);
  if (f2r > 50) hyp.push(`Rate is uncompetitive on ${f2r.toFixed(0)}% of this lane — ${partner}'s buyers see cheaper options elsewhere.`);
  if (f5r > 40) hyp.push(`A competitive rate existed but wasn't surfaced on ${f5r.toFixed(0)}% of searches (F5) — Nuitee-side recoverable.`);
  if (!hyp.length) hyp.push('This lane is healthy relative to the platform.');
  const bars = [
    { label: 'F1', value: c.f1, color: 'var(--accent)' },    // No rate returned
    { label: 'F2', value: c.f2, color: 'var(--accent-2)' },  // Uncompetitive rate
    { label: 'F3', value: c.f3, color: 'var(--rag-red)' },   // Booking failed
    { label: 'F4', value: c.f4, color: 'var(--rag-amber)' }, // High latency
    { label: 'F5', value: c.f5, color: 'var(--txt-3)' },     // Competitive not shown
    { label: 'F6', value: c.f6, color: 'var(--rag-red)' },   // Dead search
  ];
  const stages = [{ label: 'Searched', value: c.searches }, { label: 'Shown', value: c.shown }, { label: 'Clicked', value: c.clicked }, { label: 'Booked', value: c.booked }];
  return (
    <div className="d-body">
      <div className="d-head">
        <div className="d-eyebrow">Lane</div>
        <div className="d-title-row"><h3 className="d-title">{partner} <span className="d-x">×</span> {supplier}</h3><HealthScore value={c.health} rag={rag(fr)} size="lg" /></div>
        <div className="d-substat">{NF.int(c.searches)} searches · {c.booked} booked · {NF.pct(c.conv, 2)} conversion</div>
      </div>
      <DSection title="Health components">
        <div className="metric-cards">
          <div className="metric-card"><span className="mc-lbl">Availability</span><span className="mc-val" style={{ color: 'var(--accent)' }}>{NF.pct(c.availability)}</span></div>
          <div className="metric-card"><span className="mc-lbl">Competitiveness</span><span className="mc-val" style={{ color: 'var(--accent-2)' }}>{NF.pct(c.competitiveness)}</span></div>
          <div className="metric-card"><span className="mc-lbl">Reliability</span><span className="mc-val" style={{ color: 'var(--accent)' }}>{NF.pct(c.reliability, 2)}</span></div>
        </div>
      </DSection>
      <div className={'cmp-callout ' + (diff >= 0 ? 'good' : 'bad')}>
        <b>{diff >= 0 ? '↑' : '↓'} {Math.abs(diff).toFixed(0)} pts</b> {diff >= 0 ? 'better' : 'worse'} than {supplier}'s average across all partners ({Math.round(supAvg)})
      </div>
      <DSection title="Failure type breakdown">
        <MiniBars items={bars} />
      </DSection>
      <DSection title="Booking funnel">
        <div className="funnel compact">
          {stages.map((s, i) => {
            const pct = 100 * s.value / stages[0].value;
            return <div key={i} className="funnel-step"><div className="funnel-step-top"><span className="funnel-lbl">{s.label}</span><span className="funnel-abs">{NF.int(s.value)}</span></div><div className="funnel-track"><div className="funnel-fill" style={{ width: Math.max(1.5, pct) + '%' }} /></div></div>;
          })}
        </div>
      </DSection>
      <DSection title="Likely causes"><Hyp items={hyp} /></DSection>
    </div>
  );
}

Object.assign(window, { Drawer });
