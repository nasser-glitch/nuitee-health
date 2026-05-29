/* Dashboard sections: SummaryCards, SupplierPanel, PartnerPanel, PlatformHealth, Matrix.
   `onOpen(payload)` opens the side drawer. `rag(failRate)` colors by current thresholds. */

/* ============ Framework summary banner ============ */
function IntroBanner() {
  const supplierDims = [
    { name: 'Availability',     q: 'Share of searches where the supplier returned at least one valid rate',        code: 'F1 — No rate returned' },
    { name: 'Competitiveness',  q: 'Share of searches where the supplier\'s rate was the best price available',    code: 'F2 — Uncompetitive rate' },
    { name: 'Reliability',      q: 'Share of bookings that completed successfully with acceptable speed',           code: 'F3 — Booking failed · F4 — High latency' },
  ];
  const partnerDims = [
    { name: 'Conversion rate',       q: 'Share of searches that result in a confirmed booking',                                          code: 'Conversion % · gap to 2.5% benchmark' },
    { name: 'Funnel efficiency',     q: 'Step-by-step drop-off from search through to booking',                                          code: 'Show rate · click-through rate · step conversion' },
    { name: 'Revenue contribution',  q: 'Partner\'s share of total GMV, margin, and recoverable demand lost to unsurfaced rates',         code: 'GMV · margin share % · F5 unsurfaced rate' },
  ];
  const failures = [
    { code: 'F1', name: 'No rate',        q: 'Supplier returned no rate for the searched hotel',                        party: 'Supplier',          pc: 'var(--txt-3)' },
    { code: 'F2', name: 'Uncompetitive',  q: 'Supplier returned a rate, but a cheaper alternative was available',       party: 'Supplier',          pc: 'var(--txt-3)' },
    { code: 'F3', name: 'Booking failed', q: 'A booking attempt was initiated but did not complete successfully',        party: 'Supplier',          pc: 'var(--txt-3)' },
    { code: 'F4', name: 'High latency',   q: 'Supplier response exceeded the acceptable latency threshold',              party: 'Supplier',          pc: 'var(--txt-3)' },
    { code: 'F5', name: 'Not surfaced',   q: 'A competitive rate existed but was never shown to the partner',            party: 'Nuitee — platform', pc: 'var(--accent)' },
    { code: 'F6', name: 'Dead search',    q: 'No competitive option was shown to any partner for this search',           party: 'Nuitee — platform', pc: 'var(--accent)' },
  ];
  return (
    <section className="intro">
      <h2 className="intro-title">How to read this dashboard</h2>

      <div className="intro-group">
        <div className="intro-group-label">Supplier performance — health scored 0–100, three dimensions weighted equally</div>
        <div className="intro-pillars">
          {supplierDims.map(p => (
            <div className="intro-pillar" key={p.name}>
              <div className="intro-pillar-h">
                <span className="intro-pillar-name">{p.name}</span>
                <span className="intro-pillar-w">⅓</span>
              </div>
              <div className="intro-pillar-q">{p.q}</div>
              <div className="intro-pillar-code">{p.code}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="intro-group">
        <div className="intro-group-label">Partner performance — primary signal: booking conversion vs 2.5% platform benchmark</div>
        <div className="intro-pillars">
          {partnerDims.map(p => (
            <div className="intro-pillar" key={p.name}>
              <div className="intro-pillar-h">
                <span className="intro-pillar-name">{p.name}</span>
              </div>
              <div className="intro-pillar-q">{p.q}</div>
              <div className="intro-pillar-code">{p.code}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="intro-group">
        <div className="intro-group-label">Failure types — F1–F4 are supplier-side · F5 and F6 are within Nuitee's control</div>
        <div className="intro-pillars intro-pillars-6">
          {failures.map(f => (
            <div className="intro-pillar" key={f.code}>
              <div className="intro-pillar-h">
                <span className="intro-pillar-name"><span className="fcode">{f.code}</span> {f.name}</span>
                <span className="intro-pillar-party" style={{ color: f.pc }}>{f.party}</span>
              </div>
              <div className="intro-pillar-q">{f.q}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============ SECTION 1 — Summary cards ============ */
function SummaryCards({ data, rag, onOpen, onFocus, active }) {
  const s = data.summary;
  const convRag = s.bookingConv >= s.bookingBenchmark ? 'green' : s.bookingConv >= s.bookingBenchmark * 0.9 ? 'amber' : 'red';
  const riskRag = s.revenueAtRisk > 100000 ? 'red' : s.revenueAtRisk > 40000 ? 'amber' : 'green';
  const deadRag = rag(s.deadSearchRate);
  const statusTxt = { green: 'Healthy', amber: 'Watch', red: 'Critical' };
  const cards = [
    { key: 'searches', neutral: true, value: NF.int(s.totalSearches), label: 'Total searches', status: 'Volume', desc: 'Search requests routed across all partners and suppliers in the period.', action: null },
    { key: 'conv', rag: convRag, value: NF.pct(s.bookingConv, 2), label: 'Booking conversion', desc: `Share of searches ending in a confirmed booking, against the ${s.bookingBenchmark}% platform benchmark.`, delta: s.bookingConv - s.bookingBenchmark, action: () => onFocus('partners') },
    { key: 'risk', rag: riskRag, value: NF.money(s.revenueAtRisk), label: 'Estimated revenue at risk', desc: 'Monthly GMV we’d likely recover if the competitive rates we failed to surface (F3) had been shown.', tip: s.revenueAtRiskAssumption, action: () => onFocus('platform') },
    { key: 'supplier', rag: 'red', value: s.topFailingSupplier.name, big: false, valuePct: NF.pct(s.topFailingSupplier.failRate) + ' fail', label: 'Top failing supplier', desc: 'Highest combined failure rate across availability, competitiveness and reliability.', action: () => onOpen({ type: 'supplier', name: s.topFailingSupplier.name }) },
    { key: 'partner', rag: 'amber', value: s.topFailingPartner.name, big: false, valuePct: NF.pct(s.topFailingPartner.conv, 2) + ' conv', label: 'Top failing partner', desc: 'Demand partner with the lowest booking conversion — the biggest missed-conversion gap.', action: () => onOpen({ type: 'partner', name: s.topFailingPartner.name }) },
    { key: 'dead', rag: deadRag, value: NF.pct(s.deadSearchRate, 2), label: 'Dead search rate', desc: 'Searches where no competitive option reached any partner at all (failure mode F6).', action: () => onFocus('platform') },
  ];
  return (
    <div className="cards-row">
      {cards.map(c => {
        const accent = c.neutral ? 'var(--txt-3)' : ragColor(c.rag);
        return (
          <button key={c.key} className={'sum-card' + (c.action ? ' clickable' : '') + (active === c.key ? ' active' : '')}
            style={{ '--card-accent': accent }} onClick={c.action || undefined} disabled={!c.action}>
            <div className="sum-card-bar" style={{ background: accent }} />
            <div className="sum-card-body">
              <div className="sum-card-top">
                <span className="sum-card-label">{c.label}</span>
                <span className="sum-card-status" style={{ color: accent, borderColor: accent }}>{c.neutral ? c.status : statusTxt[c.rag]}</span>
              </div>
              {c.big === false ? (
                <div className="sum-card-entity">
                  <span className="sum-card-name">{c.value}</span>
                  <span className="sum-card-entitypct" style={{ color: accent }}>{c.valuePct}</span>
                </div>
              ) : (
                <div className="sum-card-num">{c.value}
                  {c.delta != null && <span className="sum-card-delta" style={{ color: accent }}>{c.delta >= 0 ? '+' : ''}{c.delta.toFixed(2)}</span>}
                </div>
              )}
              <div className="sum-card-desc" title={c.tip || ''}>{c.desc}{c.tip && <span className="info-dot">i</span>}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ============ SECTION 2 — Supplier panel ============ */
function SupplierPanel({ data, rag, onOpen }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Supplier performance</h2>
          <span className="panel-sub">{data.suppliers.length} suppliers · ranked worst → best</span>
        </div>
        <span className="panel-tag">last 30 days</span>
      </div>
      <div className="rows">
        {data.suppliers.map(sup => (
          <button key={sup.name} className="row sup-row" onClick={() => onOpen({ type: 'supplier', name: sup.name })}>
            <div className="row-name">
              <span className="row-name-txt">{sup.name}</span>
              <span className="row-meta">p95 {NF.int(sup.p95)}ms · {NF.int(sup.searches)} searches</span>
            </div>
            <div className="sup-pills">
              <MetricPill label="available" value={sup.availability} color="var(--accent)" />
              <MetricPill label="competitive" value={sup.competitiveness} color="var(--accent-2)" />
              <MetricPill label="reliable" value={sup.reliability} color="var(--accent)" />
            </div>
            <HealthScore value={sup.health} rag={rag(100 - sup.health)} />
          </button>
        ))}
      </div>
    </section>
  );
}

/* ============ SECTION 2 — Partner panel ============ */
function PartnerPanel({ data, rag, onOpen }) {
  const maxMargin = Math.max(...data.partners.map(p => p.margin)) || 1;
  const partners = [...data.partners].sort((a, b) => a.conv - b.conv);
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Partner performance</h2>
          <span className="panel-sub">{partners.length} partners · ranked worst → best</span>
        </div>
        <span className="panel-tag">conversion</span>
      </div>
      <div className="rows">
        {partners.map(p => {
          const convRag = p.conv >= 2.5 ? 'green' : p.conv >= 1.6 ? 'amber' : 'red';
          return (
            <button key={p.name} className="row part-row" onClick={() => onOpen({ type: 'partner', name: p.name })}>
              <div className="row-name">
                <span className="row-name-txt">{p.name}</span>
                <span className="row-meta">{NF.money0(p.margin)} margin</span>
              </div>
              <div className="part-funnel">
                <FunnelDots stages={[
                  { label: 'searched', value: p.searched }, { label: 'shown', value: p.shown },
                  { label: 'clicked', value: p.clicked }, { label: 'booked', value: p.booked }]} color="var(--accent)" />
                <TrendArrow dir={p.engagement} />
              </div>
              <div className="part-margin">
                <span className="part-margin-lbl">margin share</span>
                <FillBar value={p.margin} max={maxMargin} color="var(--accent-2)" />
              </div>
              <span className="part-conv" style={{ color: ragColor(convRag) }}>{NF.pct(p.conv, 2)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ============ SECTION 3 — Platform health ============ */
function PlatformHealth({ data, onOpen, expandedRef }) {
  const pf = data.platform;
  const [open, setOpen] = React.useState(null);
  const partnerColors = {};
  window.NUITEE_PARTNERS.forEach((p, i) => { partnerColors[p] = `hsl(${210 + i * 26} 70% ${58 - i * 2}%)`; });
  const supplierColors = {};
  window.NUITEE_SUPPLIERS.forEach((s, i) => { supplierColors[s] = `hsl(${165 + i * 14} 55% ${56 - i * 1.5}%)`; });
  const f5segs = pf.f5byPartner.map(x => ({ label: x.partner, value: x.count, color: partnerColors[x.partner] }));
  const f6segs = pf.f6bySupplier.map(x => ({ label: x.supplier, value: x.count, color: supplierColors[x.supplier] }));
  return (
    <section className="platform" ref={expandedRef}>
      <div className="panel-head">
        <div className="platform-titlewrap">
          <h2 className="panel-title">Platform health</h2>
          <span className="platform-badge" title="These failures are within Nuitee's control — not the supplier's">
            <span className="info-dot">i</span> within Nuitee's control
          </span>
        </div>
      </div>
      <div className="platform-grid">
        <div className={'platform-metric' + (open === 'f5' ? ' open' : '')}>
          <div className="platform-big">{NF.pct(pf.f5rate)}</div>
          <div className="platform-mlabel">of competitive rates not surfaced</div>
          <div className="platform-msub">Supplier returned a competitive rate that was never shown to a partner <span className="fcode">F5</span></div>
          <div className="platform-bar">
            <div className="platform-bar-head"><span>Most affected partners</span><span>{NF.int(pf.f5count)} searches</span></div>
            <StackedBar segments={f5segs} showLabels />
          </div>
          <button className="platform-expand" onClick={() => setOpen(open === 'f5' ? null : 'f5')}>
            {open === 'f5' ? '− Hide' : '+ Show'} affected partner × hotel
          </button>
          {open === 'f5' && (
            <table className="mini-table">
              <thead><tr><th>Partner</th><th>Hotel ID</th><th>F5 count</th></tr></thead>
              <tbody>{pf.f5affected.map((r, i) => <tr key={i}><td>{r.partner}</td><td className="mono">#{r.hotel}</td><td className="num">{r.count}</td></tr>)}</tbody>
            </table>
          )}
        </div>
        <div className={'platform-metric' + (open === 'f6' ? ' open' : '')}>
          <div className="platform-big">{NF.pct(pf.f6rate, 2)}</div>
          <div className="platform-mlabel">dead searches</div>
          <div className="platform-msub">No competitive option shown to any partner for the search <span className="fcode">F6</span></div>
          <div className="platform-bar">
            <div className="platform-bar-head"><span>Top contributing suppliers</span><span>{NF.int(pf.f6count)} searches</span></div>
            <StackedBar segments={f6segs} showLabels />
          </div>
          <button className="platform-expand" onClick={() => setOpen(open === 'f6' ? null : 'f6')}>
            {open === 'f6' ? '− Hide' : '+ Show'} affected partner × supplier
          </button>
          {open === 'f6' && (
            <table className="mini-table">
              <thead><tr><th>Partner</th><th>Supplier</th><th>F6 count</th></tr></thead>
              <tbody>{pf.f6affected.map((r, i) => <tr key={i}><td>{r.partner}</td><td>{r.supplier}</td><td className="num">{r.count}</td></tr>)}</tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}

/* ============ SECTION 4 — Partner × Supplier matrix ============ */
function Matrix({ data, rag, cellStyle, onOpen }) {
  const [hover, setHover] = React.useState(null);
  const cols = data.suppliers.map(s => s.name);
  const colHealth = {}; data.suppliers.forEach(s => colHealth[s.name] = s.health);
  const rows = [...data.partners].sort((a, b) => a.health - b.health).map(p => p.name);
  const rowHealth = {}; data.partners.forEach(p => rowHealth[p.name] = p.health);

  function cellVisual(c) {
    if (!c) return { bg: 'transparent', border: 'var(--border)', text: 'var(--txt-3)', rag: null };
    const r = rag(c.failRate); const col = ragColor(r);
    return { rag: r, col };
  }
  return (
    <section className="panel matrix-panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Partner × supplier matrix</h2>
          <span className="panel-sub">Combined health score · worst lanes top-left · hover for detail, click to drill in</span>
        </div>
      </div>
      <div className="matrix-scroll">
        <table className="matrix" onMouseLeave={() => setHover(null)}>
          <thead>
            <tr>
              <th className="mx-corner"></th>
              {cols.map(s => <th key={s} className="mx-colh"><span>{s}</span></th>)}
              <th className="mx-total-h">Partner</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(p => (
              <tr key={p}>
                <th className="mx-rowh">{p}</th>
                {cols.map(s => {
                  const c = data.matrix[p][s];
                  const v = cellVisual(c);
                  return (
                    <td key={s} className="mx-cell"
                      onMouseEnter={() => c && setHover({ p, s, c })}
                      onClick={() => c && onOpen({ type: 'cell', partner: p, supplier: s })}>
                      {c ? <MatrixCell c={c} style={cellStyle} col={v.col} /> : <span className="mx-empty">–</span>}
                    </td>
                  );
                })}
                <td className="mx-total"><TotalChip value={rowHealth[p]} rag={rag(100 - rowHealth[p])} /></td>
              </tr>
            ))}
            <tr className="mx-totalrow">
              <th className="mx-rowh">Supplier</th>
              {cols.map(s => <td key={s} className="mx-total"><TotalChip value={colHealth[s]} rag={rag(100 - colHealth[s])} /></td>)}
              <td className="mx-total"></td>
            </tr>
          </tbody>
        </table>
      </div>
      {hover && <MatrixTip {...hover} />}
    </section>
  );
}

function MatrixCell({ c, style, col }) {
  const label = Math.round(c.health);
  if (style === 'heat') {
    return <div className="mx-heat" style={{ background: col, opacity: 0.14 + (c.failRate / 60) * 0.7 }}>
      <span style={{ color: 'var(--txt-1)' }}>{label}</span></div>;
  }
  if (style === 'square') {
    return <div className="mx-square" style={{ background: col + '26', border: `1.5px solid ${col}`, color: col }}>{label}</div>;
  }
  return <div className="mx-circle" style={{ background: col + '26', border: `1.5px solid ${col}`, color: col }}>{label}</div>;
}

function TotalChip({ value, rag }) {
  const col = ragColor(rag);
  return <div className="mx-totalchip" style={{ color: col }}>{Math.round(value)}</div>;
}

function MatrixTip({ p, s, c }) {
  return (
    <div className="mx-tip">
      <div className="mx-tip-head">{p} <span className="mx-tip-x">×</span> {s}</div>
      <div className="mx-tip-rows">
        <div><span>Availability</span><b>{NF.pct(c.availability)}</b></div>
        <div><span>Competitiveness</span><b>{NF.pct(c.competitiveness)}</b></div>
        <div><span>Reliability</span><b>{NF.pct(c.reliability, 2)}</b></div>
      </div>
      <div className="mx-tip-foot">{NF.int(c.searches)} searches · {c.booked} booked</div>
    </div>
  );
}

Object.assign(window, { IntroBanner, SummaryCards, SupplierPanel, PartnerPanel, PlatformHealth, Matrix });
