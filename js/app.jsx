/* App shell: header, filter bar, sections, drawer, legend, tweaks. */

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "blue",
  "ragGreen": 15,
  "ragAmber": 35,
  "matrixStyle": "circle",
  "density": "comfortable"
}/*EDITMODE-END*/;

const ACCENTS = {
  blue: { a1: '#4F8EF7', a2: '#00C9A7' },
  teal: { a1: '#00C9A7', a2: '#4F8EF7' }
};

function useClickOutside(ref, onOut) {
  React.useEffect(() => {
    const h = e => { if (ref.current && !ref.current.contains(e.target)) onOut(); };
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h);
  }, [onOut]);
}

function MultiSelect({ label, options, selected, onChange }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef(null);
  useClickOutside(ref, () => setOpen(false));
  const all = selected.size === 0 || selected.size === options.length;
  const toggle = o => {
    const next = new Set(selected.size === 0 ? options : selected);
    if (next.has(o)) next.delete(o); else next.add(o);
    if (next.size === options.length) next.clear();
    onChange(next);
  };
  return (
    <div className="ms" ref={ref}>
      <button className={'ms-btn' + (open ? ' open' : '') + (!all ? ' filtered' : '')} onClick={() => setOpen(!open)}>
        <span className="ms-label">{label}</span>
        <span className="ms-value">{all ? 'All' : selected.size + ' selected'}</span>
        <span className="ms-caret">▾</span>
      </button>
      {open && (
        <div className="ms-menu">
          <div className="ms-menu-head">
            <button onClick={() => onChange(new Set())}>All</button>
            <button onClick={() => onChange(new Set(options.filter((_, i) => i === 0)))}>Clear</button>
          </div>
          {options.map(o => {
            const on = all || selected.has(o);
            return (
              <label key={o} className="ms-opt">
                <span className={'ms-check' + (on ? ' on' : '')}>{on ? '✓' : ''}</span>{o}
                <button className="ms-only" onClick={e => { e.preventDefault(); onChange(new Set([o])); }}>only</button>
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const EVENTS = window.NUITEE_EVENTS;
  const PARTNERS = window.NUITEE_PARTNERS, SUPPLIERS = window.NUITEE_SUPPLIERS;
  const [selP, setSelP] = React.useState(new Set());
  const [selS, setSelS] = React.useState(new Set());
  const [rangeDays, setRangeDays] = React.useState(30);
  const [drawer, setDrawer] = React.useState(null);
  const [activeCard, setActiveCard] = React.useState(null);
  const platRef = React.useRef(null);
  const partRef = React.useRef(null);

  React.useEffect(() => {
    const a = ACCENTS[t.accent] || ACCENTS.blue;
    document.documentElement.style.setProperty('--accent', a.a1);
    document.documentElement.style.setProperty('--accent-2', a.a2);
    document.documentElement.dataset.density = t.density;
  }, [t.accent, t.density]);

  const dayFrom = 31 - rangeDays, dayTo = 31;
  const filterOpts = React.useMemo(() => ({ partners: selP, suppliers: selS, dayFrom, dayTo }), [selP, selS, dayFrom, dayTo]);
  const data = React.useMemo(() => window.aggregate(EVENTS, filterOpts), [filterOpts]);
  const rag = React.useCallback(fr => window.ragOf(fr, t.ragGreen, t.ragAmber), [t.ragGreen, t.ragAmber]);

  const dateLabel = rangeDays === 30 ? 'Apr 1 – 30, 2026' : rangeDays === 14 ? 'Apr 17 – 30, 2026' : 'Apr 24 – 30, 2026';

  const focus = id => {
    const el = id === 'platform' ? platRef.current : partRef.current;
    if (el) { window.scrollTo({ top: window.scrollY + el.getBoundingClientRect().top - 88, behavior: 'smooth' }); el.classList.remove('pulse'); void el.offsetWidth; el.classList.add('pulse'); }
  };
  const openDrawer = p => { setDrawer(p); setActiveCard(null); };

  const exportCSV = () => {
    const rows = [['Partner', 'Supplier', 'Searches', 'Availability%', 'Competitiveness%', 'Reliability%', 'Health', 'FailureRate%', 'Booked', 'Conversion%', 'GMV', 'Margin']];
    Object.keys(data.matrix).forEach(p => SUPPLIERS.forEach(s => {
      const c = data.matrix[p][s]; if (!c) return;
      rows.push([p, s, c.searches, c.availability, c.competitiveness, c.reliability, c.health, c.failRate, c.booked, c.conv, c.revenue, c.margin]);
    }));
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `nuitee-health_${dateLabel.replace(/[ ,]/g, '')}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="topbar-left">
          <span className="wordmark">nuitee</span>
          <span className="topbar-divider" />
          <h1 className="topbar-title">Health Dashboard</h1>
          <span className="topbar-date">{dateLabel}</span>
        </div>
        <div className="topbar-right">
          <div className="seg">
            {[7, 14, 30].map(d => <button key={d} className={'seg-btn' + (rangeDays === d ? ' on' : '')} onClick={() => setRangeDays(d)}>{d}d</button>)}
          </div>
          <MultiSelect label="Partners" options={PARTNERS} selected={selP} onChange={setSelP} />
          <MultiSelect label="Suppliers" options={SUPPLIERS} selected={selS} onChange={setSelS} />
          <button className="export-btn" onClick={exportCSV}><span className="export-ic">↧</span> Export CSV</button>
        </div>
      </header>

      <main className="content">
        <IntroBanner g={t.ragGreen} a={t.ragAmber} />
        <SummaryCards data={data} rag={rag} onOpen={openDrawer} onFocus={focus} active={activeCard} />
        <div className="dual" ref={partRef}>
          <SupplierPanel data={data} rag={rag} onOpen={openDrawer} />
          <PartnerPanel data={data} rag={rag} onOpen={openDrawer} />
        </div>
        <PlatformHealth data={data} onOpen={openDrawer} expandedRef={platRef} />
        <Matrix data={data} rag={rag} cellStyle={t.matrixStyle} onOpen={openDrawer} />
        <div style={{ height: 60 }} />
      </main>

      <Legend g={t.ragGreen} a={t.ragAmber} />

      {drawer && <Drawer payload={drawer} data={data} rag={rag} onClose={() => setDrawer(null)} />}

      <TweaksPanel>
        <TweakSection label="Appearance" />
        <TweakRadio label="Accent" value={t.accent} options={['blue', 'teal']} onChange={v => setTweak('accent', v)} />
        <TweakRadio label="Density" value={t.density} options={['comfortable', 'compact']} onChange={v => setTweak('density', v)} />
        <TweakSection label="Matrix" />
        <TweakRadio label="Cell style" value={t.matrixStyle} options={['circle', 'square', 'heat']} onChange={v => setTweak('matrixStyle', v)} />
        <TweakSection label="RAG thresholds" />
        <TweakSlider label="Green below" value={t.ragGreen} min={5} max={30} step={1} unit="%" onChange={v => setTweak('ragGreen', Math.min(v, t.ragAmber - 1))} />
        <TweakSlider label="Red above" value={t.ragAmber} min={20} max={55} step={1} unit="%" onChange={v => setTweak('ragAmber', Math.max(v, t.ragGreen + 1))} />
      </TweaksPanel>
    </div>
  );
}

function Legend({ g, a }) {
  return (
    <div className="legend-fixed">
      <span className="legend-fixed-title">Combined failure rate</span>
      <div className="legend-fixed-row"><span className="legend-swatch" style={{ background: 'var(--rag-green)' }} /> Healthy &lt; {g}%</div>
      <div className="legend-fixed-row"><span className="legend-swatch" style={{ background: 'var(--rag-amber)' }} /> Watch {g}–{a}%</div>
      <div className="legend-fixed-row"><span className="legend-swatch" style={{ background: 'var(--rag-red)' }} /> Critical &gt; {a}%</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
