import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom'
import IntegratedApp from './pages/IntegratedApp'
import './App.css'

function App() {
  return (
    <Router basename="/dot-art-3d-converter">
      <div className="App">
        <header className="App-header">
          <h1>Dot Art 3D Converter</h1>
          <nav>
            <Link to="/">Home</Link>
            <Link to="/app">Converter</Link>
          </nav>
        </header>
        <main>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/app" element={<IntegratedApp />} />
          </Routes>
        </main>
      </div>
    </Router>
  )
}

function Home() {
  return (
    <div>
      <h2>Welcome to Dot Art 3D Converter</h2>
      <p>Convert CSV dot art patterns and images to 3D models for 3D printing.</p>
      <Link to="/app" className="cta-button">Start Converting →</Link>
    </div>
  )
}

export default App