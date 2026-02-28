import type { UnitType, ParamDef } from '../types'
import type { ProjectParams } from '../projects'

export type UnitSystem = 'mm' | 'cm'

/** Conversion factor from mm to the target unit */
const MM_TO: Record<UnitSystem, number> = {
  mm: 1,
  cm: 0.1,
}

/** Get the display suffix for a unit type given the current unit system */
export function unitSuffix(unitType: UnitType, unit: UnitSystem): string {
  switch (unitType) {
    case 'length':
      return unit
    case 'angle':
      return '°'
    case 'count':
    case 'ratio':
      return ''
  }
}

/** Convert a single value between unit systems (only affects length params) */
function convertValue(value: number, unitType: UnitType, from: UnitSystem, to: UnitSystem): number {
  if (unitType !== 'length' || from === to) return value
  // Convert: value_in_from_units * (mm_per_from_unit) * (to_units_per_mm)
  return value / MM_TO[from] * MM_TO[to]
}

/** Convert all length params in a ProjectParams map when switching units */
export function convertParams(
  params: ProjectParams,
  paramDefs: ParamDef[],
  from: UnitSystem,
  to: UnitSystem,
): ProjectParams {
  if (from === to) return params
  const converted = { ...params }
  for (const def of paramDefs) {
    if (def.unitType === 'length' && converted[def.key] !== undefined) {
      converted[def.key] = convertValue(converted[def.key], 'length', from, to)
    }
  }
  return converted
}

/** Scale a ParamDef's min/max/step for the current unit system.
 *  ParamDefs are authored in mm — this converts to the display unit. */
export function scaleParamDef(def: ParamDef, unit: UnitSystem): ParamDef {
  if (def.unitType !== 'length' || unit === 'mm') return def
  const factor = MM_TO[unit]
  return {
    ...def,
    min: def.min * factor,
    max: def.max * factor,
    step: def.step * factor,
  }
}

/** Factor to multiply scene coordinates by when exporting STL (slicer expects mm) */
export function stlScaleFactor(unit: UnitSystem): number {
  // Scene is in the working unit. STL expects mm.
  // mm → 1, cm → 10
  return 1 / MM_TO[unit]
}

/** Factor to multiply scene coordinates by when exporting GLB (glTF expects meters) */
export function glbScaleFactor(unit: UnitSystem): number {
  // Scene is in the working unit. glTF expects meters.
  // mm → 0.001, cm → 0.01
  return (1 / MM_TO[unit]) * 0.001
}
