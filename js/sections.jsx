/* Dashboard sections: SummaryCards, SupplierPanel, PartnerPanel, PlatformHealth, Matrix.
   `onOpen(payload)` opens the side drawer. `rag(failRate)` colors by current thresholds. */

/* ============ SECTION 1 — Summary cards ============ */
function SummaryCards({ data, rag, onOpen, onFocus, active }) {
  const s = data.summary;
  const convRag = s.bookingConv >= s.bookingBenchmark ? 'green' : s.bookingConv >= s.bookingBenchmark * 0.9 ? 'amber' : 'red';
  const riskRag = s.revenueAtRisk > 100000 ? 'red' : s.revenueAtRisk > 40000 ? 'amber' : 'green';
  const statusTxt = { green: 'Healthy', amber: 'Watch', red: 'Critical' };
  const cards = [
    { key: 'searches', neutral: true, value: NF.int(s.totalSearches), label: 'Total searches', status: 'Volume', desc: 'Search requests routed across all partners and suppliers in the period.', action: null },
    { key: 'conv', rag: convRag, value: NF.pct(s.bookingConv, 2), label: 'Booking conversion', desc: `Share of searches ending in a confirmed booking, against the ${s.bookingBenchmark}% platform benchmark.`, action: () => onFocus('partners') },
    { key: 'risk', rag: riskRag, value: NF.money(s.revenueAtRisk), label: 'Estimated revenue at risk', desc: 'Monthly GMV we\'d likely recover if the competitive rates we failed to surface had been shown.', calc: s.revenueAtRiskAssumption, action: () => onOpen({ type: 'risk' }) },
    { key: 'supplier', rag: 'red', value: s.topFailingSupplier.name, big: false, valuePct: NF.pct(s.topFailingSupplier.failRate) + ' fail', label: 'Worst performing supplier', desc: 'Highest combined failure rate across availability, competitiveness, reliability and latency.', action: () => onOpen({ type: 'supplier', name: s.topFailingSupplier.name }) },
    { key: 'partner', rag: 'amber', value: s.topFailingPartner.name, big: false, valuePct: NF.money(s.topFailingPartner.revenue) + ' GMV', label: 'Worst performing partner', desc: 'Demand partner generating the lowest total GMV this period — least revenue contribution across all bookings.', action: () => onOpen({ type: 'partner', name: s.topFailingPartner.name }) },
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
              <div className="sum-card-desc">{c.desc}{c.calc && <><span className="info-dot" title={c.calc}>i</span> <span style={{fontSize:'10.5px',color:'var(--txt-3)',fontWeight:500}}>How calculated</span></>}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

/* ============ SECTION 2 — Supplier panel ============ */
function SupplierPanel({ data, rag, onOpen }) {
  const [showInfo, setShowInfo] = React.useState(false);
  const dims = [
    { name: 'Availability',    q: 'Share of searches where the supplier returned a valid rate' },
    { name: 'Competitiveness', q: 'Share of searches where the supplier\'s rate was within 5% of the competitor\'s best rate' },
    { name: 'Reliability',     q: 'Share of bookings with no failure' },
    { name: 'Latency',         q: 'Share of searches that had a response time of 1.5s or less' },
  ];
  const failures = [
    { code: 'F1', name: 'No rate',        q: 'Supplier returned no rate for the searched hotel' },
    { code: 'F2', name: 'Uncompetitive',  q: 'Supplier returned a rate, but a cheaper alternative was available' },
    { code: 'F3', name: 'Booking failed', q: 'A booking attempt was initiated but did not complete successfully' },
    { code: 'F4', name: 'High latency',   q: 'Supplier response exceeded the acceptable latency threshold' },
  ];
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Supplier performance</h2>
          <span className="panel-sub">{data.suppliers.length} suppliers · ranked worst → best</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className={'panel-info-btn' + (showInfo ? ' active' : '')} onClick={() => setShowInfo(!showInfo)}>
            <span className="info-dot">i</span> Failure codes
          </button>
          <span className="panel-tag">last 30 days</span>
        </div>
      </div>
      <div className="panel-info-body" style={{ marginBottom: 16 }}>
        <div className="panel-info-label">Four dimensions — weighted equally · health scored 0–100</div>
        <div className="intro-pillars" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
          {dims.map((p, i) => (
            <div className="intro-pillar" key={p.name}>
              <div className="intro-pillar-h">
                <span className="intro-pillar-name"><span className="intro-num">{i+1}</span>{p.name}</span>
              </div>
              <div className="intro-pillar-q">{p.q}</div>
            </div>
          ))}
        </div>
      </div>
      {showInfo && (
        <div className="panel-info-body" style={{ marginBottom: 16 }}>
          <div className="panel-info-label">Failure codes — F1–F4 are supplier-side</div>
          <div className="intro-pillars" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
            {failures.map(f => (
              <div className="intro-pillar" key={f.code}>
                <div className="intro-pillar-h">
                  <span className="intro-pillar-name"><span className="intro-fcode">{f.code}</span> {f.name}</span>
                </div>
                <div className="intro-pillar-q">{f.q}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="rows">
        {data.suppliers.map(sup => (
          <button key={sup.name} className="row sup-row" onClick={() => onOpen({ type: 'supplier', name: sup.name })}>
            <div className="row-name">
              <span className="row-name-txt">{sup.name}</span>
              <span className="row-meta">{NF.int(sup.searches)} searches</span>
            </div>
            <div className="sup-pills">
              <MetricPill label="available" value={sup.availability} color="var(--accent)" dp={0} />
              <MetricPill label="competitive" value={sup.competitiveness} color="var(--accent-2)" dp={0} />
              <MetricPill label="reliable" value={sup.reliability} color="var(--accent)" dp={0} />
              <MetricPill label="latency" value={sup.latency} color="var(--accent-2)" dp={0} />
            </div>
            <HealthScore value={sup.health} rag={healthRag(sup.health)} />
          </button>
        ))}
      </div>
    </section>
  );
}

/* ============ SECTION 2 — Partner panel ============ */
function PartnerPanel({ data, rag, onOpen }) {
  const partners = [...data.partners].sort((a, b) => b.revenue - a.revenue);
  const dims = [
    { name: 'Engagement', q: 'Number of searches performed' },
    { name: 'Conversion', q: 'Rate of bookings per search' },
    { name: 'Value',      q: 'Average booking value, Gross merchandise value and margin contribution' },
  ];
  return (
    <section className="panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Partner performance</h2>
          <span className="panel-sub">{partners.length} partners · ranked by GMV</span>
        </div>
        <span className="panel-tag">last 30 days</span>
      </div>
      <div className="panel-info-body" style={{ marginBottom: 16 }}>
        <div className="panel-info-label">Three dimensions — engagement, conversion, value</div>
        <div className="intro-pillars">
          {dims.map((p, i) => (
            <div className="intro-pillar" key={p.name}>
              <div className="intro-pillar-h">
                <span className="intro-pillar-name"><span className="intro-num">{i+1}</span>{p.name}</span>
              </div>
              <div className="intro-pillar-q">{p.q}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="rows">
        {partners.map(p => (
          <button key={p.name} className="row part-row" onClick={() => onOpen({ type: 'partner', name: p.name })}>
            <div className="row-name">
              <span className="row-name-txt">{p.name}</span>
            </div>
            <div className="part-metrics">
              <div className="part-metric">
                <span className="part-metric-val"><TrendArrow dir={p.engagement} size={12} /> {NF.int(p.searched)}</span>
                <span className="part-metric-lbl">searches</span>
              </div>
              <div className="part-metric">
                <span className="part-metric-val">{NF.int(p.booked)}</span>
                <span className="part-metric-lbl">bookings</span>
              </div>
              <div className="part-metric">
                <span className="part-metric-val">{NF.money(p.revenue)}</span>
                <span className="part-metric-lbl">GMV</span>
              </div>
              <div className="part-metric">
                <span className="part-metric-val">{NF.money(p.margin)}</span>
                <span className="part-metric-lbl">margin</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
}

/* ============ SECTION 3 — Platform health ============ */
function PlatformHealth({ data, onOpen, expandedRef }) {
  const pf = data.platform;
  const [open, setOpen] = React.useState(null);
  const [showInfo, setShowInfo] = React.useState(false);
  const failures = [
    { code: 'F5', name: 'Not surfaced', q: 'A competitive rate existed but was never shown to the partner',   party: 'Nuitee — platform' },
    { code: 'F6', name: 'Dead search',  q: 'No competitive option was shown to any partner for this search', party: 'Nuitee — platform' },
  ];
  const partnerColors = {};
  window.NUITEE_PARTNERS.forEach((p, i) => { partnerColors[p] = `hsl(${210 + i * 26} 70% ${58 - i * 2}%)`; });
  const supplierColors = {};
  window.NUITEE_SUPPLIERS.forEach((s, i) => { supplierColors[s] = `hsl(${165 + i * 14} 55% ${56 - i * 1.5}%)`; });
  const f5segs = pf.f5byPartner.map(x => ({ label: x.partner, value: x.count, color: partnerColors[x.partner] }));
  const f6segs = pf.f6byPartner.map(x => ({ label: x.partner, value: x.count, color: partnerColors[x.partner] }));
  return (
    <section className="platform" ref={expandedRef}>
      <div className="panel-head">
        <div className="platform-titlewrap">
          <h2 className="panel-title">Platform health</h2>
          <button className={'platform-badge' + (showInfo ? ' active' : '')} onClick={() => setShowInfo(!showInfo)}>
            <span className="info-dot">i</span> within Nuitee's control
          </button>
        </div>
      </div>
      {showInfo && (
        <div className="panel-info-body" style={{ background: 'var(--surface-2)', borderColor: '#2c3a50', marginBottom: 20 }}>
          <div className="panel-info-label">Failure codes — F5 and F6 are within Nuitee's control</div>
          <div className="intro-pillars" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {failures.map(f => (
              <div className="intro-pillar" key={f.code}>
                <div className="intro-pillar-h">
                  <span className="intro-pillar-name"><span className="intro-fcode">{f.code}</span> {f.name}</span>
                  <span className="intro-pillar-party">{f.party}</span>
                </div>
                <div className="intro-pillar-q">{f.q}</div>
              </div>
            ))}
          </div>
        </div>
      )}
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
            <div className="platform-bar-head"><span>Affected partners</span><span>{NF.int(pf.f6count)} searches</span></div>
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

/* ============ SECTION 4 — Supplier × Hotel matrix ============ */
function Matrix({ data, rag, cellStyle, onOpen }) {
  const [hover, setHover] = React.useState(null);
  const cols = data.topHotels || [];
  const rows = [...data.suppliers].sort((a, b) => a.health - b.health).map(s => s.name);
  const rowHealth = {};
  data.suppliers.forEach(s => rowHealth[s.name] = s.health);

  const hotelHealth = {};
  cols.forEach(h => {
    let totalSearches = 0, totalWeighted = 0;
    rows.forEach(s => {
      const c = data.hotelMatrix[s] && data.hotelMatrix[s][h];
      if (c && c.searches) { totalSearches += c.searches; totalWeighted += c.health * c.searches; }
    });
    hotelHealth[h] = totalSearches > 0 ? Math.round(totalWeighted / totalSearches) : null;
  });

  function cellVisual(c) {
    if (!c) return { col: null };
    return { col: ragColor(healthRag(c.health)) };
  }
  return (
    <section className="panel matrix-panel">
      <div className="panel-head">
        <div>
          <h2 className="panel-title">Supplier × hotel matrix</h2>
          <span className="panel-sub">Health score per supplier per hotel · worst suppliers first · top 15 hotels by volume · hover for detail, click to drill in</span>
        </div>
      </div>
      <div className="matrix-scroll">
        <table className="matrix" onMouseLeave={() => setHover(null)}>
          <thead>
            <tr>
              <th className="mx-corner"></th>
              {cols.map(h => <th key={h} className="mx-colh"><span>#{h}</span></th>)}
              <th className="mx-total-h">Supplier</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(s => (
              <tr key={s}>
                <th className="mx-rowh">{s}</th>
                {cols.map(h => {
                  const c = data.hotelMatrix[s] && data.hotelMatrix[s][h];
                  const v = cellVisual(c);
                  return (
                    <td key={h} className="mx-cell"
                      onMouseEnter={() => c && setHover({ s, h, c })}
                      onClick={() => c && onOpen({ type: 'hotcell', supplier: s, hotel: h })}>
                      {c ? <MatrixCell c={c} style={cellStyle} col={v.col} /> : <span className="mx-empty">–</span>}
                    </td>
                  );
                })}
                <td className="mx-total"><TotalChip value={rowHealth[s]} rag={healthRag(rowHealth[s])} /></td>
              </tr>
            ))}
            <tr className="mx-totalrow">
              <th className="mx-rowh">Hotel</th>
              {cols.map(h => {
                const hh = hotelHealth[h];
                return <td key={h} className="mx-total">{hh != null ? <TotalChip value={hh} rag={healthRag(hh)} /> : <span className="mx-empty">–</span>}</td>;
              })}
              <td className="mx-total"></td>
            </tr>
          </tbody>
        </table>
      </div>
      {hover && <HotelMatrixTip {...hover} />}
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

function HotelMatrixTip({ s, h, c }) {
  return (
    <div className="mx-tip">
      <div className="mx-tip-head">{s} <span className="mx-tip-x">×</span> #{h}</div>
      <div className="mx-tip-rows">
        <div><span>Availability</span><b>{NF.pct(c.availability)}</b></div>
        <div><span>Competitiveness</span><b>{NF.pct(c.competitiveness)}</b></div>
        <div><span>Reliability</span><b>{NF.pct(c.reliability, 2)}</b></div>
        <div><span>Latency</span><b>{NF.pct(c.latency)}</b></div>
      </div>
      <div className="mx-tip-foot">{NF.int(c.searches)} searches · {c.booked} booked</div>
    </div>
  );
}

Object.assign(window, { SummaryCards, SupplierPanel, PartnerPanel, PlatformHealth, Matrix });
