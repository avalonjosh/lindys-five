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
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
