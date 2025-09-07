import React from 'react'
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { ErrorBoundary } from './components/common/ErrorBoundary'

// Page imports
import IntegratedApp from './pages/IntegratedApp'
import ImageLoadPage from './pages/ImageLoadPage'
import ImageConversionPage from './pages/ImageConversionPage'
import DotEditPage from './pages/DotEditPage'
import Model3DPage from './pages/Model3DPage'

import './App.css'

// Development navigation component
const DevNavigation: React.FC = () => {
  const location = useLocation()
  
  const navItems = [
    { path: '/', label: 'Home', description: 'Welcome page' },
    { path: '/app', label: 'Integrated App', description: 'Complete converter' },
    { path: '/dev/image-load', label: 'Image Load', description: 'File upload testing' },
    { path: '/dev/image-conversion', label: 'Image Conversion', description: 'Image to dot art' },
    { path: '/dev/dot-edit', label: 'Dot Editor', description: 'Pattern editing testing' },
    { path: '/dev/model-3d', label: '3D Model', description: '3D generation testing' }
  ]

  return (
    <nav className="dev-navigation">
      <div className="nav-header">
        <h1>Dot Art 3D Converter</h1>
        <p className="nav-subtitle">Development & Testing Interface</p>
      </div>
      <div className="nav-items">
        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
          >
            <div className="nav-item-content">
              <span className="nav-item-label">{item.label}</span>
              <span className="nav-item-description">{item.description}</span>
            </div>
          </Link>
        ))}
      </div>
    </nav>
  )
}

// Home page component
const Home: React.FC = () => {
  return (
    <div className="home-page">
      <div className="hero-section">
        <h1>Dot Art 3D Converter</h1>
        <p className="hero-description">
          Transform monochrome dot art patterns and images into downloadable 3D models 
          ready for 3D printing. Create physical representations of your digital pixel art.
        </p>
      </div>

      <div className="feature-grid">
        <div className="feature-card">
          <div className="feature-icon">📁</div>
          <h3>Upload & Parse</h3>
          <p>Upload CSV dot art files or images and parse them into dot patterns</p>
          <Link to="/dev/image-load" className="feature-link">Test Upload →</Link>
        </div>

        <div className="feature-card">
          <div className="feature-icon">🖼️</div>
          <h3>Image Conversion</h3>
          <p>Convert regular images to dot art with threshold and resolution controls</p>
          <Link to="/dev/image-conversion" className="feature-link">Test Conversion →</Link>
        </div>

        <div className="feature-card">
          <div className="feature-icon">✏️</div>
          <h3>Dot Pattern Editor</h3>
          <p>Interactive editing of dot patterns with click-to-toggle and range selection</p>
          <Link to="/dev/dot-edit" className="feature-link">Test Editor →</Link>
        </div>

        <div className="feature-card">
          <div className="feature-icon">🎯</div>
          <h3>3D Generation</h3>
          <p>Generate optimized 3D meshes from dot patterns with custom parameters</p>
          <Link to="/dev/model-3d" className="feature-link">Test 3D Generation →</Link>
        </div>

        <div className="feature-card">
          <div className="feature-icon">🚀</div>
          <h3>Complete App</h3>
          <p>Use the fully integrated application for the complete workflow</p>
          <Link to="/app" className="feature-link">Launch App →</Link>
        </div>
      </div>

      <div className="development-info">
        <h2>Development Mode</h2>
        <p>
          This application is built with modular development pages that allow independent 
          testing of each feature. Use the navigation above to access different components 
          during development and testing.
        </p>
        
        <div className="tech-stack">
          <h3>Technology Stack</h3>
          <div className="tech-list">
            <span className="tech-item">React 18</span>
            <span className="tech-item">TypeScript</span>
            <span className="tech-item">Three.js</span>
            <span className="tech-item">Vite</span>
            <span className="tech-item">Canvas API</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// Main App component with routing
function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <Router basename="/dot-art-3d-converter">
          <div className="App">
            <DevNavigation />
            <main className="main-content">
              <ErrorBoundary>
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/app" element={<IntegratedApp />} />
                  <Route 
                    path="/dev/image-load" 
                    element={
                      <div className="dev-page">
                        <div className="dev-page-header">
                          <h2>Image Loading & Parsing Test</h2>
                          <p>Test file upload, CSV parsing, and image preview functionality</p>
                        </div>
                        <ImageLoadPage />
                      </div>
                    } 
                  />
                  <Route 
                    path="/dev/image-conversion" 
                    element={
                      <div className="dev-page">
                        <div className="dev-page-header">
                          <h2>Image to Dot Art Conversion Test</h2>
                          <p>Test image processing, threshold adjustment, and dot art generation</p>
                        </div>
                        <ImageConversionPage />
                      </div>
                    } 
                  />
                  <Route 
                    path="/dev/dot-edit" 
                    element={
                      <div className="dev-page">
                        <div className="dev-page-header">
                          <h2>Dot Pattern Editor Test</h2>
                          <p>Test interactive dot pattern editing, click-to-toggle, and range selection</p>
                        </div>
                        <DotEditPage />
                      </div>
                    } 
                  />
                  <Route 
                    path="/dev/model-3d" 
                    element={
                      <div className="dev-page">
                        <div className="dev-page-header">
                          <h2>3D Model Generation Test</h2>
                          <p>Test 3D mesh generation, optimization, and export functionality</p>
                        </div>
                        <Model3DPage />
                      </div>
                    } 
                  />
                  <Route 
                    path="*" 
                    element={
                      <div className="not-found">
                        <h2>Page Not Found</h2>
                        <p>The requested page could not be found.</p>
                        <Link to="/" className="home-link">Return Home</Link>
                      </div>
                    } 
                  />
                </Routes>
              </ErrorBoundary>
            </main>
          </div>
        </Router>
      </AppProvider>
    </ErrorBoundary>
  )
}

export default App