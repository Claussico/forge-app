import { useState } from 'react'
import { useAuth } from './lib/useAuth'
import { NavBar } from './components/UI'
import LoginScreen from './screens/LoginScreen'
import HomeScreen from './screens/HomeScreen'
import CheckinScreen from './screens/CheckinScreen'
import ReportScreen from './screens/ReportScreen'
import WeekScreen from './screens/WeekScreen'

export default function App() {
  const { session, loading, signInWithPassword } = useAuth()
  const [route, setRoute] = useState('home')

  if (loading) {
    return (
      <div className="loading" style={{ minHeight: '100vh' }}>
        Cargando…
      </div>
    )
  }

  if (!session) {
    return <LoginScreen onSignIn={signInWithPassword} />
  }

  let screen
  if (route === 'home') screen = <HomeScreen onGoToCheckin={() => setRoute('checkin')} />
  else if (route === 'checkin') screen = <CheckinScreen onDone={() => setRoute('home')} />
  else if (route === 'report') screen = <ReportScreen />
  else if (route === 'week') screen = <WeekScreen />

  return (
    <>
      {screen}
      <NavBar route={route} onChange={setRoute} />
    </>
  )
}
