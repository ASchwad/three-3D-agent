import { lazy, type ComponentType } from 'react'

export interface ProjectParams {
  [key: string]: number
}

export interface Project {
  id: string
  name: string
  description: string
  component: ReturnType<typeof lazy<ComponentType<{ params: ProjectParams; onParamsChange: (p: ProjectParams) => void }>>>
  defaultParams: ProjectParams
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
      roughness: 0.4,
      metalness: 0.05,
    },
  },
]
