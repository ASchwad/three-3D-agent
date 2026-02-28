import { Suspense, useState, useRef, useCallback, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import * as THREE from 'three'
import { projects, type ProjectParams } from './projects'
import ParameterPanel from './components/ParameterPanel'
import SelectionPanel from './components/SelectionPanel'
import { downloadSTL, downloadGLB } from './lib/export'
import { cn } from './lib/utils'
import { Orbit } from 'lucide-react'
import type { ProjectHandle, PartOverrides } from './types'
import { convertParams, type UnitSystem } from './lib/units'

function CameraAPI({
  handleRef,
  controlsRef,
}: {
  handleRef: React.MutableRefObject<ProjectHandle | null>
  controlsRef: React.MutableRefObject<any>
}) {
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    ;(window as any).__three3d = {
      setCameraView: (viewName: string) => {
        const group = handleRef.current?.getGroup()
        if (!group) return false

        const box = new THREE.Box3().setFromObject(group)
        const center = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        const maxDim = Math.max(size.x, size.y, size.z)
        const dist = maxDim * 2.5

        const positions: Record<string, [number, number, number]> = {
          front: [center.x, center.y, center.z + dist],
          back: [center.x, center.y, center.z - dist],
          right: [center.x + dist, center.y, center.z],
          left: [center.x - dist, center.y, center.z],
          top: [center.x, center.y + dist, center.z + 0.001],
          perspective: [
            center.x + dist * 0.7,
            center.y + dist * 0.5,
            center.z + dist * 0.7,
          ],
        }

        const pos = positions[viewName]
        if (!pos) return false

        camera.position.set(pos[0], pos[1], pos[2])
        camera.lookAt(center)

        if (controlsRef.current) {
          controlsRef.current.target.copy(center)
          controlsRef.current.update()
        }

        gl.render(scene, camera)
        return true
      },

      setCameraPosition: (
        x: number, y: number, z: number,
        tx = 0, ty = 0, tz = 0,
      ) => {
        camera.position.set(x, y, z)
        const target = new THREE.Vector3(tx, ty, tz)
        camera.lookAt(target)

        if (controlsRef.current) {
          controlsRef.current.target.copy(target)
          controlsRef.current.update()
        }

        gl.render(scene, camera)
        return true
      },

      hideUI: () => {
        const root = document.querySelector('.relative')
        if (!root) return
        Array.from(root.children).forEach((child) => {
          const el = child as HTMLElement
          if (el.tagName.toLowerCase() !== 'canvas' && !el.querySelector('canvas')) {
            el.dataset.wasVisible = el.style.display
            el.style.display = 'none'
          }
        })
      },

      showUI: () => {
        const root = document.querySelector('.relative')
        if (!root) return
        Array.from(root.children).forEach((child) => {
          const el = child as HTMLElement
          if (el.dataset.wasVisible !== undefined) {
            el.style.display = el.dataset.wasVisible
            delete el.dataset.wasVisible
          }
        })
      },
    }

    return () => {
      delete (window as any).__three3d
    }
  }, [camera, gl, scene, handleRef, controlsRef])

  return null
}

export type LightingMode = 'default' | 'edge' | 'studio' | 'dramatic'

function Lighting({ mode }: { mode: LightingMode }) {
  switch (mode) {
    case 'edge':
      return (
        <>
          <ambientLight intensity={0.2} />
          <directionalLight position={[10, 20, 5]} intensity={2.5} castShadow />
        </>
      )
    case 'studio':
      return (
        <>
          <ambientLight intensity={0.4} />
          <directionalLight position={[50, 80, 30]} intensity={1.5} castShadow />
          <directionalLight position={[-40, 40, -20]} intensity={0.6} />
          <directionalLight position={[0, 30, -80]} intensity={0.8} />
        </>
      )
    case 'dramatic':
      return (
        <>
          <ambientLight intensity={0.1} />
          <spotLight position={[0, 150, 0]} intensity={3} angle={0.5} penumbra={0.5} castShadow />
          <directionalLight position={[-60, 20, -30]} intensity={0.6} color="#6688ff" />
        </>
      )
    default:
      return (
        <>
          <ambientLight intensity={0.8} />
          <directionalLight position={[50, 120, 50]} intensity={1.2} castShadow />
          <directionalLight position={[-30, 80, -50]} intensity={0.5} />
          <directionalLight position={[0, 50, 80]} intensity={0.3} />
        </>
      )
  }
}

