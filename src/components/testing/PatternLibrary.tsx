import React, { useState, useEffect, useCallback, useMemo } from 'react'
import type { DotPattern } from '@/types'
import PatternEditor from './PatternEditor'
import styles from './PatternLibrary.module.css'

interface StoredPattern extends DotPattern {
  id: string
  name: string
  description: string
  category: string
  tags: string[]
  thumbnail?: string
  usageCount: number
  createdAt: Date
  lastUsed?: Date
}

export interface PatternLibraryProps {
  /** Callback when a pattern is selected */
  onPatternSelect?: (pattern: DotPattern) => void
  /** Callback when a pattern is deleted */
  onPatternDelete?: (id: string) => void
  /** Allow editing patterns */
  allowEdit?: boolean
  /** Show pattern previews */
  showPreviews?: boolean
  /** Maximum patterns to display */
  maxDisplay?: number
}

const STORAGE_KEY = 'dot23d_pattern_library'
const DEFAULT_CATEGORIES = ['Basic', 'Geometric', 'Organic', 'Text', 'Decorative', 'Custom']

export const PatternLibrary: React.FC<PatternLibraryProps> = ({
  onPatternSelect,
  onPatternDelete,
  allowEdit = true,
  showPreviews = true,
  maxDisplay = 50
}) => {
  const [patterns, setPatterns] = useState<StoredPattern[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'used' | 'usage'>('name')
  const [isAddingPattern, setIsAddingPattern] = useState(false)
  const [editingPattern, setEditingPattern] = useState<StoredPattern | null>(null)
  const [newPatternData, setNewPatternData] = useState({
    name: '',
    description: '',
    category: 'Custom',
    tags: ''
  })

  // Load patterns from storage
  const loadPatterns = useCallback(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsedPatterns = JSON.parse(stored) as StoredPattern[]
        const deserializedPatterns = parsedPatterns.map(p => ({
          ...p,
          createdAt: new Date(p.createdAt),
          lastUsed: p.lastUsed ? new Date(p.lastUsed) : undefined,
          metadata: {
            ...p.metadata,
            createdAt: p.metadata?.createdAt ? new Date(p.metadata.createdAt) : new Date(),
            modifiedAt: p.metadata?.modifiedAt ? new Date(p.metadata.modifiedAt) : new Date()
          }
        }))
        setPatterns(deserializedPatterns)
      } else {
        // Load default patterns
        setPatterns(getDefaultPatterns())
      }
    } catch (error) {
      console.error('Failed to load patterns:', error)
      setPatterns(getDefaultPatterns())
    }
  }, [])

  // Save patterns to storage
  const savePatterns = useCallback((patternsToSave: StoredPattern[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(patternsToSave))
    } catch (error) {
      console.error('Failed to save patterns:', error)
    }
  }, [])

  // Filter and sort patterns
  const filteredPatterns = useMemo(() => {
    let filtered = patterns.filter(pattern => {
      const matchesSearch = searchTerm === '' || 
        pattern.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pattern.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        pattern.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
      
      const matchesCategory = selectedCategory === 'All' || pattern.category === selectedCategory
      
      return matchesSearch && matchesCategory
    })

    // Sort patterns
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'created':
          return b.createdAt.getTime() - a.createdAt.getTime()
        case 'used':
          return (b.lastUsed?.getTime() || 0) - (a.lastUsed?.getTime() || 0)
        case 'usage':
          return b.usageCount - a.usageCount
        default:
          return 0
      }
    })

    return filtered.slice(0, maxDisplay)
  }, [patterns, searchTerm, selectedCategory, sortBy, maxDisplay])

  // Get categories from patterns
  const categories = useMemo(() => {
    const patternCategories = [...new Set(patterns.map(p => p.category))]
    return ['All', ...DEFAULT_CATEGORIES.filter(cat => 
      patternCategories.includes(cat) || cat === 'Custom'
    )]
  }, [patterns])

  // Generate pattern thumbnail
  const generateThumbnail = useCallback((pattern: DotPattern): string => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return ''

    const size = 64
    const cellSize = size / Math.max(pattern.width, pattern.height)
    
    canvas.width = size
    canvas.height = size
    
    // Clear canvas
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, size, size)
    
    // Draw pattern
    const offsetX = (size - pattern.width * cellSize) / 2
    const offsetY = (size - pattern.height * cellSize) / 2
    
    for (let y = 0; y < pattern.height; y++) {
      for (let x = 0; x < pattern.width; x++) {
        if (pattern.data[y][x]) {
          ctx.fillStyle = '#333333'
          ctx.fillRect(
            offsetX + x * cellSize, 
            offsetY + y * cellSize, 
            cellSize, 
            cellSize
          )
        }
      }
    }
    
    return canvas.toDataURL()
  }, [])

  // Add pattern to library
  const addPattern = useCallback((pattern: DotPattern, metadata: {
    name: string
    description: string
    category: string
    tags: string[]
  }) => {
    const newPattern: StoredPattern = {
      ...pattern,
      id: `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: metadata.name,
      description: metadata.description,
      category: metadata.category,
      tags: metadata.tags,
      thumbnail: generateThumbnail(pattern),
      usageCount: 0,
      createdAt: new Date(),
      metadata: {
        ...pattern.metadata,
        createdAt: new Date(),
        modifiedAt: new Date()
      }
    }

    const updatedPatterns = [newPattern, ...patterns]
    setPatterns(updatedPatterns)
    savePatterns(updatedPatterns)
    return newPattern
  }, [patterns, savePatterns, generateThumbnail])

  // Update pattern usage
  const updatePatternUsage = useCallback((patternId: string) => {
    const updatedPatterns = patterns.map(p => 
      p.id === patternId 
        ? { ...p, usageCount: p.usageCount + 1, lastUsed: new Date() }
        : p
    )
    setPatterns(updatedPatterns)
    savePatterns(updatedPatterns)
  }, [patterns, savePatterns])

  // Delete pattern
  const deletePattern = useCallback((patternId: string) => {
    const updatedPatterns = patterns.filter(p => p.id !== patternId)
    setPatterns(updatedPatterns)
    savePatterns(updatedPatterns)
    onPatternDelete?.(patternId)
  }, [patterns, savePatterns, onPatternDelete])

  // Handle pattern selection
  const handlePatternSelect = useCallback((pattern: StoredPattern) => {
    updatePatternUsage(pattern.id)
    onPatternSelect?.(pattern)
  }, [onPatternSelect, updatePatternUsage])

  // Handle new pattern creation
  const handleCreatePattern = useCallback(() => {
    if (!newPatternData.name.trim()) return

    const emptyPattern: DotPattern = {
      data: Array(16).fill(null).map(() => Array(16).fill(false)),
      width: 16,
      height: 16,
      metadata: {
        createdAt: new Date(),
        modifiedAt: new Date()
      }
    }

    const tags = newPatternData.tags.split(',').map(t => t.trim()).filter(t => t)

    addPattern(emptyPattern, {
      name: newPatternData.name,
      description: newPatternData.description,
      category: newPatternData.category,
      tags
    })

    setNewPatternData({ name: '', description: '', category: 'Custom', tags: '' })
    setIsAddingPattern(false)
  }, [newPatternData, addPattern])

  // Import pattern from file
  const handlePatternImport = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const result = e.target?.result as string
        const pattern = JSON.parse(result) as DotPattern
        
        // Validate pattern structure
        if (!pattern.data || !Array.isArray(pattern.data) || !pattern.width || !pattern.height) {
          throw new Error('Invalid pattern format')
        }

        const name = file.name.replace(/\.[^/.]+$/, '') // Remove extension
        addPattern(pattern, {
          name: `Imported: ${name}`,
          description: 'Imported from file',
          category: 'Custom',
          tags: ['imported']
        })
      } catch (error) {
        console.error('Failed to import pattern:', error)
        alert('Failed to import pattern. Please check the file format.')
      }
    }
    reader.readAsText(file)
  }, [addPattern])

  // Export pattern to file
  const handlePatternExport = useCallback((pattern: StoredPattern) => {
    const dataStr = JSON.stringify(pattern, null, 2)
    const blob = new Blob([dataStr], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.href = url
    link.download = `${pattern.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.json`
    link.click()
    
    URL.revokeObjectURL(url)
  }, [])

  useEffect(() => {
    loadPatterns()
  }, [loadPatterns])

  return (
    <div className={styles.patternLibrary}>
      <div className={styles.header}>
        <h3>Pattern Library</h3>
        <div className={styles.controls}>
          <input
            type="text"
            placeholder="Search patterns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={styles.searchInput}
          />
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className={styles.categorySelect}
          >
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className={styles.sortSelect}
          >
            <option value="name">Name</option>
            <option value="created">Created</option>
            <option value="used">Last Used</option>
            <option value="usage">Usage Count</option>
          </select>
        </div>
      </div>

      <div className={styles.actions}>
        {allowEdit && (
          <button
            onClick={() => setIsAddingPattern(true)}
            className={styles.addButton}
          >
            Create New Pattern
          </button>
        )}
        <label className={styles.importButton}>
          Import Pattern
          <input
            type="file"
            accept=".json"
            onChange={handlePatternImport}
            style={{ display: 'none' }}
          />
        </label>
      </div>

      {isAddingPattern && (
        <div className={styles.addPatternForm}>
          <h4>Create New Pattern</h4>
          <div className={styles.formRow}>
            <input
              type="text"
              placeholder="Pattern name"
              value={newPatternData.name}
              onChange={(e) => setNewPatternData(prev => ({ ...prev, name: e.target.value }))}
              className={styles.formInput}
            />
            <select
              value={newPatternData.category}
              onChange={(e) => setNewPatternData(prev => ({ ...prev, category: e.target.value }))}
              className={styles.formSelect}
            >
              {DEFAULT_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <textarea
            placeholder="Description"
            value={newPatternData.description}
            onChange={(e) => setNewPatternData(prev => ({ ...prev, description: e.target.value }))}
            className={styles.formTextarea}
          />
          <input
            type="text"
            placeholder="Tags (comma-separated)"
            value={newPatternData.tags}
            onChange={(e) => setNewPatternData(prev => ({ ...prev, tags: e.target.value }))}
            className={styles.formInput}
          />
          <div className={styles.formActions}>
            <button onClick={handleCreatePattern} className={styles.createButton}>
              Create
            </button>
            <button onClick={() => setIsAddingPattern(false)} className={styles.cancelButton}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className={styles.patternGrid}>
        {filteredPatterns.map(pattern => (
          <div key={pattern.id} className={styles.patternCard}>
            {showPreviews && pattern.thumbnail && (
              <img
                src={pattern.thumbnail}
                alt={pattern.name}
                className={styles.thumbnail}
                onClick={() => handlePatternSelect(pattern)}
              />
            )}
            <div className={styles.patternInfo}>
              <h4 className={styles.patternName}>{pattern.name}</h4>
              <p className={styles.patternDescription}>{pattern.description}</p>
              <div className={styles.patternMeta}>
                <span className={styles.category}>{pattern.category}</span>
                <span className={styles.size}>{pattern.width}×{pattern.height}</span>
                <span className={styles.usage}>Used {pattern.usageCount} times</span>
              </div>
              {pattern.tags.length > 0 && (
                <div className={styles.tags}>
                  {pattern.tags.map((tag, index) => (
                    <span key={index} className={styles.tag}>{tag}</span>
                  ))}
                </div>
              )}
            </div>
            <div className={styles.patternActions}>
              <button
                onClick={() => handlePatternSelect(pattern)}
                className={styles.selectButton}
              >
                Use
              </button>
              <button
                onClick={() => handlePatternExport(pattern)}
                className={styles.exportButton}
              >
                Export
              </button>
              {allowEdit && (
                <button
                  onClick={() => deletePattern(pattern.id)}
                  className={styles.deleteButton}
                  title="Delete pattern"
                >
                  ×
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {filteredPatterns.length === 0 && (
        <div className={styles.emptyState}>
          {searchTerm || selectedCategory !== 'All' ? (
            <p>No patterns match your filters.</p>
          ) : (
            <p>No patterns in library. Create or import some patterns to get started.</p>
          )}
        </div>
      )}
    </div>
  )
}

// Default patterns to populate the library
function getDefaultPatterns(): StoredPattern[] {
  const patterns: StoredPattern[] = []
  
  // Simple cross pattern
  const crossData = Array(8).fill(null).map(() => Array(8).fill(false))
  crossData[3][1] = crossData[3][2] = crossData[3][3] = crossData[3][4] = crossData[3][5] = crossData[3][6] = true
  crossData[1][3] = crossData[2][3] = crossData[4][3] = crossData[5][3] = crossData[6][3] = true
  
  patterns.push({
    id: 'default-cross',
    name: 'Cross',
    description: 'Simple cross pattern',
    category: 'Basic',
    tags: ['cross', 'simple'],
    data: crossData,
    width: 8,
    height: 8,
    thumbnail: '',
    usageCount: 0,
    createdAt: new Date(),
    metadata: { createdAt: new Date(), modifiedAt: new Date() }
  })
  
  // Checkerboard pattern
  const checkerData = Array(8).fill(null).map((_, y) =>
    Array(8).fill(null).map((_, x) => (x + y) % 2 === 0)
  )
  
  patterns.push({
    id: 'default-checker',
    name: 'Checkerboard',
    description: 'Classic checkerboard pattern',
    category: 'Geometric',
    tags: ['checker', 'geometric'],
    data: checkerData,
    width: 8,
    height: 8,
    thumbnail: '',
    usageCount: 0,
    createdAt: new Date(),
    metadata: { createdAt: new Date(), modifiedAt: new Date() }
  })

  return patterns
}

export default PatternLibrary