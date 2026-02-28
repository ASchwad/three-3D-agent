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
    <div className="absolute top-16 left-4 w-80 bg-background/90 backdrop-blur border rounded-xl p-5 space-y-5 z-10 max-h-[75vh] overflow-y-auto">
      <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground">Parameters</h3>

      {Object.entries(groups).map(([group, defs], i) => (
        <div key={group} className="space-y-4">
          {i > 0 && <div className="h-px bg-border/30" />}
          <p className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-widest">{group}</p>
          {defs.map((def) => (
            <div key={def.key} className="space-y-2">
              {def.options ? (
                <>
                  <Label className="text-xs text-foreground/80">{def.label}</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {def.options.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={() => onChange({ ...params, [def.key]: opt.value })}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
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
                  <Label className="text-xs flex justify-between text-foreground/80">
                    <span>{def.label}</span>
                    <span className="text-muted-foreground font-mono text-[11px]">
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
      <div className="border-t border-border/50 pt-4 space-y-3">
        <p className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-widest">Export</p>
        <div className="flex gap-2">
          <button
            onClick={onExportSTL}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-border/50 bg-background hover:bg-muted transition-all"
          >
            <Download className="size-3.5" />
            .stl
          </button>
          <button
            disabled={exporting}
            onClick={async () => {
              setExporting(true)
              try { await onExportGLB() } finally { setExporting(false) }
            }}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-border/50 bg-background hover:bg-muted disabled:opacity-40 transition-all"
          >
            <Download className="size-3.5" />
            {exporting ? '...' : '.glb'}
          </button>
        </div>
      </div>
    </div>
  )
}
