import { lazy, type ComponentType } from 'react'
import type { ParamDef, ProjectHandle } from './types'

export interface ProjectParams {
  [key: string]: number
}

export interface Project {
  id: string
  name: string
  description: string
  component: ReturnType<typeof lazy<ComponentType<{
    params: ProjectParams
    onParamsChange: (p: ProjectParams) => void
    onSelectionChange?: (ids: Set<string>) => void
    handleRef?: React.MutableRefObject<ProjectHandle | null>
  }>>>
  defaultParams: ProjectParams
  paramDefs: ParamDef[]
  partLabel: string
}

export const projects: Project[] = [
  {
    id: 'wavy-structure',
    name: 'Wavy Structure',
    description: 'Parametric wavy fin lattice with dual-cosine wave profile',
    component: lazy(() => import('./components/WavyStructure')),
    defaultParams: {
      baseWidth: 3.5,
      baseDepth: 2.8,
      baseHeight: 0.2,
      finCount: 6,
      finThickness: 0.09,
      waveAvg: 1.25,
      waveA: 0.35,
      waveB: 0.4,
      color: 0xe8e8e8,
    },
    paramDefs: [
      { key: 'baseWidth', label: 'Base Width', min: 1, max: 8, step: 0.1, group: 'Dimensions' },
      { key: 'baseDepth', label: 'Base Depth', min: 1, max: 8, step: 0.1, group: 'Dimensions' },
      { key: 'baseHeight', label: 'Base Height', min: 0.05, max: 0.5, step: 0.01, group: 'Dimensions' },
      { key: 'finCount', label: 'Fin Count', min: 2, max: 12, step: 1, group: 'Counts & Spacing' },
      { key: 'finThickness', label: 'Fin Thickness', min: 0.02, max: 0.3, step: 0.01, group: 'Counts & Spacing' },
      { key: 'waveAvg', label: 'Wave Average Height', min: 0.5, max: 3, step: 0.05, group: 'Wave Profile' },
      { key: 'waveA', label: 'Wave Amplitude A', min: 0, max: 1, step: 0.01, group: 'Wave Profile' },
      { key: 'waveB', label: 'Wave Amplitude B', min: 0, max: 1, step: 0.01, group: 'Wave Profile' },
    ],
    partLabel: 'Fin',
  },
  {
    id: 'paralette',
    name: 'Paralette',
    description: 'A-shaped triangular fitness frame with grip tube',
    component: lazy(() => import('./components/Paralette')),
    defaultParams: {
      baseWidth: 5.5,
      triangleHeight: 5.0,
      barThickness: 0.55,
      depth: 0.8,
      gripDiameter: 0.8,
      gripExtension: 0.35,
      footRadius: 0.18,
      footHeight: 0.12,
    },
    paramDefs: [
      { key: 'baseWidth', label: 'Base Width', min: 1, max: 10, step: 0.1, group: 'Triangle' },
      { key: 'triangleHeight', label: 'Triangle Height', min: 2, max: 12, step: 0.1, group: 'Triangle' },
      { key: 'barThickness', label: 'Bar Thickness', min: 0.2, max: 1.5, step: 0.05, group: 'Triangle' },
      { key: 'depth', label: 'Depth', min: 0.3, max: 4, step: 0.1, group: 'Triangle' },
      { key: 'gripDiameter', label: 'Grip Diameter', min: 0.2, max: 2.0, step: 0.05, group: 'Grip' },
      { key: 'gripExtension', label: 'Grip Extension', min: 0, max: 2, step: 0.05, group: 'Grip' },
      { key: 'footRadius', label: 'Foot Radius', min: 0.1, max: 1.5, step: 0.05, group: 'Feet' },
      { key: 'footHeight', label: 'Foot Height', min: 0.1, max: 0.8, step: 0.05, group: 'Feet' },
    ],
    partLabel: 'Part',
  },
  {
    id: 'triangle-infill',
    name: 'Triangle Infill',
    description: 'Triangle with selectable 3D-print infill patterns',
    component: lazy(() => import('./components/TriangleInfill')),
    defaultParams: {
      baseWidth: 5.0,
      triangleHeight: 6.0,
      wallThickness: 0.3,
      depth: 1.0,
      fillPattern: 1,
      patternOrigin: 0,
      cellSize: 0.6,
      infillWallThickness: 0.08,
    },
    paramDefs: [
      { key: 'baseWidth', label: 'Base Width', min: 2, max: 10, step: 0.1, group: 'Triangle' },
      { key: 'triangleHeight', label: 'Height', min: 2, max: 12, step: 0.1, group: 'Triangle' },
      { key: 'wallThickness', label: 'Wall Thickness', min: 0.1, max: 1, step: 0.05, group: 'Triangle' },
      { key: 'depth', label: 'Depth', min: 0.2, max: 3, step: 0.1, group: 'Triangle' },
      {
        key: 'fillPattern', label: 'Fill Pattern', min: 0, max: 2, step: 1, group: 'Infill',
        options: [
          { value: 0, label: 'None' },
          { value: 1, label: 'Honeycomb' },
          { value: 2, label: 'Triangle' },
        ],
      },
      {
        key: 'patternOrigin', label: 'Pattern Origin', min: 0, max: 1, step: 1, group: 'Infill',
        options: [
          { value: 0, label: 'From Bottom' },
          { value: 1, label: 'From Top' },
        ],
      },
      { key: 'cellSize', label: 'Cell Size', min: 0.3, max: 2.0, step: 0.05, group: 'Infill' },
      { key: 'infillWallThickness', label: 'Infill Wall Thickness', min: 0.02, max: 0.3, step: 0.01, group: 'Infill' },
    ],
    partLabel: 'Part',
  },
]
