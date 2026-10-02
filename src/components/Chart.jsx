// Gráfica mínima en SVG: líneas (eje X temporal) o barras (categorías). Un solo eje Y.
// Marcas finas, rejilla discreta, etiqueta directa por serie, cursor con valor al tocar y vista de tabla.
import { useRef, useState } from 'react'
import { parseISO, toLocalISO } from '../lib/dates'
import { fmtNum } from './ui'
import './chart.css'

const W = 358, H = 170, PAD = { t: 14, r: 44, b: 22, l: 34 }
const shortDate = s => parseISO(s).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '')

function niceDomain(vals, refs, min0) {
  let lo = Math.min(...vals, ...refs), hi = Math.max(...vals, ...refs)
  if (min0) lo = 0
  if (hi === lo) { hi += 1; if (!min0) lo -= 1 }
  const pad = (hi - lo) * 0.12
  return [min0 ? 0 : lo - pad, hi + pad]
}

// series: [{ name, color, line?: bool, points: [{ x: 'YYYY-MM-DD', y, hollow?, tone? }] }]
// bars:   [{ label, y, title }]
// refs:   [{ y, label, tone: 'warn' | 'err' | undefined }]
export default function Chart({ series = [], bars, refs = [], unit = '', min0 = false, label }) {
  const [hover, setHover] = useState(null)
  const ref = useRef(null)
  const pts = series.flatMap(s => s.points)
  const ys = bars ? bars.map(b => b.y) : pts.map(p => p.y)
  if (!ys.length) return <p className="t2 chart-empty">Sin datos todavía.</p>

  const [y0, y1] = niceDomain(ys, refs.map(r => r.y), min0 || !!bars)
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b
  const Y = v => PAD.t + ih - ((v - y0) / (y1 - y0)) * ih
  const times = pts.map(p => parseISO(p.x).getTime())
  const t0 = Math.min(...times), t1 = Math.max(...times)
  const X = bars
    ? i => PAD.l + (iw / bars.length) * (i + 0.5)
    : x => PAD.l + (t1 === t0 ? iw / 2 : ((parseISO(x).getTime() - t0) / (t1 - t0)) * iw)
  const ticks = [0, 0.5, 1].map(f => y0 + (y1 - y0) * f)
  const bw = bars ? Math.min(28, iw / bars.length - 2) : 0

  // Cursor: el punto (o barra) más cercano en X
  const xs = bars ? bars.map((b, i) => ({ key: i, px: X(i) })) : [...new Set(pts.map(p => p.x))].sort().map(x => ({ key: x, px: X(x) }))
  const onMove = e => {
    const r = ref.current.getBoundingClientRect()
    const px = ((e.clientX - r.left) / r.width) * W
    setHover(xs.reduce((a, b) => (Math.abs(b.px - px) < Math.abs(a.px - px) ? b : a)))
  }
  const tip = hover && (bars
    ? { title: bars[hover.key].title || bars[hover.key].label, rows: [{ v: bars[hover.key].y }] }
    : { title: shortDate(hover.key), rows: series.map(s => ({ s, p: s.points.find(p => p.x === hover.key) })).filter(r => r.p).map(r => ({ v: r.p.y, name: series.length > 1 ? r.s.name : null, color: r.s.color, note: r.p.note })) })

  return (
    <figure className="chart">
      <div className="chart-plot">
        <svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label}
          onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={PAD.l} x2={W - PAD.r} y1={Y(t)} y2={Y(t)} className="grid" />
              <text x={PAD.l - 6} y={Y(t) + 4} textAnchor="end" className="tick">{fmtNum(Math.round(t * 10) / 10)}</text>
            </g>
          ))}
          {refs.map((r, i) => (
            <g key={'r' + i}>
              <line x1={PAD.l} x2={W - PAD.r} y1={Y(r.y)} y2={Y(r.y)} className={'ref ' + (r.tone || '')} />
              <text x={W - PAD.r + 4} y={Y(r.y) + 4} className={'ref-lbl ' + (r.tone || '')}>{r.label}</text>
            </g>
          ))}
          {hover && <line x1={hover.px} x2={hover.px} y1={PAD.t} y2={PAD.t + ih} className="cross" />}

          {bars && bars.map((b, i) => (
            <g key={i}>
              <path className={'bar-mark' + (hover?.key === i ? ' is-on' : '')}
                d={`M${X(i) - bw / 2},${Y(0)} V${Math.min(Y(0), Y(b.y) + 4)} Q${X(i) - bw / 2},${Y(b.y)} ${X(i) - bw / 2 + 4},${Y(b.y)} H${X(i) + bw / 2 - 4} Q${X(i) + bw / 2},${Y(b.y)} ${X(i) + bw / 2},${Math.min(Y(0), Y(b.y) + 4)} V${Y(0)} Z`} />
              {(bars.length <= 8 || i % 2 === bars.length % 2) && <text x={X(i)} y={H - 6} textAnchor="middle" className="tick">{b.label}</text>}
            </g>
          ))}

          {!bars && (
            <>
              <text x={PAD.l} y={H - 6} className="tick">{shortDate(toLocalISO(new Date(t0)))}</text>
              {t1 > t0 && <text x={W - PAD.r} y={H - 6} textAnchor="end" className="tick">{shortDate(toLocalISO(new Date(t1)))}</text>}
              {series.map(s => (
                <g key={s.name} style={{ color: s.color }}>
                  {s.line !== false && s.points.length > 1 && <polyline className="line" points={s.points.map(p => `${X(p.x)},${Y(p.y)}`).join(' ')} />}
                  {s.points.map((p, i) => (
                    <circle key={i} cx={X(p.x)} cy={Y(p.y)} r={s.line === false ? 3 : 4}
                      className={'dot' + (p.hollow ? ' is-hollow' : '') + (p.tone ? ' ' + p.tone : '')} />
                  ))}
                  {series.length > 1 && s.line !== false && s.points.length > 0 && (
                    <text x={X(s.points.at(-1).x) + 8} y={Y(s.points.at(-1).y) + 4} className="end-lbl">{s.short || s.name}</text>
                  )}
                </g>
              ))}
            </>
          )}
        </svg>
        {tip && (
          <div className="chart-tip" style={{ left: `${Math.min(84, Math.max(16, (hover.px / W) * 100))}%` }} role="status">
            <span className="tip-title">{tip.title}</span>
            {tip.rows.map((r, i) => (
              <span key={i} className="tip-row">
                {r.name && <i style={{ background: r.color }} />}
                <b className="num">{fmtNum(r.v)}{unit && ' ' + unit}</b>{r.name && <span>{r.name}</span>}{r.note && <span>{r.note}</span>}
              </span>
            ))}
          </div>
        )}
      </div>
      {series.length > 1 && (
        <figcaption className="chart-legend">
          {series.map(s => <span key={s.name}><i className={s.line === false ? 'is-dot' : ''} style={{ background: s.color }} />{s.name}</span>)}
        </figcaption>
      )}
      <details className="chart-table">
        <summary>Ver tabla</summary>
        <table>
          <tbody>
            {bars
              ? bars.map((b, i) => <tr key={i}><td>{b.title || b.label}</td><td className="num">{fmtNum(b.y)} {unit}</td></tr>)
              : series.flatMap(s => s.points.map((p, i) => <tr key={s.name + i}><td>{shortDate(p.x)}{series.length > 1 ? ' · ' + s.name : ''}</td><td className="num">{fmtNum(p.y)} {unit}{p.note ? ' · ' + p.note : ''}</td></tr>)).reverse()}
          </tbody>
        </table>
      </details>
    </figure>
  )
}
