// Iconos extraídos del prototipo Claude Design (stroke fino, estilo Lucide/Radix)

export const Icon = {
  home: (p = {}) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1v-9.5Z"/>
    </svg>
  ),
  checkin: (p = {}) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <rect x="3.5" y="5" width="17" height="16" rx="2"/>
      <path d="M8 3v4M16 3v4M3.5 10h17"/>
      <path d="M9 15l2 2 4-4"/>
    </svg>
  ),
  week: (p = {}) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M3 20V4M3 20h18"/>
      <path d="M7 16v-5M11 16v-8M15 16v-3M19 16V7"/>
    </svg>
  ),
  report: (p = {}) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
      <path d="M14 3v6h6"/>
      <path d="M9 13h6M9 17h4"/>
    </svg>
  ),
  chevDown: (p = {}) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 9l6 6 6-6"/>
    </svg>
  ),
  chevUp: (p = {}) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M6 15l6-6 6 6"/>
    </svg>
  ),
  chevRight: (p = {}) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M9 6l6 6-6 6"/>
    </svg>
  ),
  chevLeft: (p = {}) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M15 6l-6 6 6 6"/>
    </svg>
  ),
  plus: (p = {}) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" {...p}>
      <path d="M12 5v14M5 12h14"/>
    </svg>
  ),
  check: (p = {}) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M5 12l5 5L20 7"/>
    </svg>
  ),
  dots: (p = {}) => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" {...p}>
      <circle cx="5" cy="12" r="1.5"/>
      <circle cx="12" cy="12" r="1.5"/>
      <circle cx="19" cy="12" r="1.5"/>
    </svg>
  ),
  swap: (p = {}) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" {...p}>
      <path d="M7 7h13l-3-3M17 17H4l3 3"/>
    </svg>
  ),
  anvil: (p = {}) => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" strokeWidth="1.75" strokeLinecap="square" {...p}>
      <path d="M4 9h16"/>
      <path d="M6 9v3h12V9"/>
      <path d="M9 12v2h6"/>
      <path d="M12 9V7"/>
    </svg>
  )
}

// Wordmark FORGE + glifo
export function Wordmark({ size = 18 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-1)' }}>
      <Icon.anvil style={{ width: size + 4, height: size + 4 }} />
      <span style={{
        fontFamily: 'var(--ff-mono)',
        fontWeight: 500,
        fontSize: size,
        letterSpacing: '0.15em'
      }}>FORGE</span>
    </div>
  )
}

// Barra de navegación inferior (4 items)
export function NavBar({ route, onChange }) {
  const items = [
    { key: 'home', label: 'Hoy', icon: Icon.home },
    { key: 'checkin', label: 'Check-in', icon: Icon.checkin },
    { key: 'report', label: 'Reporte', icon: Icon.report },
    { key: 'week', label: 'Semana', icon: Icon.week }
  ]

  return (
    <nav className="navbar">
      {items.map(item => {
        const IconComp = item.icon
        const active = route === item.key
        return (
          <button
            key={item.key}
            className={`navbar-item ${active ? 'active' : ''}`}
            onClick={() => onChange(item.key)}
          >
            <IconComp />
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

// Gráfica de línea simple con puntos, fondo cuadriculado tenue
export function LineChart({ data, height = 140, valueKey = 'y', xKey = 'x' }) {
  if (!data || data.length === 0) {
    return <div style={{
      height, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'var(--text-3)', fontFamily: 'var(--ff-mono)', fontSize: 12
    }}>Sin datos</div>
  }

  const width = 360
  const pad = { top: 20, right: 10, bottom: 28, left: 34 }
  const chartW = width - pad.left - pad.right
  const chartH = height - pad.top - pad.bottom

  const values = data.map(d => d[valueKey])
  const minY = Math.min(...values)
  const maxY = Math.max(...values)
  const rangeY = Math.max(maxY - minY, 0.5)
  const yMin = minY - rangeY * 0.15
  const yMax = maxY + rangeY * 0.15

  const x = (i) => pad.left + (i / Math.max(data.length - 1, 1)) * chartW
  const y = (v) => pad.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH

  const path = data.map((d, i) => `${i === 0 ? 'M' : 'L'} ${x(i)} ${y(d[valueKey])}`).join(' ')

  const yTicks = 3
  const refLines = Array.from({ length: yTicks }, (_, i) => {
    const v = yMin + (yMax - yMin) * (i / (yTicks - 1))
    return { v, py: y(v) }
  })

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {refLines.map((l, i) => (
        <g key={i}>
          <line x1={pad.left} x2={width - pad.right} y1={l.py} y2={l.py}
                stroke="var(--border-1)" strokeWidth="0.5" strokeDasharray="2,3" />
          <text x={pad.left - 6} y={l.py + 3} fill="var(--text-4)" fontSize="9"
                fontFamily="var(--ff-mono)" textAnchor="end">
            {l.v.toFixed(1)}
          </text>
        </g>
      ))}

      {data.map((d, i) => (
        <text key={i} x={x(i)} y={height - pad.bottom + 14}
              fill="var(--text-4)" fontSize="9"
              fontFamily="var(--ff-mono)" textAnchor="middle">
          {d[xKey]}
        </text>
      ))}

      <path d={path} stroke="var(--accent)" strokeWidth="1.25" fill="none" />

      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d[valueKey])} r="3"
                fill="var(--bg-0)" stroke="var(--accent)" strokeWidth="1.25" />
      ))}
    </svg>
  )
}