function Scene({
  activeProjectId,
  params,
  onParamsChange,
  onSelectionChange,
  handleRef,
  lightingMode,
  autoRotate,
}: {
  activeProjectId: string
  params: ProjectParams
  onParamsChange: (p: ProjectParams) => void
  onSelectionChange: (ids: Set<string>) => void
  handleRef: React.MutableRefObject<ProjectHandle | null>
  lightingMode: LightingMode
  autoRotate: boolean
}) {
  const activeProject = projects.find((p) => p.id === activeProjectId)
  const controlsRef = useRef<any>(null)

  return (
    <>
      <Lighting mode={lightingMode} />
      <Grid
        args={[200, 200]}
        cellSize={10}
        cellThickness={0.5}
        cellColor="#6e6e6e"
        sectionSize={50}
        sectionThickness={1}
        sectionColor="#9d4b4b"
        fadeDistance={300}
        infiniteGrid
      />
      <Suspense fallback={null}>
        {activeProject && (
          <activeProject.component
            params={params}
            onParamsChange={onParamsChange}
            onSelectionChange={onSelectionChange}
            handleRef={handleRef}
          />
        )}
      </Suspense>
      <CameraAPI handleRef={handleRef} controlsRef={controlsRef} />
      <OrbitControls ref={controlsRef} makeDefault autoRotate={autoRotate} autoRotateSpeed={1.5} />
    </>
  )
}

