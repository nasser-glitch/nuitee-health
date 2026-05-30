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
  else if (payload.type === 'hotcell') body = <HotelCellDrawer data={data} rag={rag} supplier={payload.supplier} hotel={payload.hotel} />;
  else if (payload.type === 'risk') body = <RiskBreakdown data={data} />;
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

function HeadlineKPIs({ a, b }) {
  const style = { display: 'flex', gap: 24, marginTop: 14 };
  const valStyle = { font: '600 22px Inter', color: 'var(--txt-1)', letterSpacing: '-0.02em', display: 'block' };
  const lblStyle = { font: '500 11px Inter', color: 'var(--txt-2)', marginTop: 3, display: 'block' };
  const divStyle = { width: 1, background: 'var(--border)', margin: '2px 0 6px' };
  return (
    <div style={style}>
      <div><span style={valStyle}>{a.value}</span><span style={lblStyle}>{a.label}</span></div>
      <div style={divStyle} />
      <div><span style={valStyle}>{b.value}</span><span style={lblStyle}>{b.label}</span></div>
    </div>
  );
}

/* ---------- Supplier ---------- */
function SupplierDrawer({ data, rag, name }) {
  const sup = data.suppliers.find(s => s.name === name);
  if (!sup) return null;
  const fr = 100 - sup.health;
  const donut = [
    { value: sup.donut.f1, color: 'var(--accent)', label: 'F1: No rate returned' },
    { value: sup.donut.f2, color: 'var(--accent-2)', label: 'F2: Uncompetitive rate' },
    { value: sup.donut.f3, color: 'var(--rag-red)', label: 'F3: Booking failed' },
    { value: sup.donut.f4, color: 'var(--rag-amber)', label: 'F4: High latency' },
  ];
  const f1r = 100 * sup.f1 / sup.searches, f2r = 100 * sup.f2 / sup.searches;
  const f3r = 100 * sup.f3 / sup.searches, f4r = 100 * sup.f4 / sup.searches;
  const hyp = [];
  if (f1r > 12) hyp.push(`Returns no rate for ${f1r.toFixed(0)}% of searches — likely thin or missing inventory for the hotel types routed here.`);
  if (f2r > 50) hyp.push(`Rate is uncompetitive on ${f2r.toFixed(0)}% of searches — markup or contracted rates may be running above market.`);
  if (f4r > 8) hyp.push(`High latency on ${f4r.toFixed(0)}% of searches (p95 ${NF.int(sup.p95)}ms) — slow responses risk timing out before results render.`);
  if (f3r > 0.3) hyp.push(`Booking fails on ${f3r.toFixed(2)}% of attempts — confirm rate-recheck and inventory-lock behaviour.`);
  if (!hyp.length) hyp.push('Performing within healthy bounds across availability, competitiveness, reliability and latency.');
  const kpiDims = [
    { label: 'Availability', value: sup.availability, desc: 'Searches where a rate was returned', color: 'var(--accent)' },
    { label: 'Competitiveness', value: sup.competitiveness, desc: 'Searches where rate was lowest', color: 'var(--accent-2)' },
    { label: 'Reliability', value: sup.reliability, desc: 'Booking attempts that succeeded', color: 'var(--accent)' },
    { label: 'Latency', value: sup.latency, desc: 'Searches with acceptable response time', color: 'var(--accent-2)' },
  ];
  return (
    <div className="d-body">
      <div className="d-head">
        <div className="d-eyebrow">Supplier</div>
        <div className="d-title-row"><h3 className="d-title">{sup.name}</h3><HealthScore value={sup.health} rag={healthRag(sup.health)} size="lg" /></div>
        <HeadlineKPIs a={{ value: NF.int(sup.searches), label: 'searches' }} b={{ value: NF.int(sup.booked), label: 'bookings' }} />
      </div>
      <DSection title="Failure breakdown" note="share of failures">
        <div className="donut-wrap">
          <Donut segments={donut} center={{ top: NF.pct(fr), bottom: 'fail rate' }} />
          <div className="donut-legend">
            {donut.map((d, i) => (
              <div key={i} className="legend-item">
                <span className="legend-swatch" style={{ background: d.color }} />
                <span className="legend-name">{d.label}</span>
                <span className="legend-val">{NF.int(d.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </DSection>
      <DSection title="KPI framework">
        <div className="metric-cards" style={{ gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
          {kpiDims.map((k, i) => (
            <div key={i} className="metric-card">
              <span className="mc-lbl">{k.label}</span>
              <span className="mc-val" style={{ color: k.color }}>{NF.pct(k.value)}</span>
              <span style={{ font: '400 10.5px Inter', color: 'var(--txt-3)', display: 'block', marginTop: 5, lineHeight: 1.4 }}>{k.desc}</span>
            </div>
          ))}
        </div>
      </DSection>
      <div className="d-2col">
        <DSection title="Most affected hotels">
          <div className="rank-list">
            {sup.topHotels.map((h, i) => (
              <div key={i} className="rank-item">
                <span className="rank-i">{i + 1}</span>
                <span className="mono">#{h.hotel}</span>
                <span className="rank-v">{NF.int(h.fails)} fails</span>
              </div>
            ))}
          </div>
        </DSection>
        <DSection title="Most affected partners">
          <div className="rank-list">
            {sup.topPartners.map((p, i) => (
              <div key={i} className="rank-item">
                <span className="rank-i">{i + 1}</span>
                <span>{p.partner}</span>
                <span className="rank-v" style={{ color: ragColor(rag(p.failRate)) }}>{NF.pct(p.failRate)}</span>
              </div>
            ))}
          </div>
        </DSection>
      </div>
      <DSection title="Red flags">
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
    { label: 'Clicked', value: p.clicked }, { label: 'Booked', value: p.booked }
  ];
  const notClicked = 100 - p.clickThrough;
  const leak = [];
  if (p.f5rate > 20) leak.push(`${p.f5rate.toFixed(1)}% of this partner's searches had a competitive supplier rate that was available but never surfaced — recoverable demand from routing or pricing logic improvements.`);
  if (notClicked > 50) leak.push(`Rates are shown but ${notClicked.toFixed(0)}% are never clicked — prices may not be competitive for this partner's user base.`);
  if (p.bookFailed > 10) leak.push(`${NF.int(p.bookFailed)} booking attempts failed — potential supplier inventory or rate-lock issues at this price point.`);
  if (!leak.length) leak.push('Conversion and platform health are performing in line with platform norms for this partner.');
  const convRag = p.conv >= 2.5 ? 'green' : p.conv >= 1.6 ? 'amber' : 'red';
  return (
    <div className="d-body">
      <div className="d-head">
        <div className="d-eyebrow">Demand partner</div>
        <div className="d-title-row"><h3 className="d-title">{p.name}</h3><HealthScore value={p.health} rag={healthRag(p.health)} size="lg" /></div>
        <HeadlineKPIs a={{ value: NF.int(p.searched), label: 'searches' }} b={{ value: NF.int(p.booked), label: 'bookings' }} />
      </div>

      <DSection title="Value">
        <div className="d-statpair">
          <div><span>Total GMV</span><b>{NF.money0(p.revenue)}</b></div>
          <div><span>Avg booking value</span><b>{NF.money0(p.avgBookingValue)}</b></div>
          <div><span>Nuitee margin</span><b>{NF.money0(p.margin)}</b></div>
          <div><span>Margin share</span><b>{NF.pct(p.marginShare)}</b></div>
        </div>
      </DSection>

      <DSection title="Conversion" note="booked ÷ shown">
        <div className="metric-cards" style={{ marginBottom: 14 }}>
          <div className="metric-card"><span className="mc-lbl">Booked ÷ shown</span><span className="mc-val" style={{ color: ragColor(convRag) }}>{NF.pct(p.conv, 2)}</span></div>
          <div className="metric-card"><span className="mc-lbl">Click-through</span><span className="mc-val">{NF.pct(p.clickThrough)}</span></div>
          <div className="metric-card"><span className="mc-lbl">Bookings</span><span className="mc-val">{NF.int(p.booked)}</span></div>
        </div>
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

      <DSection title="Platform health" note="competitive rates surfaced">
        <div className="metric-cards" style={{ marginBottom: 10 }}>
          <div className="metric-card">
            <span className="mc-lbl">Competitive rate not surfaced</span>
            <span className="mc-val" style={{ color: ragColor(rag(p.f5rate)) }}>{NF.pct(p.f5rate)}</span>
          </div>
          <div className="metric-card">
            <span className="mc-lbl">F5 events</span>
            <span className="mc-val">{NF.int(p.f5)}</span>
          </div>
        </div>
        <div style={{ font: '400 11px Inter', color: 'var(--txt-3)', lineHeight: 1.5 }}>
          % of searches where a supplier had a competitive rate available that was never surfaced to this partner.
        </div>
      </DSection>

      <DSection title="Red flags">
        <Hyp items={leak} />
      </DSection>

      <div className="d-2col">
        <DSection title="Best-served by">
          <div className="rank-list">{p.bestSuppliers.map((s, i) => <div key={i} className="rank-item"><span>{s.supplier}</span><HealthScore value={s.health} rag={healthRag(s.health)} size="sm" /></div>)}</div>
        </DSection>
        <DSection title="Worst-served by">
          <div className="rank-list">{p.worstSuppliers.map((s, i) => <div key={i} className="rank-item"><span>{s.supplier}</span><HealthScore value={s.health} rag={healthRag(s.health)} size="sm" /></div>)}</div>
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
    { label: 'F1', value: c.f1, color: 'var(--accent)' },
    { label: 'F2', value: c.f2, color: 'var(--accent-2)' },
    { label: 'F3', value: c.f3, color: 'var(--rag-red)' },
    { label: 'F4', value: c.f4, color: 'var(--rag-amber)' },
    { label: 'F5', value: c.f5, color: 'var(--txt-3)' },
    { label: 'F6', value: c.f6, color: 'var(--rag-red)' },
  ];
  const stages = [{ label: 'Searched', value: c.searches }, { label: 'Shown', value: c.shown }, { label: 'Clicked', value: c.clicked }, { label: 'Booked', value: c.booked }];
  return (
    <div className="d-body">
      <div className="d-head">
        <div className="d-eyebrow">Lane</div>
        <div className="d-title-row"><h3 className="d-title">{partner} <span className="d-x">×</span> {supplier}</h3><HealthScore value={c.health} rag={healthRag(c.health)} size="lg" /></div>
        <div className="d-substat">{NF.int(c.searches)} searches · {c.booked} booked · {NF.pct(c.conv, 2)} conversion</div>
      </div>
      <DSection title="Health components">
        <div className="metric-cards" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          <div className="metric-card"><span className="mc-lbl">Availability</span><span className="mc-val" style={{ color: 'var(--accent)' }}>{NF.pct(c.availability)}</span></div>
          <div className="metric-card"><span className="mc-lbl">Competitiveness</span><span className="mc-val" style={{ color: 'var(--accent-2)' }}>{NF.pct(c.competitiveness)}</span></div>
          <div className="metric-card"><span className="mc-lbl">Reliability</span><span className="mc-val" style={{ color: 'var(--accent)' }}>{NF.pct(c.reliability)}</span></div>
          <div className="metric-card"><span className="mc-lbl">Latency</span><span className="mc-val" style={{ color: 'var(--accent-2)' }}>{NF.pct(c.latency)}</span></div>
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

/* ---------- Hotel cell (supplier × hotel) ---------- */
function HotelCellDrawer({ data, rag, supplier, hotel }) {
  const c = data.hotelMatrix[supplier] && data.hotelMatrix[supplier][hotel];
  const sup = data.suppliers.find(s => s.name === supplier);
  if (!c) return null;
  const supAvg = sup ? sup.health : c.health;
  const diff = c.health - supAvg;
  const f1r = 100 - c.availability;
  const f2r = 100 - c.competitiveness;
  const f4r = 100 - c.latency;
  const hyp = [];
  if (f1r > 15) hyp.push(`${supplier} returns no rate for ${f1r.toFixed(0)}% of searches at hotel #${hotel} — thin inventory or missing mapping for this property.`);
  if (f2r > 50) hyp.push(`Rate is uncompetitive on ${f2r.toFixed(0)}% of searches at hotel #${hotel} — contracted rates likely running above market for this property.`);
  if (f4r > 8) hyp.push(`High latency on ${f4r.toFixed(0)}% of searches at hotel #${hotel} — property-level slowness or no cached rate for this inventory.`);
  if (!hyp.length) hyp.push(`This supplier × hotel combination is performing within healthy bounds relative to ${supplier}'s overall average.`);
  const bars = [
    { label: 'F1', value: c.f1, color: 'var(--accent)' },
    { label: 'F2', value: c.f2, color: 'var(--accent-2)' },
    { label: 'F3', value: c.f3, color: 'var(--rag-red)' },
    { label: 'F4', value: c.f4, color: 'var(--rag-amber)' },
    { label: 'F5', value: c.f5, color: 'var(--txt-3)' },
  ];
  return (
    <div className="d-body">
      <div className="d-head">
        <div className="d-eyebrow">Supplier × Hotel</div>
        <div className="d-title-row">
          <h3 className="d-title">{supplier} <span className="d-x">×</span> #{hotel}</h3>
          <HealthScore value={c.health} rag={healthRag(c.health)} size="lg" />
        </div>
        <div className="d-substat">{NF.int(c.searches)} searches · {c.booked} booked · {NF.pct(c.conv, 2)} conversion</div>
      </div>
      <DSection title="Health components">
        <div className="metric-cards" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          <div className="metric-card"><span className="mc-lbl">Availability</span><span className="mc-val" style={{ color: 'var(--accent)' }}>{NF.pct(c.availability)}</span></div>
          <div className="metric-card"><span className="mc-lbl">Competitiveness</span><span className="mc-val" style={{ color: 'var(--accent-2)' }}>{NF.pct(c.competitiveness)}</span></div>
          <div className="metric-card"><span className="mc-lbl">Reliability</span><span className="mc-val" style={{ color: 'var(--accent)' }}>{NF.pct(c.reliability)}</span></div>
          <div className="metric-card"><span className="mc-lbl">Latency</span><span className="mc-val" style={{ color: 'var(--accent-2)' }}>{NF.pct(c.latency)}</span></div>
        </div>
      </DSection>
      <div className={'cmp-callout ' + (diff >= 0 ? 'good' : 'bad')}>
        <b>{diff >= 0 ? '↑' : '↓'} {Math.abs(diff).toFixed(0)} pts</b> {diff >= 0 ? 'better' : 'worse'} than {supplier}'s average across all hotels ({Math.round(supAvg)})
      </div>
      <DSection title="Failure breakdown">
        <MiniBars items={bars} />
      </DSection>
      <DSection title="Likely causes"><Hyp items={hyp} /></DSection>
    </div>
  );
}

/* ---------- Revenue at risk breakdown ---------- */
function RiskBreakdown({ data }) {
  const s = data.summary;
  const pf = data.platform;
  return (
    <div className="d-body">
      <div className="d-head">
        <div className="d-eyebrow">Revenue at risk — breakdown</div>
        <div className="d-title-row"><h3 className="d-title">{NF.money(s.revenueAtRisk)}</h3></div>
        <div className="d-substat">Estimated GMV recoverable by surfacing competitive rates that were missed (F5)</div>
      </div>
      <DSection title="Three inputs">
        <div className="metric-cards" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 14 }}>
          <div className="metric-card">
            <span className="mc-lbl">F5 searches not booked</span>
            <span className="mc-val">{NF.int(s.f5notBooked)}</span>
            <span style={{ font: '400 10.5px Inter', color: 'var(--txt-3)', display: 'block', marginTop: 5, lineHeight: 1.4 }}>Searches where a competitive rate existed but wasn't surfaced, and no booking occurred</span>
          </div>
          <div className="metric-card">
            <span className="mc-lbl">Platform conversion</span>
            <span className="mc-val">{NF.pct(s.bookingConv, 2)}</span>
            <span style={{ font: '400 10.5px Inter', color: 'var(--txt-3)', display: 'block', marginTop: 5, lineHeight: 1.4 }}>Baseline booking rate across all searches on the platform</span>
          </div>
          <div className="metric-card">
            <span className="mc-lbl">Avg booking value</span>
            <span className="mc-val">{NF.money0(s.avgBookingValue)}</span>
            <span style={{ font: '400 10.5px Inter', color: 'var(--txt-3)', display: 'block', marginTop: 5, lineHeight: 1.4 }}>Average GMV per completed booking in this period</span>
          </div>
        </div>
      </DSection>
      <DSection title="Formula">
        <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 18px', font: '13px/1.7 Inter', color: 'var(--txt-2)' }}>
          <div style={{ marginBottom: 10 }}>F5-unbooked searches × platform conversion × avg booking value</div>
          <div style={{ color: 'var(--txt-1)', fontWeight: 500 }}>
            {NF.int(s.f5notBooked)} × {NF.pct(s.bookingConv, 2)} × {NF.money0(s.avgBookingValue)}
          </div>
          <div style={{ borderTop: '1px solid var(--border)', marginTop: 12, paddingTop: 12, font: '600 20px Inter', letterSpacing: '-.02em', color: 'var(--txt-1)' }}>
            = {NF.money(s.revenueAtRisk)}
          </div>
        </div>
      </DSection>
      <DSection title="What is F5?">
        <Hyp items={[
          'A supplier returned a rate within 5% of the best available competitor price — a genuinely competitive offer — but it was never surfaced to any partner. This is demand Nuitee had the inventory to capture but didn\'t.',
          `There were ${NF.int(pf.f5count)} total F5 events this period. ${NF.int(s.f5notBooked)} of those searches never converted to a booking — those are the recoverable ones used in the calculation above.`
        ]} />
      </DSection>
      <DSection title="Most affected partners">
        <div className="rank-list">
          {pf.f5byPartner.slice(0, 5).map((x, i) => (
            <div key={i} className="rank-item">
              <span className="rank-i">{i + 1}</span>
              <span style={{ flex: 1 }}>{x.partner}</span>
              <span className="rank-v">{NF.int(x.count)} F5 · {NF.pct(x.rate)}</span>
            </div>
          ))}
        </div>
      </DSection>
    </div>
  );
}

Object.assign(window, { Drawer });
