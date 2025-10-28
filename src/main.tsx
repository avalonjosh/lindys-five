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
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
