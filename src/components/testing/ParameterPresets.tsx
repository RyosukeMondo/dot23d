import React, { useState, useEffect, useMemo } from 'react'
import type { ParameterPreset, Model3DParams } from '@/types'
import { TestSessionService } from '@/services/TestSessionService'
import styles from './ParameterPresets.module.css'

export interface ParameterPresetsProps {
  /** Current parameters to compare against */
  currentParams?: Model3DParams
  /** Callback when a preset is selected */
  onPresetSelect?: (params: Model3DParams, preset: ParameterPreset) => void
  /** Callback when a new preset is created */
  onPresetCreate?: (preset: ParameterPreset) => void
  /** Allow editing presets */
  allowEdit?: boolean
  /** Show detailed parameter comparison */
  showComparison?: boolean
}

export const ParameterPresets: React.FC<ParameterPresetsProps> = ({
  currentParams,
  onPresetSelect,
  onPresetCreate,
  allowEdit = true,
  showComparison = true
}) => {
  const [presets, setPresets] = useState<ParameterPreset[]>([])
  const [selectedCategory, setSelectedCategory] = useState<'quality' | 'speed' | 'printing' | 'size' | 'custom' | 'all'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'rating' | 'usage' | 'created'>('rating')
  const [isCreatingPreset, setIsCreatingPreset] = useState(false)
  const [presetFormData, setPresetFormData] = useState({
    name: '',
    description: '',
    category: 'custom' as const,
    recommendedFor: ''
  })

  // Load presets
  useEffect(() => {
    const loadedPresets = TestSessionService.getParameterPresets()
    setPresets(loadedPresets)
  }, [])

  // Filter and sort presets
  const filteredPresets = useMemo(() => {
    let filtered = presets.filter(preset => 
      selectedCategory === 'all' || preset.category === selectedCategory
    )

    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'rating':
          return b.rating - a.rating
        case 'usage':
          return b.usageCount - a.usageCount
        case 'created':
          return b.createdAt.getTime() - a.createdAt.getTime()
        default:
          return 0
      }
    })

    return filtered
  }, [presets, selectedCategory, sortBy])

  // Categories with counts
  const categoryStats = useMemo(() => {
    const stats = {
      all: presets.length,
      quality: 0,
      speed: 0,
      printing: 0,
      size: 0,
      custom: 0
    }

    presets.forEach(preset => {
      stats[preset.category]++
    })

    return stats
  }, [presets])

  // Get parameter differences
  const getParameterDifferences = (preset: ParameterPreset): Array<{
    param: keyof Model3DParams
    current?: number | boolean
    preset?: number | boolean
    different: boolean
  }> => {
    if (!currentParams) return []

    const differences: Array<{
      param: keyof Model3DParams
      current?: number | boolean
      preset?: number | boolean
      different: boolean
    }> = []

    Object.entries(preset.parameters).forEach(([key, presetValue]) => {
      const paramKey = key as keyof Model3DParams
      const currentValue = currentParams[paramKey]
      
      differences.push({
        param: paramKey,
        current: currentValue,
        preset: presetValue,
        different: currentValue !== presetValue
      })
    })

    return differences
  }

  // Create preset from current parameters
  const handleCreatePreset = () => {
    if (!currentParams || !presetFormData.name.trim()) return

    const newPreset: ParameterPreset = {
      id: `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: presetFormData.name,
      description: presetFormData.description,
      category: presetFormData.category,
      parameters: { ...currentParams },
      author: 'user',
      createdAt: new Date(),
      usageCount: 0,
      rating: 0,
      compatiblePatterns: [],
      recommendedFor: presetFormData.recommendedFor.split(',').map(s => s.trim()).filter(s => s)
    }

    TestSessionService.saveParameterPreset(newPreset)
    setPresets(prev => [newPreset, ...prev])
    onPresetCreate?.(newPreset)

    // Reset form
    setPresetFormData({
      name: '',
      description: '',
      category: 'custom',
      recommendedFor: ''
    })
    setIsCreatingPreset(false)
  }

  // Rate a preset
  const handleRatePreset = (presetId: string, rating: number) => {
    const preset = presets.find(p => p.id === presetId)
    if (!preset) return

    const updatedPreset = { ...preset, rating }
    TestSessionService.saveParameterPreset(updatedPreset)
    setPresets(prev => prev.map(p => p.id === presetId ? updatedPreset : p))
  }

  // Delete preset
  const handleDeletePreset = (presetId: string) => {
    if (window.confirm('Are you sure you want to delete this preset?')) {
      TestSessionService.deleteParameterPreset(presetId)
      setPresets(prev => prev.filter(p => p.id !== presetId))
    }
  }

  // Format parameter name for display
  const formatParameterName = (param: keyof Model3DParams): string => {
    const nameMap: Record<keyof Model3DParams, string> = {
      cubeHeight: 'Cube Height',
      cubeSize: 'Cube Size',
      spacing: 'Spacing',
      generateBase: 'Generate Base',
      baseThickness: 'Base Thickness',
      optimizeMesh: 'Optimize Mesh',
      mergeAdjacentFaces: 'Merge Faces',
      chamferEdges: 'Chamfer Edges',
      chamferSize: 'Chamfer Size'
    }
    return nameMap[param] || param
  }

  // Format parameter value for display
  const formatParameterValue = (value: number | boolean | undefined): string => {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No'
    if (typeof value === 'number') return value.toFixed(2)
    return 'N/A'
  }

  // Render star rating
  const renderStarRating = (rating: number, interactive = false, onRate?: (rating: number) => void) => {
    const stars = []
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <button
          key={i}
          className={`${styles.star} ${i <= rating ? styles.starFilled : ''}`}
          onClick={() => interactive && onRate?.(i)}
          disabled={!interactive}
        >
          ★
        </button>
      )
    }
    return <div className={styles.starRating}>{stars}</div>
  }

  return (
    <div className={styles.parameterPresets}>
      <div className={styles.header}>
        <h3>Parameter Presets</h3>
        <div className={styles.controls}>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value as any)}
            className={styles.categorySelect}
          >
            <option value="all">All ({categoryStats.all})</option>
            <option value="quality">Quality ({categoryStats.quality})</option>
            <option value="speed">Speed ({categoryStats.speed})</option>
            <option value="printing">Printing ({categoryStats.printing})</option>
            <option value="size">Size ({categoryStats.size})</option>
            <option value="custom">Custom ({categoryStats.custom})</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className={styles.sortSelect}
          >
            <option value="rating">Rating</option>
            <option value="name">Name</option>
            <option value="usage">Usage</option>
            <option value="created">Created</option>
          </select>
        </div>
      </div>

      {allowEdit && currentParams && (
        <div className={styles.actions}>
          <button
            onClick={() => setIsCreatingPreset(true)}
            className={styles.createButton}
            disabled={!currentParams}
          >
            Save Current as Preset
          </button>
        </div>
      )}

      {isCreatingPreset && (
        <div className={styles.createForm}>
          <h4>Create New Preset</h4>
          <div className={styles.formRow}>
            <input
              type="text"
              placeholder="Preset name"
              value={presetFormData.name}
              onChange={(e) => setPresetFormData(prev => ({ ...prev, name: e.target.value }))}
              className={styles.formInput}
            />
            <select
              value={presetFormData.category}
              onChange={(e) => setPresetFormData(prev => ({ ...prev, category: e.target.value as any }))}
              className={styles.formSelect}
            >
              <option value="quality">Quality</option>
              <option value="speed">Speed</option>
              <option value="printing">Printing</option>
              <option value="size">Size</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <textarea
            placeholder="Description"
            value={presetFormData.description}
            onChange={(e) => setPresetFormData(prev => ({ ...prev, description: e.target.value }))}
            className={styles.formTextarea}
          />
          <input
            type="text"
            placeholder="Recommended for (comma-separated)"
            value={presetFormData.recommendedFor}
            onChange={(e) => setPresetFormData(prev => ({ ...prev, recommendedFor: e.target.value }))}
            className={styles.formInput}
          />
          <div className={styles.formActions}>
            <button onClick={handleCreatePreset} className={styles.saveButton}>
              Save Preset
            </button>
            <button onClick={() => setIsCreatingPreset(false)} className={styles.cancelButton}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className={styles.presetsList}>
        {filteredPresets.map(preset => {
          const differences = showComparison ? getParameterDifferences(preset) : []
          const changedCount = differences.filter(d => d.different).length

          return (
            <div key={preset.id} className={styles.presetCard}>
              <div className={styles.presetHeader}>
                <div className={styles.presetInfo}>
                  <h4 className={styles.presetName}>{preset.name}</h4>
                  <span className={`${styles.category} ${styles[`category${preset.category.charAt(0).toUpperCase() + preset.category.slice(1)}`]}`}>
                    {preset.category}
                  </span>
                  {renderStarRating(preset.rating, allowEdit, (rating) => handleRatePreset(preset.id, rating))}
                </div>
                <div className={styles.presetActions}>
                  <button
                    onClick={() => onPresetSelect?.(preset.parameters as Model3DParams, preset)}
                    className={styles.useButton}
                  >
                    Use Preset
                  </button>
                  {allowEdit && (
                    <button
                      onClick={() => handleDeletePreset(preset.id)}
                      className={styles.deleteButton}
                      title="Delete preset"
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>

              <p className={styles.presetDescription}>{preset.description}</p>

              <div className={styles.presetMeta}>
                <span>Used {preset.usageCount} times</span>
                <span>Created {preset.createdAt.toLocaleDateString()}</span>
                {showComparison && currentParams && (
                  <span className={differences.some(d => d.different) ? styles.hasChanges : ''}>
                    {changedCount > 0 ? `${changedCount} changes` : 'No changes'}
                  </span>
                )}
              </div>

              {preset.recommendedFor.length > 0 && (
                <div className={styles.recommendedFor}>
                  <strong>Recommended for:</strong> {preset.recommendedFor.join(', ')}
                </div>
              )}

              {showComparison && currentParams && differences.length > 0 && (
                <div className={styles.parameterComparison}>
                  <h5>Parameter Changes</h5>
                  <div className={styles.comparisonTable}>
                    {differences.filter(d => d.different).map(diff => (
                      <div key={diff.param} className={styles.comparisonRow}>
                        <span className={styles.paramName}>
                          {formatParameterName(diff.param)}
                        </span>
                        <span className={styles.currentValue}>
                          {formatParameterValue(diff.current)}
                        </span>
                        <span className={styles.arrow}>→</span>
                        <span className={styles.presetValue}>
                          {formatParameterValue(diff.preset)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filteredPresets.length === 0 && (
        <div className={styles.emptyState}>
          <p>No presets found for the selected category.</p>
          {allowEdit && currentParams && (
            <p>Create your first preset by saving the current parameters.</p>
          )}
        </div>
      )}
    </div>
  )
}

export default ParameterPresets