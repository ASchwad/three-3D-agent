import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import type { PartOverrides, ProjectHandle, PartBaseDimensions } from '../types'
import type { UnitSystem } from '../lib/units'

interface SelectionPanelProps {
  partLabel: string
  selectedIds: Set<string>
  partOverrides: Record<string, PartOverrides>
  onPartOverridesChange: (ids: Set<string>, partial: Partial<PartOverrides>) => void
  onDelete: () => void
  handleRef: React.MutableRefObject<ProjectHandle | null>
  unit: UnitSystem
}

const DEFAULT_DISPLAY: PartOverrides = { scaleX: 1.0, scaleY: 1.0, scaleZ: 1.0, bevelRadius: 0.4, bevelSegments: 3 }

function getDisplayOverrides(selectedIds: Set<string>, partOverrides: Record<string, PartOverrides>): PartOverrides {
  const ids = Array.from(selectedIds)
  if (ids.length === 0) return DEFAULT_DISPLAY
  if (ids.length === 1) {
    return partOverrides[ids[0]] ?? DEFAULT_DISPLAY
  }
  let xSum = 0, ySum = 0, zSum = 0, brSum = 0, bsSum = 0
  let count = 0
  for (const id of ids) {
    const ov = partOverrides[id]
    if (ov) {
      xSum += ov.scaleX
      ySum += ov.scaleY
      zSum += ov.scaleZ
      brSum += ov.bevelRadius
      bsSum += ov.bevelSegments
      count++
    }
  }
  if (count === 0) return DEFAULT_DISPLAY
  return {
    scaleX: xSum / count,
    scaleY: ySum / count,
    scaleZ: zSum / count,
    bevelRadius: brSum / count,
    bevelSegments: Math.round(bsSum / count),
  }
}

export default function SelectionPanel({
  partLabel,
  selectedIds,
  partOverrides,
  onPartOverridesChange,
  onDelete,
  handleRef,
  unit,
}: SelectionPanelProps) {
  const selectionCount = selectedIds.size
  const displayOverrides = getDisplayOverrides(selectedIds, partOverrides)
  const isSingle = selectionCount === 1

  // For single selection, get base dimensions to show real sizes
  let baseDims: PartBaseDimensions | null = null
  if (isSingle) {
    const id = Array.from(selectedIds)[0]
    baseDims = handleRef.current?.getPartBaseDimensions(id) ?? null
  }

  const showDimensions = isSingle && baseDims !== null

  return (
    <div className="absolute top-4 right-4 w-80 bg-background/90 backdrop-blur border rounded-xl p-5 space-y-4 z-10 max-h-[75vh] overflow-y-auto">
      <h3 className="font-semibold text-xs uppercase tracking-widest text-muted-foreground">
        {selectionCount === 1 ? `1 ${partLabel} Selected` : `${selectionCount} ${partLabel}s Selected`}
      </h3>

      {/* Dimensions (single select) or Scale (multi select) */}
      <div className="space-y-3">
        <p className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-widest">
          {showDimensions ? 'Dimensions' : 'Scale'}
        </p>
        {showDimensions ? (
          <>
            {(['x', 'y', 'z'] as const).map((axis) => {
              const scaleKey = `scale${axis.toUpperCase()}` as keyof Pick<PartOverrides, 'scaleX' | 'scaleY' | 'scaleZ'>
              const baseDim = baseDims![axis]
              const currentDim = baseDim * displayOverrides[scaleKey]
              const label = axis === 'x' ? 'Width' : axis === 'y' ? 'Height' : 'Depth'
              return (
                <div key={axis} className="space-y-2">
                  <Label className="text-xs flex justify-between text-foreground/80">
                    <span>{label}</span>
                    <span className="text-muted-foreground font-mono text-[11px]">
                      {currentDim.toFixed(1)}
                      <span className="text-muted-foreground/60 ml-0.5">{unit}</span>
                    </span>
                  </Label>
                  <Slider
                    min={Math.max(0.1, baseDim * 0.1)}
                    max={baseDim * 3.0}
                    step={baseDim * 0.01}
                    value={[currentDim]}
                    onValueChange={([v]) => onPartOverridesChange(selectedIds, { [scaleKey]: v / baseDim })}
                  />
                </div>
              )
            })}
          </>
        ) : (
          <>
            {(['X', 'Y', 'Z'] as const).map((axis) => {
              const key = `scale${axis}` as keyof Pick<PartOverrides, 'scaleX' | 'scaleY' | 'scaleZ'>
              return (
                <div key={axis} className="space-y-2">
                  <Label className="text-xs flex justify-between text-foreground/80">
                    <span>Scale {axis}</span>
                    <span className="text-muted-foreground font-mono text-[11px]">{displayOverrides[key].toFixed(2)}</span>
                  </Label>
                  <Slider
                    min={0.1}
                    max={3.0}
                    step={0.05}
                    value={[displayOverrides[key]]}
                    onValueChange={([v]) => onPartOverridesChange(selectedIds, { [key]: v })}
                  />
                </div>
              )
            })}
          </>
        )}
      </div>

      <div className="h-px bg-border/30" />

      {/* Bevel overrides */}
      <div className="space-y-3">
        <p className="text-[11px] font-medium text-muted-foreground/70 uppercase tracking-widest">Bevel</p>
        <div className="space-y-2">
          <Label className="text-xs flex justify-between text-foreground/80">
            <span>Bevel Radius</span>
            <span className="text-muted-foreground font-mono text-[11px]">{displayOverrides.bevelRadius.toFixed(2)}</span>
          </Label>
          <Slider
            min={0}
            max={1.0}
            step={0.05}
            value={[displayOverrides.bevelRadius]}
            onValueChange={([v]) => onPartOverridesChange(selectedIds, { bevelRadius: v })}
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs flex justify-between text-foreground/80">
            <span>Bevel Segments</span>
            <span className="text-muted-foreground font-mono text-[11px]">{Math.round(displayOverrides.bevelSegments)}</span>
          </Label>
          <Slider
            min={1}
            max={8}
            step={1}
            value={[displayOverrides.bevelSegments]}
            onValueChange={([v]) => onPartOverridesChange(selectedIds, { bevelSegments: v })}
          />
        </div>
      </div>

      {/* Delete section */}
      <div className="border-t border-border/50 pt-4 space-y-3">
        <p className="text-xs text-muted-foreground">
          Press <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Delete</kbd> or use the button to remove.
        </p>
        <button
          onClick={onDelete}
          className="w-full px-3 py-2 text-xs font-medium rounded-lg bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-all"
        >
          {selectionCount === 1
            ? `Delete Selected ${partLabel}`
            : `Delete ${selectionCount} ${partLabel}s`}
        </button>
      </div>
    </div>
  )
}
