import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import type { PartOverrides, BevelCapabilities } from '../types'

interface SelectionPanelProps {
  partLabel: string
  selectedIds: Set<string>
  partOverrides: Record<string, PartOverrides>
  bevelCapabilities: BevelCapabilities
  onPartOverridesChange: (ids: Set<string>, partial: Partial<PartOverrides>) => void
  onDelete: () => void
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

export default function SelectionPanel({ partLabel, selectedIds, partOverrides, bevelCapabilities, onPartOverridesChange, onDelete }: SelectionPanelProps) {
  const selectionCount = selectedIds.size
  const displayOverrides = getDisplayOverrides(selectedIds, partOverrides)

  const ids = Array.from(selectedIds)
  const showRadius = ids.length > 0 && ids.every(id => bevelCapabilities[id]?.radius)
  const showSegments = ids.length > 0 && ids.every(id => bevelCapabilities[id]?.segments)

  return (
    <div className="absolute bottom-4 right-4 w-72 bg-background/90 backdrop-blur border rounded-lg p-4 space-y-3 z-10 max-h-[50vh] overflow-y-auto">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {selectionCount === 1 ? `1 ${partLabel} Selected` : `${selectionCount} ${partLabel}s Selected`}
      </p>

      {/* Scale overrides */}
      <div className="space-y-2">
        <div className="space-y-1">
          <Label className="text-xs flex justify-between">
            <span>Scale X</span>
            <span className="text-muted-foreground font-mono">{displayOverrides.scaleX.toFixed(2)}</span>
          </Label>
          <Slider
            min={0.1}
            max={3.0}
            step={0.05}
            value={[displayOverrides.scaleX]}
            onValueChange={([v]) => onPartOverridesChange(selectedIds, { scaleX: v })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs flex justify-between">
            <span>Scale Y</span>
            <span className="text-muted-foreground font-mono">{displayOverrides.scaleY.toFixed(2)}</span>
          </Label>
          <Slider
            min={0.1}
            max={3.0}
            step={0.05}
            value={[displayOverrides.scaleY]}
            onValueChange={([v]) => onPartOverridesChange(selectedIds, { scaleY: v })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs flex justify-between">
            <span>Scale Z</span>
            <span className="text-muted-foreground font-mono">{displayOverrides.scaleZ.toFixed(2)}</span>
          </Label>
          <Slider
            min={0.1}
            max={3.0}
            step={0.05}
            value={[displayOverrides.scaleZ]}
            onValueChange={([v]) => onPartOverridesChange(selectedIds, { scaleZ: v })}
          />
        </div>
      </div>

      {/* Bevel overrides */}
      {(showRadius || showSegments) && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bevel</p>
          {showRadius && (
            <div className="space-y-1">
              <Label className="text-xs flex justify-between">
                <span>Bevel Radius</span>
                <span className="text-muted-foreground font-mono">{displayOverrides.bevelRadius.toFixed(2)}</span>
              </Label>
              <Slider
                min={0}
                max={1.0}
                step={0.05}
                value={[displayOverrides.bevelRadius]}
                onValueChange={([v]) => onPartOverridesChange(selectedIds, { bevelRadius: v })}
              />
            </div>
          )}
          {showSegments && (
            <div className="space-y-1">
              <Label className="text-xs flex justify-between">
                <span>Bevel Segments</span>
                <span className="text-muted-foreground font-mono">{Math.round(displayOverrides.bevelSegments)}</span>
              </Label>
              <Slider
                min={1}
                max={8}
                step={1}
                value={[displayOverrides.bevelSegments]}
                onValueChange={([v]) => onPartOverridesChange(selectedIds, { bevelSegments: v })}
              />
            </div>
          )}
        </div>
      )}

      {/* Delete section */}
      <div className="border-t pt-3 space-y-2">
        <p className="text-xs text-muted-foreground">
          Press <kbd className="px-1 py-0.5 bg-muted rounded text-[10px]">Delete</kbd> or use the button to remove.
        </p>
        <button
          onClick={onDelete}
          className="w-full px-3 py-1.5 text-sm rounded bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors"
        >
          {selectionCount === 1
            ? `Delete Selected ${partLabel}`
            : `Delete ${selectionCount} ${partLabel}s`}
        </button>
      </div>
    </div>
  )
}
