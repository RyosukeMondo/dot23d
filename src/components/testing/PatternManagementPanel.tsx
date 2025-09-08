import React, { useState, useCallback, useEffect } from 'react'
import type { DotPattern } from '@/types'
import { PatternEditor } from './PatternEditor'
import { PatternLibrary } from './PatternLibrary'

export interface PatternManagementPanelProps {
  onPatternSelected?: (pattern: DotPattern) => void
  onPatternSaved?: (pattern: DotPattern) => void
  onPatternDeleted?: (patternId: string) => void
  className?: string
}

interface PatternCategory {
  id: string
  name: string
  description: string
  patterns: DotPattern[]
}

export const PatternManagementPanel: React.FC<PatternManagementPanelProps> = ({
  onPatternSelected,
  onPatternSaved,
  onPatternDeleted,
  className = ''
}) => {
  const [activeTab, setActiveTab] = useState<'editor' | 'library' | 'templates'>('editor')
  const [currentPattern, setCurrentPattern] = useState<DotPattern | null>(null)
  const [savedPatterns, setSavedPatterns] = useState<DotPattern[]>([])
  const [categories, setCategories] = useState<PatternCategory[]>([
    {
      id: 'geometric',
      name: 'Geometric Patterns',
      description: 'Mathematical and geometric designs',
      patterns: []
    },
    {
      id: 'organic',
      name: 'Organic Patterns',
      description: 'Nature-inspired and organic shapes',
      patterns: []
    },
    {
      id: 'decorative',
      name: 'Decorative Patterns',
      description: 'Ornamental and decorative designs',
      patterns: []
    },
    {
      id: 'functional',
      name: 'Functional Patterns',
      description: 'Utility-focused patterns for testing',
      patterns: []
    }
  ])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'size'>('date')
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [patternMetadata, setPatternMetadata] = useState({
    name: '',
    description: '',
    tags: [] as string[],
    category: 'geometric'
  })

  // Load saved patterns on mount
  useEffect(() => {
    loadSavedPatterns()
  }, [])

  const loadSavedPatterns = useCallback(() => {
    try {
      const saved = localStorage.getItem('dot23d_saved_patterns')
      if (saved) {
        const patterns = JSON.parse(saved).map((p: any) => ({
          ...p,
          metadata: {
            ...p.metadata,
            createdAt: new Date(p.metadata.createdAt),
            modifiedAt: new Date(p.metadata.modifiedAt)
          }
        }))
        setSavedPatterns(patterns)
        
        // Organize patterns by category
        const categorizedPatterns = categories.map(category => ({
          ...category,
          patterns: patterns.filter((p: DotPattern) => 
            p.metadata?.category === category.id || 
            (category.id === 'geometric' && !p.metadata?.category)
          )
        }))
        setCategories(categorizedPatterns)
      }
    } catch (error) {
      console.error('Failed to load saved patterns:', error)
    }
  }, [categories])

  const savePattern = useCallback(() => {
    if (!currentPattern || !patternMetadata.name.trim()) {
      alert('Please provide a pattern name')
      return
    }

    const patternToSave: DotPattern = {
      ...currentPattern,
      id: currentPattern.id || `pattern_${Date.now()}`,
      name: patternMetadata.name.trim(),
      description: patternMetadata.description.trim(),
      metadata: {
        ...currentPattern.metadata,
        name: patternMetadata.name.trim(),
        description: patternMetadata.description.trim(),
        tags: patternMetadata.tags,
        category: patternMetadata.category,
        modifiedAt: new Date()
      }
    }

    const updatedPatterns = currentPattern.id 
      ? savedPatterns.map(p => p.id === currentPattern.id ? patternToSave : p)
      : [...savedPatterns, patternToSave]

    setSavedPatterns(updatedPatterns)
    
    // Update categories
    const updatedCategories = categories.map(category => ({
      ...category,
      patterns: updatedPatterns.filter(p => p.metadata?.category === category.id)
    }))
    setCategories(updatedCategories)

    // Save to localStorage
    try {
      localStorage.setItem('dot23d_saved_patterns', JSON.stringify(updatedPatterns))
    } catch (error) {
      console.error('Failed to save patterns:', error)
    }

    onPatternSaved?.(patternToSave)
    setIsCreatingNew(false)
    setPatternMetadata({ name: '', description: '', tags: [], category: 'geometric' })
  }, [currentPattern, patternMetadata, savedPatterns, categories, onPatternSaved])

  const deletePattern = useCallback((pattern: DotPattern) => {
    if (!pattern.id || !confirm(`Delete pattern "${pattern.name || 'Untitled'}"?`)) return

    const updatedPatterns = savedPatterns.filter(p => p.id !== pattern.id)
    setSavedPatterns(updatedPatterns)

    // Update categories
    const updatedCategories = categories.map(category => ({
      ...category,
      patterns: updatedPatterns.filter(p => p.metadata?.category === category.id)
    }))
    setCategories(updatedCategories)

    // Save to localStorage
    try {
      localStorage.setItem('dot23d_saved_patterns', JSON.stringify(updatedPatterns))
    } catch (error) {
      console.error('Failed to save patterns after deletion:', error)
    }

    onPatternDeleted?.(pattern.id)
    
    if (currentPattern?.id === pattern.id) {
      setCurrentPattern(null)
    }
  }, [savedPatterns, categories, currentPattern, onPatternDeleted])

  const duplicatePattern = useCallback((pattern: DotPattern) => {
    const duplicate: DotPattern = {
      ...pattern,
      id: `pattern_${Date.now()}`,
      name: `${pattern.name || 'Untitled'} (Copy)`,
      metadata: {
        ...pattern.metadata,
        name: `${pattern.name || 'Untitled'} (Copy)`,
        createdAt: new Date(),
        modifiedAt: new Date()
      }
    }

    setCurrentPattern(duplicate)
    setPatternMetadata({
      name: duplicate.name || '',
      description: duplicate.description || '',
      tags: duplicate.metadata?.tags || [],
      category: duplicate.metadata?.category || 'geometric'
    })
    setIsCreatingNew(true)
    setActiveTab('editor')
  }, [])

  const loadPattern = useCallback((pattern: DotPattern) => {
    setCurrentPattern(pattern)
    setPatternMetadata({
      name: pattern.name || '',
      description: pattern.description || '',
      tags: pattern.metadata?.tags || [],
      category: pattern.metadata?.category || 'geometric'
    })
    setActiveTab('editor')
    onPatternSelected?.(pattern)
  }, [onPatternSelected])

  const createNewPattern = useCallback(() => {
    const newPattern: DotPattern = {
      data: Array(24).fill(null).map(() => Array(24).fill(false)),
      width: 24,
      height: 24,
      metadata: {
        createdAt: new Date(),
        modifiedAt: new Date()
      }
    }
    
    setCurrentPattern(newPattern)
    setPatternMetadata({ name: '', description: '', tags: [], category: 'geometric' })
    setIsCreatingNew(true)
    setActiveTab('editor')
  }, [])

  const handlePatternChange = useCallback((pattern: DotPattern) => {
    setCurrentPattern(pattern)
  }, [])

  const handleTagAdd = useCallback((tag: string) => {
    if (tag.trim() && !patternMetadata.tags.includes(tag.trim())) {
      setPatternMetadata(prev => ({
        ...prev,
        tags: [...prev.tags, tag.trim()]
      }))
    }
  }, [patternMetadata.tags])

  const handleTagRemove = useCallback((tagToRemove: string) => {
    setPatternMetadata(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }))
  }, [])

  const filteredPatterns = savedPatterns.filter(pattern => {
    const matchesSearch = !searchTerm || 
      (pattern.name?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (pattern.description?.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (pattern.metadata?.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase())))
    
    const matchesCategory = selectedCategory === 'all' || pattern.metadata?.category === selectedCategory
    
    return matchesSearch && matchesCategory
  }).sort((a, b) => {
    switch (sortBy) {
      case 'name':
        return (a.name || 'Untitled').localeCompare(b.name || 'Untitled')
      case 'size':
        return (b.width * b.height) - (a.width * a.height)
      case 'date':
      default:
        return (b.metadata?.modifiedAt?.getTime() || 0) - (a.metadata?.modifiedAt?.getTime() || 0)
    }
  })

  return (
    <div className={`testing-panel pattern-management-panel ${className}`}>
      <div className="testing-panel__header">
        <div>
          <h3 className="testing-panel__title">Pattern Management</h3>
          <p className="testing-panel__subtitle">Create, edit, and organize dot patterns for 3D generation</p>
        </div>
        <div className="testing-panel__actions">
          <button onClick={createNewPattern} className="testing-btn testing-btn--primary">
            New Pattern
          </button>
        </div>
      </div>

      <div className="testing-panel__content">
        <div className="testing-tabs">
          <div className="testing-tabs__nav">
            <button 
              className={`testing-tab ${activeTab === 'editor' ? 'testing-tab--active' : ''}`}
              onClick={() => setActiveTab('editor')}
            >
              Pattern Editor
              {currentPattern && <span className="testing-tab__badge">1</span>}
            </button>
            <button 
              className={`testing-tab ${activeTab === 'library' ? 'testing-tab--active' : ''}`}
              onClick={() => setActiveTab('library')}
            >
              Pattern Library
              <span className="testing-tab__badge">{savedPatterns.length}</span>
            </button>
            <button 
              className={`testing-tab ${activeTab === 'templates' ? 'testing-tab--active' : ''}`}
              onClick={() => setActiveTab('templates')}
            >
              Templates
              <span className="testing-tab__badge">{categories.reduce((sum, cat) => sum + cat.patterns.length, 0)}</span>
            </button>
          </div>

          <div className="testing-tabs__content">
            {/* Pattern Editor Tab */}
            {activeTab === 'editor' && (
              <div className="pattern-editor-tab">
                {currentPattern ? (
                  <div className="editor-layout">
                    <div className="editor-main">
                      <PatternEditor
                        pattern={currentPattern}
                        onChange={handlePatternChange}
                        width={currentPattern.width}
                        height={currentPattern.height}
                        showGrid={true}
                        enableZoom={true}
                      />
                    </div>
                    
                    <div className="editor-sidebar">
                      <div className="testing-form">
                        <div className="testing-form__section">
                          <h4 className="testing-form__section-title">Pattern Properties</h4>
                          
                          <div className="testing-form__row testing-form__row--full">
                            <label className="testing-form__label testing-form__label--required">
                              Pattern Name
                            </label>
                            <input
                              type="text"
                              className="testing-input"
                              value={patternMetadata.name}
                              onChange={(e) => setPatternMetadata(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="Enter pattern name"
                            />
                          </div>

                          <div className="testing-form__row testing-form__row--full">
                            <label className="testing-form__label">Description</label>
                            <textarea
                              className="testing-input testing-textarea"
                              value={patternMetadata.description}
                              onChange={(e) => setPatternMetadata(prev => ({ ...prev, description: e.target.value }))}
                              placeholder="Describe this pattern"
                              rows={3}
                            />
                          </div>

                          <div className="testing-form__row testing-form__row--full">
                            <label className="testing-form__label">Category</label>
                            <select
                              className="testing-input testing-select"
                              value={patternMetadata.category}
                              onChange={(e) => setPatternMetadata(prev => ({ ...prev, category: e.target.value }))}
                            >
                              {categories.map(category => (
                                <option key={category.id} value={category.id}>
                                  {category.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div className="testing-form__row testing-form__row--full">
                            <label className="testing-form__label">Tags</label>
                            <div className="tag-input">
                              <div className="tag-list">
                                {patternMetadata.tags.map(tag => (
                                  <span key={tag} className="tag">
                                    {tag}
                                    <button 
                                      type="button" 
                                      onClick={() => handleTagRemove(tag)}
                                      className="tag-remove"
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>
                              <input
                                type="text"
                                className="testing-input"
                                placeholder="Add tags..."
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault()
                                    handleTagAdd(e.currentTarget.value)
                                    e.currentTarget.value = ''
                                  }
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="testing-form__section">
                          <h4 className="testing-form__section-title">Pattern Info</h4>
                          <div className="pattern-stats">
                            <div className="stat-item">
                              <span className="stat-label">Dimensions:</span>
                              <span className="stat-value">{currentPattern.width} × {currentPattern.height}</span>
                            </div>
                            <div className="stat-item">
                              <span className="stat-label">Density:</span>
                              <span className="stat-value">
                                {Math.round((currentPattern.data.flat().filter(Boolean).length / (currentPattern.width * currentPattern.height)) * 100)}%
                              </span>
                            </div>
                            <div className="stat-item">
                              <span className="stat-label">Total Dots:</span>
                              <span className="stat-value">{currentPattern.data.flat().filter(Boolean).length}</span>
                            </div>
                          </div>
                        </div>

                        <div className="editor-actions">
                          <button onClick={savePattern} className="testing-btn testing-btn--success">
                            {currentPattern.id && !isCreatingNew ? 'Update Pattern' : 'Save Pattern'}
                          </button>
                          <button 
                            onClick={() => {
                              setCurrentPattern(null)
                              setIsCreatingNew(false)
                              setPatternMetadata({ name: '', description: '', tags: [], category: 'geometric' })
                            }} 
                            className="testing-btn testing-btn--secondary"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="empty-editor">
                    <div className="empty-state">
                      <h4>No Pattern Selected</h4>
                      <p>Create a new pattern or select one from your library to start editing.</p>
                      <button onClick={createNewPattern} className="testing-btn testing-btn--primary">
                        Create New Pattern
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pattern Library Tab */}
            {activeTab === 'library' && (
              <div className="pattern-library-tab">
                <div className="library-controls">
                  <div className="search-bar">
                    <input
                      type="text"
                      className="testing-input"
                      placeholder="Search patterns..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                  
                  <div className="filter-controls">
                    <select
                      className="testing-input testing-select"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value)}
                    >
                      <option value="all">All Categories</option>
                      {categories.map(category => (
                        <option key={category.id} value={category.id}>
                          {category.name} ({category.patterns.length})
                        </option>
                      ))}
                    </select>
                    
                    <select
                      className="testing-input testing-select"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as 'name' | 'date' | 'size')}
                    >
                      <option value="date">Sort by Date</option>
                      <option value="name">Sort by Name</option>
                      <option value="size">Sort by Size</option>
                    </select>
                  </div>
                </div>

                <div className="pattern-grid">
                  {filteredPatterns.length === 0 ? (
                    <div className="empty-state">
                      <h4>No Patterns Found</h4>
                      <p>
                        {searchTerm 
                          ? 'No patterns match your search criteria.'
                          : 'You haven\'t saved any patterns yet. Create your first pattern to get started.'
                        }
                      </p>
                      {!searchTerm && (
                        <button onClick={createNewPattern} className="testing-btn testing-btn--primary">
                          Create First Pattern
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredPatterns.map(pattern => (
                      <div key={pattern.id} className="pattern-card">
                        <div className="pattern-preview">
                          <PatternEditor
                            pattern={pattern}
                            width={pattern.width}
                            height={pattern.height}
                            cellSize={4}
                            readOnly={true}
                            showGrid={false}
                            enableZoom={false}
                          />
                        </div>
                        
                        <div className="pattern-info">
                          <h5 className="pattern-title">{pattern.name || 'Untitled'}</h5>
                          <p className="pattern-description">{pattern.description || 'No description'}</p>
                          
                          <div className="pattern-meta">
                            <span className="pattern-size">{pattern.width}×{pattern.height}</span>
                            <span className="pattern-category">
                              {categories.find(c => c.id === pattern.metadata?.category)?.name || 'Uncategorized'}
                            </span>
                          </div>
                          
                          {pattern.metadata?.tags && pattern.metadata.tags.length > 0 && (
                            <div className="pattern-tags">
                              {pattern.metadata.tags.map(tag => (
                                <span key={tag} className="tag tag--small">{tag}</span>
                              ))}
                            </div>
                          )}
                          
                          <div className="pattern-actions">
                            <button 
                              onClick={() => loadPattern(pattern)}
                              className="testing-btn testing-btn--sm testing-btn--primary"
                            >
                              Edit
                            </button>
                            <button 
                              onClick={() => duplicatePattern(pattern)}
                              className="testing-btn testing-btn--sm testing-btn--secondary"
                            >
                              Duplicate
                            </button>
                            <button 
                              onClick={() => deletePattern(pattern)}
                              className="testing-btn testing-btn--sm testing-btn--error"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Templates Tab */}
            {activeTab === 'templates' && (
              <div className="templates-tab">
                <div className="templates-intro">
                  <h4>Pattern Templates</h4>
                  <p>Start with pre-designed patterns organized by category. Click any template to begin editing.</p>
                </div>

                <div className="categories-grid">
                  {categories.map(category => (
                    <div key={category.id} className="category-card">
                      <div className="category-header">
                        <h5 className="category-title">{category.name}</h5>
                        <p className="category-description">{category.description}</p>
                        <span className="category-count">{category.patterns.length} patterns</span>
                      </div>
                      
                      <div className="category-patterns">
                        {category.patterns.length === 0 ? (
                          <div className="empty-category">
                            <p>No templates in this category yet.</p>
                            <button 
                              onClick={() => {
                                setPatternMetadata(prev => ({ ...prev, category: category.id }))
                                createNewPattern()
                              }}
                              className="testing-btn testing-btn--sm testing-btn--ghost"
                            >
                              Create First Template
                            </button>
                          </div>
                        ) : (
                          category.patterns.slice(0, 4).map(pattern => (
                            <div key={pattern.id} className="template-preview" onClick={() => loadPattern(pattern)}>
                              <PatternEditor
                                pattern={pattern}
                                width={pattern.width}
                                height={pattern.height}
                                cellSize={3}
                                readOnly={true}
                                showGrid={false}
                                enableZoom={false}
                              />
                              <span className="template-name">{pattern.name || 'Untitled'}</span>
                            </div>
                          ))
                        )}
                      </div>
                      
                      {category.patterns.length > 4 && (
                        <button 
                          onClick={() => {
                            setSelectedCategory(category.id)
                            setActiveTab('library')
                          }}
                          className="testing-btn testing-btn--sm testing-btn--ghost category-view-all"
                        >
                          View All {category.patterns.length}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <style jsx>{`
        .pattern-management-panel {
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .editor-layout {
          display: grid;
          grid-template-columns: 1fr 320px;
          gap: var(--space-6);
          height: 600px;
        }

        .editor-main {
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--color-bg-secondary);
          border-radius: var(--radius-lg);
          padding: var(--space-6);
        }

        .editor-sidebar {
          background-color: var(--color-bg-secondary);
          border-radius: var(--radius-lg);
          padding: var(--space-6);
          overflow-y: auto;
        }

        .editor-actions {
          display: flex;
          gap: var(--space-3);
          margin-top: var(--space-6);
        }

        .empty-editor, .empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: var(--space-12);
          color: var(--color-text-muted);
        }

        .empty-state h4 {
          margin-bottom: var(--space-3);
          color: var(--color-text-secondary);
        }

        .empty-state p {
          margin-bottom: var(--space-6);
          max-width: 400px;
        }

        .library-controls {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: var(--space-4);
          margin-bottom: var(--space-6);
          padding: var(--space-4);
          background-color: var(--color-bg-secondary);
          border-radius: var(--radius-lg);
        }

        .filter-controls {
          display: flex;
          gap: var(--space-3);
        }

        .pattern-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
          gap: var(--space-6);
        }

        .pattern-card {
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border-primary);
          border-radius: var(--radius-lg);
          overflow: hidden;
          transition: var(--transition-base);
        }

        .pattern-card:hover {
          box-shadow: var(--shadow-md);
          transform: translateY(-2px);
        }

        .pattern-preview {
          height: 120px;
          background-color: var(--color-bg-secondary);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: var(--space-4);
        }

        .pattern-info {
          padding: var(--space-4);
        }

        .pattern-title {
          margin: 0 0 var(--space-2) 0;
          font-size: var(--font-size-base);
          font-weight: var(--font-weight-semibold);
          color: var(--color-text-primary);
        }

        .pattern-description {
          margin: 0 0 var(--space-3) 0;
          font-size: var(--font-size-sm);
          color: var(--color-text-secondary);
          line-height: var(--line-height-relaxed);
        }

        .pattern-meta {
          display: flex;
          gap: var(--space-3);
          margin-bottom: var(--space-3);
          font-size: var(--font-size-xs);
          color: var(--color-text-muted);
        }

        .pattern-tags {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-1);
          margin-bottom: var(--space-4);
        }

        .pattern-actions {
          display: flex;
          gap: var(--space-2);
        }

        .tag-input {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .tag-list {
          display: flex;
          flex-wrap: wrap;
          gap: var(--space-1);
        }

        .tag {
          background-color: var(--color-primary-light);
          color: var(--color-primary);
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-full);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
          display: flex;
          align-items: center;
          gap: var(--space-1);
        }

        .tag--small {
          padding: 2px var(--space-2);
        }

        .tag-remove {
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          padding: 0;
          font-size: var(--font-size-sm);
          line-height: 1;
        }

        .pattern-stats {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .stat-item {
          display: flex;
          justify-content: space-between;
          font-size: var(--font-size-sm);
        }

        .stat-label {
          color: var(--color-text-secondary);
        }

        .stat-value {
          font-weight: var(--font-weight-medium);
          color: var(--color-text-primary);
        }

        .templates-intro {
          margin-bottom: var(--space-6);
          text-align: center;
          padding: var(--space-6);
          background-color: var(--color-bg-secondary);
          border-radius: var(--radius-lg);
        }

        .templates-intro h4 {
          margin: 0 0 var(--space-2) 0;
          color: var(--color-text-primary);
        }

        .templates-intro p {
          margin: 0;
          color: var(--color-text-secondary);
        }

        .categories-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(350px, 1fr));
          gap: var(--space-6);
        }

        .category-card {
          background-color: var(--color-bg-primary);
          border: 1px solid var(--color-border-primary);
          border-radius: var(--radius-lg);
          padding: var(--space-6);
        }

        .category-header {
          margin-bottom: var(--space-4);
        }

        .category-title {
          margin: 0 0 var(--space-2) 0;
          color: var(--color-text-primary);
          font-size: var(--font-size-lg);
        }

        .category-description {
          margin: 0 0 var(--space-2) 0;
          color: var(--color-text-secondary);
          font-size: var(--font-size-sm);
        }

        .category-count {
          background-color: var(--color-bg-tertiary);
          color: var(--color-text-muted);
          padding: var(--space-1) var(--space-2);
          border-radius: var(--radius-full);
          font-size: var(--font-size-xs);
          font-weight: var(--font-weight-medium);
        }

        .category-patterns {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--space-3);
          min-height: 120px;
        }

        .template-preview {
          background-color: var(--color-bg-secondary);
          border-radius: var(--radius-md);
          padding: var(--space-3);
          cursor: pointer;
          transition: var(--transition-base);
          text-align: center;
        }

        .template-preview:hover {
          background-color: var(--color-bg-tertiary);
          transform: scale(1.02);
        }

        .template-name {
          display: block;
          margin-top: var(--space-2);
          font-size: var(--font-size-xs);
          color: var(--color-text-secondary);
          font-weight: var(--font-weight-medium);
        }

        .empty-category {
          grid-column: 1 / -1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: var(--space-6);
          color: var(--color-text-muted);
        }

        .empty-category p {
          margin-bottom: var(--space-3);
        }

        .category-view-all {
          margin-top: var(--space-4);
          width: 100%;
        }

        @media (max-width: 768px) {
          .editor-layout {
            grid-template-columns: 1fr;
            grid-template-rows: 400px auto;
            height: auto;
          }

          .library-controls {
            grid-template-columns: 1fr;
          }

          .filter-controls {
            flex-wrap: wrap;
          }

          .pattern-grid {
            grid-template-columns: 1fr;
          }

          .categories-grid {
            grid-template-columns: 1fr;
          }

          .category-patterns {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  )
}

export default PatternManagementPanel