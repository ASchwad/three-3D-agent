import type * as THREE from 'three'

export interface PartOverrides {
  scaleX: number
  scaleY: number
  scaleZ: number
  bevelRadius: number
  bevelSegments: number
}

export interface ProjectHandle {
  selectedIds: Set<string>
  deleteSelected: () => void
  getGroup: () => THREE.Group | null
  getPartOverrides: (id: string) => PartOverrides | undefined
  updatePartOverrides: (ids: Set<string>, partial: Partial<PartOverrides>) => void
  getAllPartOverrides: () => Record<string, PartOverrides>
}

export interface ParamDef {
  key: string
  label: string
  min: number
  max: number
  step: number
  group: string
  options?: { value: number; label: string }[]
}
