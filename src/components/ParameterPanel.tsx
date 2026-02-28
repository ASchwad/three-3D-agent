import { useState } from 'react'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Download } from 'lucide-react'
import type { ProjectParams } from '../projects'
import type { ParamDef } from '../types'

interface ParameterPanelProps {
  params: ProjectParams
  onChange: (params: ProjectParams) => void
  paramDefs: ParamDef[]
  onExportSTL: () => void
  onExportGLB: () => Promise<void>
}

export default function ParameterPanel({ params, onChange, paramDefs, onExportSTL, onExportGLB }: ParameterPanelProps) {
  const [exporting, setExporting] = useState(false)
  const groups = paramDefs.reduce<Record<string, ParamDef[]>>((acc, p) => {
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
              {def.options ? (
                <>
                  <Label className="text-xs"><span>{def.label}</span></Label>
                  <div className="flex flex-wrap gap-1">
                    {def.options.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => onChange({ ...params, [def.key]: opt.value })}
                        className={`px-2 py-1 text-xs rounded border transition-colors ${
                          params[def.key] === opt.value
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background hover:bg-muted border-border'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <>
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
                </>
              )}
            </div>
          ))}
        </div>
      ))}

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
