import { useState, useEffect, useCallback } from 'react'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Download, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ProjectParams, ReferenceImage } from '../projects'
import type { ParamDef } from '../types'
import type { UnitSystem } from '../lib/units'
import { unitSuffix, scaleParamDef } from '../lib/units'

interface ParameterPanelProps {
  params: ProjectParams
  onChange: (params: ProjectParams) => void
  paramDefs: ParamDef[]
  onExportSTL: () => void
  onExportGLB: () => Promise<void>
  unit: UnitSystem
  onUnitChange: (unit: UnitSystem) => void
  referenceImages?: ReferenceImage[]
}

export default function ParameterPanel({
  params,
  onChange,
  paramDefs,
  onExportSTL,
  onExportGLB,
  unit,
  onUnitChange,
  referenceImages,
}: ParameterPanelProps) {
  const [exporting, setExporting] = useState(false)
  const [enlargedImage, setEnlargedImage] = useState<ReferenceImage | null>(null)

  const hasRefs = referenceImages && referenceImages.length > 0

  const enlargedIndex = hasRefs && enlargedImage
    ? referenceImages.findIndex((img) => img.label === enlargedImage.label)
    : -1

  const goToPrev = useCallback(() => {
    if (!hasRefs || enlargedIndex <= 0) return
    setEnlargedImage(referenceImages[enlargedIndex - 1])
  }, [hasRefs, referenceImages, enlargedIndex])

  const goToNext = useCallback(() => {
    if (!hasRefs || enlargedIndex < 0 || enlargedIndex >= referenceImages.length - 1) return
    setEnlargedImage(referenceImages[enlargedIndex + 1])
  }, [hasRefs, referenceImages, enlargedIndex])

  useEffect(() => {
    if (!enlargedImage) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') goToPrev()
      else if (e.key === 'ArrowRight') goToNext()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [enlargedImage, goToPrev, goToNext])

  const groups = paramDefs.reduce<Record<string, ParamDef[]>>((acc, p) => {
    if (!acc[p.group]) acc[p.group] = []
    acc[p.group].push(p)
    return acc
  }, {})

  const unitSelector = (
    <div className="flex items-center justify-end">
      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5">
        {(['mm', 'cm'] as const).map((u) => (
          <button
            key={u}
            onClick={() => onUnitChange(u)}
            className={`px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
              unit === u
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {u}
          </button>
        ))}
      </div>
    </div>
  )

  const parametersContent = (
    <>
      {Object.entries(groups).map(([group, defs], i) => (
        <div key={group} className="space-y-4">
          {i > 0 && <div className="h-px bg-border/30" />}
          <p className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-widest">{group}</p>
          {defs.map((rawDef) => {
            const def = scaleParamDef(rawDef, unit)
            const suffix = unitSuffix(def.unitType, unit)
            return (
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
                        {suffix && <span className="text-muted-foreground/60 ml-0.5">{suffix}</span>}
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
            )
          })}
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
    </>
  )

  const referenceContent = hasRefs && (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {referenceImages.map((img) => (
          <button
            key={img.label}
            onClick={() => setEnlargedImage(img)}
            className="group relative rounded-lg overflow-hidden border border-border/50 hover:border-primary/50 transition-all"
          >
            <img
              src={img.src}
              alt={img.label}
              className="w-full aspect-square object-cover group-hover:scale-105 transition-transform duration-200"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5">
              <span className="text-[10px] font-medium text-white">{img.label}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <>
      <div className="absolute top-16 left-4 w-80 bg-background/90 backdrop-blur border rounded-xl p-5 space-y-5 z-10 max-h-[75vh] overflow-y-auto">
        {hasRefs ? (
          <Tabs defaultValue="parameters">
            <div className="flex items-center gap-2">
              <TabsList className="flex-1">
                <TabsTrigger value="parameters" className="flex-1 text-xs">Parameters</TabsTrigger>
                <TabsTrigger value="reference" className="flex-1 text-xs">Reference</TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="parameters" className="space-y-5 mt-4">
              {unitSelector}
              {parametersContent}
            </TabsContent>
            <TabsContent value="reference" className="mt-4">
              {referenceContent}
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-5">
            {unitSelector}
            {parametersContent}
          </div>
        )}
      </div>

      {/* Enlarged image dialog with arrow navigation */}
      <Dialog open={!!enlargedImage} onOpenChange={(open) => !open && setEnlargedImage(null)}>
        <DialogContent className="sm:max-w-2xl p-2">
          <DialogTitle className="sr-only">{enlargedImage?.label}</DialogTitle>
          <DialogDescription className="sr-only">Reference image for the current project</DialogDescription>
          {enlargedImage && hasRefs && (
            <div className="space-y-2">
              <div className="relative">
                <img
                  src={enlargedImage.src}
                  alt={enlargedImage.label}
                  className="w-full rounded-lg"
                />
                {/* Left arrow */}
                {enlargedIndex > 0 && (
                  <button
                    onClick={goToPrev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                )}
                {/* Right arrow */}
                {enlargedIndex < referenceImages.length - 1 && (
                  <button
                    onClick={goToNext}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                )}
              </div>
              <p className="text-sm font-medium text-center text-muted-foreground">
                {enlargedImage.label}
                <span className="text-muted-foreground/50 ml-2 text-xs">{enlargedIndex + 1} / {referenceImages.length}</span>
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
