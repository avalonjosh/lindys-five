import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import './index.css'
import App from './App.tsx'
import Landing from './components/Landing.tsx'
import { TEAMS } from './teamConfig'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/sabres" element={<App team={TEAMS.sabres} />} />
        <Route path="/canadiens" element={<App team={TEAMS.canadiens} />} />
        <Route path="/redwings" element={<App team={TEAMS.redwings} />} />
        <Route path="/senators" element={<App team={TEAMS.senators} />} />
        <Route path="/panthers" element={<App team={TEAMS.panthers} />} />
        <Route path="/mapleleafs" element={<App team={TEAMS.mapleleafs} />} />
        <Route path="/lightning" element={<App team={TEAMS.lightning} />} />
        <Route path="/bruins" element={<App team={TEAMS.bruins} />} />
        <Route path="/devils" element={<App team={TEAMS.devils} />} />
        <Route path="/penguins" element={<App team={TEAMS.penguins} />} />
        <Route path="/hurricanes" element={<App team={TEAMS.hurricanes} />} />
        <Route path="/capitals" element={<App team={TEAMS.capitals} />} />
        <Route path="/islanders" element={<App team={TEAMS.islanders} />} />
        <Route path="/flyers" element={<App team={TEAMS.flyers} />} />
        <Route path="/bluejackets" element={<App team={TEAMS.bluejackets} />} />
        <Route path="/rangers" element={<App team={TEAMS.rangers} />} />
        <Route path="/utah" element={<App team={TEAMS.utah} />} />
        <Route path="/avalanche" element={<App team={TEAMS.avalanche} />} />
        <Route path="/jets" element={<App team={TEAMS.jets} />} />
        <Route path="/stars" element={<App team={TEAMS.stars} />} />
        <Route path="/blackhawks" element={<App team={TEAMS.blackhawks} />} />
        <Route path="/predators" element={<App team={TEAMS.predators} />} />
        <Route path="/wild" element={<App team={TEAMS.wild} />} />
        <Route path="/blues" element={<App team={TEAMS.blues} />} />
        <Route path="/goldenknights" element={<App team={TEAMS.goldenknights} />} />
        <Route path="/oilers" element={<App team={TEAMS.oilers} />} />
        <Route path="/canucks" element={<App team={TEAMS.canucks} />} />
        <Route path="/flames" element={<App team={TEAMS.flames} />} />
        <Route path="/kings" element={<App team={TEAMS.kings} />} />
        <Route path="/ducks" element={<App team={TEAMS.ducks} />} />
        <Route path="/sharks" element={<App team={TEAMS.sharks} />} />
        <Route path="/kraken" element={<App team={TEAMS.kraken} />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