function App() {
  const [activeProjectId, setActiveProjectId] = useState(projects[0]?.id ?? '')
  const [paramsMap, setParamsMap] = useState<Record<string, ProjectParams>>(() => {
    const map: Record<string, ProjectParams> = {}
    for (const p of projects) {
      map[p.id] = { ...p.defaultParams }
    }
    return map
  })
  const [unit, setUnit] = useState<UnitSystem>('mm')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [lightingMode, setLightingMode] = useState<LightingMode>('default')
  const [autoRotate, setAutoRotate] = useState(false)
  const [projectsOpen, setProjectsOpen] = useState(false)
  const [partOverrides, setPartOverrides] = useState<Record<string, PartOverrides>>({})
  const handleRef = useRef<ProjectHandle | null>(null)

  const activeParams = paramsMap[activeProjectId] ?? {}
  const activeProject = projects.find((p) => p.id === activeProjectId)

  const onParamsChange = useCallback(
    (newParams: ProjectParams) => {
      setParamsMap((prev) => ({ ...prev, [activeProjectId]: newParams }))
    },
    [activeProjectId]
  )

  const onUnitChange = useCallback(
    (newUnit: UnitSystem) => {
      if (newUnit === unit) return
      // Convert all project params from current unit to new unit
      setParamsMap((prev) => {
        const next = { ...prev }
        for (const project of projects) {
          if (next[project.id]) {
            next[project.id] = convertParams(next[project.id], project.paramDefs, unit, newUnit)
          }
        }
        return next
      })
      setUnit(newUnit)
    },
    [unit]
  )

  const onSelectionChange = useCallback((ids: Set<string>) => {
    setSelectedIds(ids)
    const allOverrides = handleRef.current?.getAllPartOverrides()
    if (allOverrides) {
      setPartOverrides(allOverrides)
    }
  }, [])

  const onPartOverridesChange = useCallback((ids: Set<string>, partial: Partial<PartOverrides>) => {
    handleRef.current?.updatePartOverrides(ids, partial)
    const allOverrides = handleRef.current?.getAllPartOverrides()
    if (allOverrides) {
      setPartOverrides(allOverrides)
    }
  }, [])

  const onDelete = useCallback(() => {
    handleRef.current?.deleteSelected()
  }, [])

  const onExportSTL = useCallback(() => {
    const group = handleRef.current?.getGroup()
    if (group) downloadSTL(group, activeProject?.id ?? 'model', unit)
  }, [activeProject, unit])

  const onExportGLB = useCallback(async () => {
    const group = handleRef.current?.getGroup()
    if (group) await downloadGLB(group, activeProject?.id ?? 'model', unit)
  }, [activeProject, unit])

  return (
    <div className="w-screen h-screen bg-[#2a2a2a] relative">
      <Canvas shadows camera={{ position: [60, 50, 80], fov: 45 }}>
        <Scene
          activeProjectId={activeProjectId}
          params={activeParams}
          onParamsChange={onParamsChange}
          onSelectionChange={onSelectionChange}
          handleRef={handleRef}
          lightingMode={lightingMode}
          autoRotate={autoRotate}
        />
      </Canvas>

      {/* Project Switcher - Top Left, visible on hover */}
      <div
        className="absolute top-4 left-4 z-20"
        onMouseLeave={() => setProjectsOpen(false)}
      >
        <div
          className="bg-background/90 backdrop-blur border rounded-xl px-4 py-2 cursor-default"
          onMouseEnter={() => setProjectsOpen(true)}
        >
          <span className="text-xs text-muted-foreground uppercase tracking-widest"><span className="font-medium">Projects</span> <span className="text-muted-foreground/50">/</span> <span className="font-semibold text-foreground">{activeProject?.name ?? 'Project'}</span></span>
        </div>
        {projectsOpen && (
          <div className="mt-1 w-56 bg-background/90 backdrop-blur border rounded-xl p-3 animate-in fade-in duration-150">
            <div className="space-y-1">
              {projects.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    setActiveProjectId(p.id)
                    setSelectedIds(new Set())
                    setPartOverrides({})
                    setProjectsOpen(false)
                  }}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg text-sm transition-colors',
                    activeProjectId === p.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  )}
                >
                  <div className="font-medium">{p.name}</div>
                  <div
                    className={cn(
                      'text-xs',
                      activeProjectId === p.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    )}
                  >
                    {p.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Parameter Panel - Top Right */}
      {activeProject && (
        <ParameterPanel
          params={activeParams}
          onChange={onParamsChange}
          paramDefs={activeProject.paramDefs}
          onExportSTL={onExportSTL}
          onExportGLB={onExportGLB}
          unit={unit}
          onUnitChange={onUnitChange}
          referenceImages={activeProject.referenceImages}
        />
      )}

      {/* Lighting Presets & Rotate - Bottom Left */}
      <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur border rounded-lg p-2 z-10 flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground px-1">Scene</span>
        <div className="flex gap-1 items-center">
        {(['default', 'edge', 'studio', 'dramatic'] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setLightingMode(mode)}
            className={cn(
              'px-3 py-1.5 rounded text-xs font-medium capitalize transition-colors',
              lightingMode === mode
                ? 'bg-primary text-primary-foreground'
                : 'hover:bg-muted'
            )}
          >
            {mode}
          </button>
        ))}
        <div className="w-px h-5 bg-border mx-1" />
        <button
          onClick={() => setAutoRotate((r) => !r)}
          className={cn(
            'px-3 py-1.5 rounded text-xs font-medium transition-colors',
            autoRotate
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted'
          )}
        >
          <Orbit className="size-3.5" />
        </button>
        </div>
      </div>

      {/* Selection Panel - Bottom Right (only when parts selected) */}
      {activeProject && selectedIds.size > 0 && (
        <SelectionPanel
          partLabel={activeProject.partLabel}
          selectedIds={selectedIds}
          partOverrides={partOverrides}
          onPartOverridesChange={onPartOverridesChange}
          onDelete={onDelete}
          handleRef={handleRef}
          unit={unit}
        />
      )}
    </div>
  )
}

export default App
