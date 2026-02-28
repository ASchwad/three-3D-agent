import { useState } from 'react'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Download } from 'lucide-react'
import type { ProjectParams } from '../projects'

interface ParamDef {
  key: string
  label: string
  min: number
  max: number
  step: number
  group: string
}

const WAVY_PARAMS: ParamDef[] = [
  // Dimensions
  { key: 'baseWidth', label: 'Base Width', min: 1, max: 8, step: 0.1, group: 'Dimensions' },
  { key: 'baseDepth', label: 'Base Depth', min: 1, max: 8, step: 0.1, group: 'Dimensions' },
  { key: 'baseHeight', label: 'Base Height', min: 0.05, max: 0.5, step: 0.01, group: 'Dimensions' },
  // Counts & Spacing
  { key: 'finCount', label: 'Fin Count', min: 2, max: 12, step: 1, group: 'Counts & Spacing' },
  { key: 'finThickness', label: 'Fin Thickness', min: 0.02, max: 0.3, step: 0.01, group: 'Counts & Spacing' },
  // Wave Profile
  { key: 'waveAvg', label: 'Wave Average Height', min: 0.5, max: 3, step: 0.05, group: 'Wave Profile' },
  { key: 'waveA', label: 'Wave Amplitude A', min: 0, max: 1, step: 0.01, group: 'Wave Profile' },
  { key: 'waveB', label: 'Wave Amplitude B', min: 0, max: 1, step: 0.01, group: 'Wave Profile' },
  // Material
  { key: 'roughness', label: 'Roughness', min: 0, max: 1, step: 0.05, group: 'Material' },
  { key: 'metalness', label: 'Metalness', min: 0, max: 1, step: 0.05, group: 'Material' },
]

interface ParameterPanelProps {
  params: ProjectParams
  onChange: (params: ProjectParams) => void
  selectedFinId: string | null
  onDelete: () => void
  onExportSTL: () => void
  onExportGLB: () => Promise<void>
}

export default function ParameterPanel({ params, onChange, selectedFinId, onDelete, onExportSTL, onExportGLB }: ParameterPanelProps) {
  const [exporting, setExporting] = useState(false)
  const groups = WAVY_PARAMS.reduce<Record<string, ParamDef[]>>((acc, p) => {
    if (!acc[p.group]) acc[p.group] = []
    acc[p.group].push(p)
    return acc
  }, {})

  return (
    <div className="absolute top-4 right-4 w-72 bg-background/90 backdrop-blur border rounded-lg p-4 space-y-4 z-10 max-h-[80vh] overflow-y-auto">
      <h3 className="font-semibold text-sm">Parameters</h3>

      {Object.entries(groups).map(([group, defs]) => (
        <div key={group} className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{group}</p>
          {defs.map((def) => (
            <div key={def.key} className="space-y-1">
              <Label className="text-xs flex justify-between">
                <span>{def.label}</span>
                <span className="text-muted-foreground font-mono">
                  {def.step >= 1 ? Math.round(params[def.key]) : params[def.key].toFixed(2)}
                </span>
              </Label>
              <Slider
                min={def.min}
                max={def.max}
                step={def.step}
                value={[params[def.key]]}
                onValueChange={([v]) => onChange({ ...params, [def.key]: v })}
              />
            </div>
          ))}
        </div>
      ))}

      {/* Delete section */}
      <div className="border-t pt-3 space-y-2">
        <p className="text-xs text-muted-foreground">
          Click a fin to select it. Press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Delete</kbd> or use the button to remove it.
        </p>
        <button
          disabled={!selectedFinId}
          onClick={onDelete}
          className="w-full px-3 py-1.5 text-sm rounded bg-destructive text-destructive-foreground disabled:opacity-40 disabled:cursor-not-allowed hover:bg-destructive/90 transition-colors"
        >
          Delete Selected Fin
        </button>
      </div>

      {/* Export section */}
      <div className="border-t pt-3 space-y-2">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Export</p>
        <div className="flex gap-2">
          <button
            onClick={onExportSTL}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm rounded border bg-background hover:bg-muted transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            .stl
          </button>
          <button
            disabled={exporting}
            onClick={async () => {
              setExporting(true)
              try { await onExportGLB() } finally { setExporting(false) }
            }}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm rounded border bg-background hover:bg-muted disabled:opacity-40 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            {exporting ? '...' : '.glb'}
          </button>
        </div>
      </div>
    </div>
  )
}
