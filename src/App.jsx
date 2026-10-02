import { useAuth } from './lib/useAuth'
import { useRoute, NavBar } from './components/ui'
import LoginScreen from './screens/LoginScreen'
import TodayScreen from './screens/TodayScreen'
import SessionScreen from './screens/SessionScreen'
import MobilityScreen from './screens/MobilityScreen'
import LogHub from './screens/LogHub'
import CheckinScreen from './screens/CheckinScreen'
import ActivityScreen from './screens/ActivityScreen'
import TestsScreen from './screens/TestsScreen'
import MeasurementsScreen from './screens/MeasurementsScreen'
import SessionDetailScreen from './screens/SessionDetailScreen'
import WeekScreen from './screens/WeekScreen'
import ProgressScreen from './screens/ProgressScreen'

export default function App() {
  const { session, loading, signInWithPassword } = useAuth()
  const { parts, query } = useRoute()

  if (loading) return <div className="loading">Cargando…</div>
  if (!session) return <LoginScreen onSignIn={signInWithPassword} />

  const [top = 'hoy', sub, id] = parts

  // Pantallas a pantalla completa, sin barra de navegación
  if (top === 'sesion' && sub) return <SessionScreen id={sub} />
  if (top === 'movilidad' && sub) return <MobilityScreen id={sub} />

  let screen
  if (top === 'registrar') {
    if (sub === 'checkin') screen = <CheckinScreen />
    else if (sub === 'actividad') screen = <ActivityScreen sessionId={query.s} editId={id} />
    else if (sub === 'tests') screen = <TestsScreen sessionId={query.s} />
    else if (sub === 'medidas') screen = <MeasurementsScreen />
    else screen = <LogHub />
  } else if (top === 'ver' && sub) screen = <SessionDetailScreen id={sub} from={query.f} />
  else if (top === 'semana') screen = <WeekScreen />
  else if (top === 'progreso') screen = <ProgressScreen />
  else screen = <TodayScreen date={query.d} />

  return (
    <div className="app with-nav">
      <div className="screen" key={location.hash}>{screen}</div>
      <NavBar current={top === 'ver' ? (query.f || 'hoy') : top === 'hoy' || !top ? 'hoy' : top} />
    </div>
  )
}
