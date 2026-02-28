import { lazy, type ComponentType } from 'react'
import type { ParamDef, ProjectHandle } from './types'

// Reference image imports
import paralettesFront from '../examples/paralettes/front-view.png'
import paralettesSide from '../examples/paralettes/side-view.png'
import paralettesThreeQuarter from '../examples/paralettes/three-quarter-view.png'
import wavyFront from '../examples/project_lid_holder/analysis_front.png'
import wavySide from '../examples/project_lid_holder/analysis_side.png'
import wavyTop from '../examples/project_lid_holder/analysis_top.png'
import wavyPerspective from '../examples/project_lid_holder/analysis_perspective.png'

export interface ProjectParams {
  [key: string]: number
}

export interface ReferenceImage {
  src: string
  label: string
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
  referenceImages?: ReferenceImage[]
}

// All defaultParams are authored in mm. 1 Three.js unit = 1 mm.
export const projects: Project[] = [
  {
    id: 'wavy-structure',
    name: 'Wavy Structure',
    description: 'Parametric wavy fin lattice with dual-cosine wave profile',
    component: lazy(() => import('./components/WavyStructure')),
    defaultParams: {
      baseWidth: 35,
      baseDepth: 28,
      baseHeight: 2,
      finCount: 6,
      finThickness: 0.9,
      waveAvg: 12.5,
      waveA: 3.5,
      waveB: 4,
      color: 0xe8e8e8,
    },
    paramDefs: [
      { key: 'baseWidth', label: 'Base Width', min: 10, max: 80, step: 1, group: 'Dimensions', unitType: 'length' },
      { key: 'baseDepth', label: 'Base Depth', min: 10, max: 80, step: 1, group: 'Dimensions', unitType: 'length' },
      { key: 'baseHeight', label: 'Base Height', min: 0.5, max: 5, step: 0.1, group: 'Dimensions', unitType: 'length' },
      { key: 'finCount', label: 'Fin Count', min: 2, max: 12, step: 1, group: 'Counts & Spacing', unitType: 'count' },
      { key: 'finThickness', label: 'Fin Thickness', min: 0.2, max: 3, step: 0.1, group: 'Counts & Spacing', unitType: 'length' },
      { key: 'waveAvg', label: 'Wave Average Height', min: 5, max: 30, step: 0.5, group: 'Wave Profile', unitType: 'length' },
      { key: 'waveA', label: 'Wave Amplitude A', min: 0, max: 10, step: 0.1, group: 'Wave Profile', unitType: 'length' },
      { key: 'waveB', label: 'Wave Amplitude B', min: 0, max: 10, step: 0.1, group: 'Wave Profile', unitType: 'length' },
    ],
    partLabel: 'Part',
    referenceImages: [
      { src: wavyFront, label: 'Front' },
      { src: wavySide, label: 'Side' },
      { src: wavyTop, label: 'Top' },
      { src: wavyPerspective, label: 'Perspective' },
    ],
  },
  {
    id: 'paralette',
    name: 'Paralette',
    description: 'A-shaped triangular fitness frame with grip tube',
    component: lazy(() => import('./components/Paralette')),
    defaultParams: {
      baseWidth: 55,
      triangleHeight: 50,
      barThickness: 5.5,
      depth: 8,
      gripDiameter: 8,
      gripExtension: 3.5,
      footRadius: 1.8,
      footHeight: 1.2,
    },
    paramDefs: [
      { key: 'baseWidth', label: 'Base Width', min: 10, max: 100, step: 1, group: 'Triangle', unitType: 'length' },
      { key: 'triangleHeight', label: 'Triangle Height', min: 20, max: 120, step: 1, group: 'Triangle', unitType: 'length' },
      { key: 'barThickness', label: 'Bar Thickness', min: 2, max: 15, step: 0.5, group: 'Triangle', unitType: 'length' },
      { key: 'depth', label: 'Depth', min: 3, max: 40, step: 1, group: 'Triangle', unitType: 'length' },
      { key: 'gripDiameter', label: 'Grip Diameter', min: 2, max: 20, step: 0.5, group: 'Grip', unitType: 'length' },
      { key: 'gripExtension', label: 'Grip Extension', min: 0, max: 20, step: 0.5, group: 'Grip', unitType: 'length' },
      { key: 'footRadius', label: 'Foot Radius', min: 1, max: 15, step: 0.5, group: 'Feet', unitType: 'length' },
      { key: 'footHeight', label: 'Foot Height', min: 1, max: 8, step: 0.5, group: 'Feet', unitType: 'length' },
    ],
    partLabel: 'Part',
    referenceImages: [
      { src: paralettesFront, label: 'Front View' },
      { src: paralettesSide, label: 'Side View' },
      { src: paralettesThreeQuarter, label: 'Three-Quarter View' },
    ],
  },
  {
    id: 'triangle-infill',
    name: 'Triangle Infill',
    description: 'Triangle with selectable 3D-print infill patterns',
    component: lazy(() => import('./components/TriangleInfill')),
    defaultParams: {
      baseWidth: 50,
      triangleHeight: 60,
      wallThickness: 3,
      depth: 10,
      fillPattern: 1,
      patternOrigin: 0,
      cellSize: 6,
      infillWallThickness: 0.8,
    },
    paramDefs: [
      { key: 'baseWidth', label: 'Base Width', min: 20, max: 100, step: 1, group: 'Triangle', unitType: 'length' },
      { key: 'triangleHeight', label: 'Height', min: 20, max: 120, step: 1, group: 'Triangle', unitType: 'length' },
      { key: 'wallThickness', label: 'Wall Thickness', min: 1, max: 10, step: 0.5, group: 'Triangle', unitType: 'length' },
      { key: 'depth', label: 'Depth', min: 2, max: 30, step: 1, group: 'Triangle', unitType: 'length' },
      {
        key: 'fillPattern', label: 'Fill Pattern', min: 0, max: 2, step: 1, group: 'Infill', unitType: 'count',
        options: [
          { value: 0, label: 'None' },
          { value: 1, label: 'Honeycomb' },
          { value: 2, label: 'Triangle' },
        ],
      },
      {
        key: 'patternOrigin', label: 'Pattern Origin', min: 0, max: 1, step: 1, group: 'Infill', unitType: 'count',
        options: [
          { value: 0, label: 'From Bottom' },
          { value: 1, label: 'From Top' },
        ],
      },
      { key: 'cellSize', label: 'Cell Size', min: 3, max: 20, step: 0.5, group: 'Infill', unitType: 'length' },
      { key: 'infillWallThickness', label: 'Infill Wall Thickness', min: 0.2, max: 3, step: 0.1, group: 'Infill', unitType: 'length' },
    ],
    partLabel: 'Part',
  },
]
