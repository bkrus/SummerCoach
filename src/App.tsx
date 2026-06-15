import { BrowserRouter, Routes, Route } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import Home from './pages/Home'
import RunningPlan from './pages/RunningPlan'
import LiftingPlan from './pages/LiftingPlan'
import CheckIn from './pages/CheckIn'
import Progress from './pages/Progress'

export default function App() {
  return (
    <BrowserRouter>
      <div className="flex flex-col h-dvh max-w-sm mx-auto bg-coach-950 overflow-hidden">
        <main className="flex-1 overflow-y-auto overscroll-none">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/running" element={<RunningPlan />} />
            <Route path="/lifting" element={<LiftingPlan />} />
            <Route path="/checkin" element={<CheckIn />} />
            <Route path="/progress" element={<Progress />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  )
}
