/* Chart + viz primitives for the Nuitee dashboard. All SVG/CSS, no libraries.
   Colors reference CSS custom properties so Tweaks (accent, RAG) update live. */

const RAG_VAR = { green: 'var(--rag-green)', amber: 'var(--rag-amber)', red: 'var(--rag-red)' };
function ragColor(r) { return RAG_VAR[r] || 'var(--txt-2)'; }

/* ---- Donut: segments=[{value,color,label}] ---- */
function Donut({ segments, size = 132, thickness = 16, center }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2, C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--border)" strokeWidth={thickness} />
      {segments.map((s, i) => {
        const frac = s.value / total;
        const dash = `${frac * C} ${C}`;
        const off = -acc * C;
        acc += frac;
        return (
          <circle key={i} cx={cx} cy={cx} r={r} fill="none"
            stroke={s.color} strokeWidth={thickness} strokeDasharray={dash}
            strokeDashoffset={off} strokeLinecap="butt"
            transform={`rotate(-90 ${cx} ${cx})`} />
        );
      })}
      {center && (
        <g>
          <text x={cx} y={cx - 2} textAnchor="middle" style={{ fill: 'var(--txt-1)', font: '600 33px Inter', letterSpacing: '-0.02em' }}>{center.top}</text>
          <text x={cx} y={cx + 20} textAnchor="middle" style={{ fill: 'var(--txt-2)', font: '500 15px Inter', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{center.bottom}</text>
        </g>
      )}
    </svg>
  );
}

/* ---- Sparkline ---- */
function Sparkline({ values, color = 'var(--accent)', width = 96, height = 30, fill = true }) {
  const v = values.filter(x => x != null && !isNaN(x));
  if (v.length < 2) return <svg width={width} height={height} />;
  const min = Math.min(...v), max = Math.max(...v), span = (max - min) || 1;
  const step = width / (v.length - 1);
  const pts = v.map((x, i) => [i * step, height - 4 - ((x - min) / span) * (height - 8)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' ');
  const area = line + ` L${width},${height} L0,${height} Z`;
  const gid = 'sg' + Math.random().toString(36).slice(2, 7);
  return (
    <svg width={width} height={height} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={area} fill={`url(#${gid})`} />}
      <path d={line} fill="none" stroke={color} strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="2.4" fill={color} />
    </svg>
  );
}

/* ---- Inline funnel: four dots sized by volume, connected, drop-off shown ---- */
function FunnelDots({ stages, color = 'var(--accent)', width = 150 }) {
  const max = Math.max(...stages.map(s => s.value)) || 1;
  const n = stages.length;
  const gap = width / (n - 1);
  const rOf = v => 4 + Math.sqrt(v / max) * 7;
  return (
    <svg width={width + 16} height="30" style={{ display: 'block', overflow: 'visible' }}>
      {stages.slice(0, -1).map((s, i) => (
        <line key={i} x1={8 + i * gap} y1="15" x2={8 + (i + 1) * gap} y2="15"
          stroke="var(--border)" strokeWidth="1.5" />
      ))}
      {stages.map((s, i) => (
        <g key={i}>
          <circle cx={8 + i * gap} cy="15" r={rOf(s.value)}
            fill={i === n - 1 ? color : 'var(--surface-2)'}
            stroke={i === n - 1 ? color : 'var(--txt-3)'} strokeWidth="1.5" />
        </g>
      ))}
    </svg>
  );
}

/* ---- Horizontal fill bar (margin contribution etc.) ---- */
function FillBar({ value, max, color = 'var(--accent)', height = 6, width = '100%' }) {
  const pct = Math.max(2, Math.min(100, (value / (max || 1)) * 100));
  return (
    <div style={{ width, height, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ width: pct + '%', height: '100%', background: color, borderRadius: 99 }} />
    </div>
  );
}

/* ---- Pill metric bar: label + value with inline fill ---- */
function MetricPill({ label, value, color, dp }) {
  const pct = Math.max(4, Math.min(100, value));
  const formatted = dp != null ? Number(value).toFixed(dp) : value.toFixed(value >= 99.95 ? 2 : value >= 10 ? 0 : 1);
  return (
    <div className="metric-pill">
      <div className="metric-pill-fill" style={{ width: pct + '%', background: color, opacity: 0.16 }} />
      <span className="metric-pill-val" style={{ color }}>{formatted}%</span>
      <span className="metric-pill-lbl">{label}</span>
    </div>
  );
}

/* ---- Stacked horizontal bar: segments=[{value,color,label}] ---- */
function StackedBar({ segments, height = 12, showLabels }) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  return (
    <div>
      <div style={{ display: 'flex', height, borderRadius: 6, overflow: 'hidden', background: 'var(--border)' }}>
        {segments.map((s, i) => (
          <div key={i} title={`${s.label}: ${s.value.toLocaleString()}`}
            style={{ width: (100 * s.value / total) + '%', background: s.color }} />
        ))}
      </div>
      {showLabels && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 10 }}>
          {segments.map((s, i) => (
            <div key={i} className="legend-item">
              <span className="legend-swatch" style={{ background: s.color }} />
              <span className="legend-name">{s.label}</span>
              <span className="legend-val">{Math.round(100 * s.value / total)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---- Vertical mini bar chart (failure type breakdown in drawer) ---- */
function MiniBars({ items, height = 92 }) {
  const max = Math.max(...items.map(i => i.value)) || 1;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10, height }}>
      {items.map((it, i) => (
        <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, height: '100%', justifyContent: 'flex-end' }}>
          <span style={{ font: '600 17px Inter', color: 'var(--txt-1)' }}>{it.value.toLocaleString()}</span>
          <div style={{ width: '100%', maxWidth: 44, height: Math.max(3, (it.value / max) * (height - 44)), background: it.color || 'var(--accent)', borderRadius: '4px 4px 0 0' }} />
          <span style={{ font: '500 15px Inter', color: 'var(--txt-2)', textAlign: 'center' }}>{it.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ---- Trend arrow ---- */
function TrendArrow({ dir, size = 13 }) {
  const map = { up: { c: 'var(--rag-green)', g: '↑' }, down: { c: 'var(--rag-red)', g: '↓' }, flat: { c: 'var(--txt-3)', g: '→' } };
  const m = map[dir] || map.flat;
  return <span style={{ color: m.c, fontSize: size, fontWeight: 600, lineHeight: 1 }}>{m.g}</span>;
}

/* ---- Health score chip ---- */
function HealthScore({ value, rag, size = 'md' }) {
  const c = ragColor(rag);
  const dim = size === 'lg' ? 56 : size === 'sm' ? 40 : 48;
  const fs = size === 'lg' ? 22 : size === 'sm' ? 16 : 19;
  return (
    <div style={{
      width: dim, height: dim, borderRadius: 9, display: 'grid', placeItems: 'center',
      background: 'transparent', position: 'relative', flexShrink: 0
    }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: 9, background: c, opacity: 0.16 }} />
      <div style={{ position: 'absolute', inset: 0, borderRadius: 9, border: `1.5px solid ${c}` }} />
      <span style={{ position: 'relative', font: `600 ${fs}px Inter`, color: c, fontVariantNumeric: 'tabular-nums' }}>{Math.round(value)}</span>
    </div>
  );
}

Object.assign(window, { ragColor, Donut, Sparkline, FunnelDots, FillBar, MetricPill, StackedBar, MiniBars, TrendArrow, HealthScore });
