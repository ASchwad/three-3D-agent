import { Suspense, useState, useRef, useCallback, useEffect } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import * as THREE from 'three'
import { projects, type ProjectParams } from './projects'
import ParameterPanel from './components/ParameterPanel'
import SelectionPanel from './components/SelectionPanel'
import { downloadSTL, downloadGLB } from './lib/export'
import { cn } from './lib/utils'
import type { ProjectHandle, PartOverrides, BevelCapabilities } from './types'

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

function Scene({
  activeProjectId,
  params,
  onParamsChange,
  onSelectionChange,
  handleRef,
}: {
  activeProjectId: string
  params: ProjectParams
  onParamsChange: (p: ProjectParams) => void
  onSelectionChange: (ids: Set<string>) => void
  handleRef: React.MutableRefObject<ProjectHandle | null>
}) {
  const activeProject = projects.find((p) => p.id === activeProjectId)
  const controlsRef = useRef<any>(null)

  return (
    <>
      <ambientLight intensity={0.8} />
      <directionalLight position={[5, 12, 5]} intensity={1.2} castShadow />
      <directionalLight position={[-3, 8, -5]} intensity={0.5} />
      <directionalLight position={[0, 5, 8]} intensity={0.3} />
      <Grid
        args={[20, 20]}
        cellSize={1}
        cellThickness={0.5}
        cellColor="#6e6e6e"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#9d4b4b"
        fadeDistance={30}
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
      <OrbitControls ref={controlsRef} makeDefault />
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [partOverrides, setPartOverrides] = useState<Record<string, PartOverrides>>({})
  const [bevelCapabilities, setBevelCapabilities] = useState<BevelCapabilities>({})
  const handleRef = useRef<ProjectHandle | null>(null)

  const activeParams = paramsMap[activeProjectId] ?? {}
  const activeProject = projects.find((p) => p.id === activeProjectId)

  const onParamsChange = useCallback(
    (newParams: ProjectParams) => {
      setParamsMap((prev) => ({ ...prev, [activeProjectId]: newParams }))
    },
    [activeProjectId]
  )

  const onSelectionChange = useCallback((ids: Set<string>) => {
    setSelectedIds(ids)
    const allOverrides = handleRef.current?.getAllPartOverrides()
    if (allOverrides) {
      setPartOverrides(allOverrides)
    }
    setBevelCapabilities(handleRef.current?.getBevelCapabilities() ?? {})
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
    if (group) downloadSTL(group, activeProject?.id ?? 'model')
  }, [activeProject])

  const onExportGLB = useCallback(async () => {
    const group = handleRef.current?.getGroup()
    if (group) await downloadGLB(group, activeProject?.id ?? 'model')
  }, [activeProject])

  return (
    <div className="w-screen h-screen bg-[#a0a0a0] relative">
      <Canvas shadows camera={{ position: [6, 5, 8], fov: 45 }}>
        <Scene
          activeProjectId={activeProjectId}
          params={activeParams}
          onParamsChange={onParamsChange}
          onSelectionChange={onSelectionChange}
          handleRef={handleRef}
        />
      </Canvas>

      {/* Project Switcher - Left Sidebar */}
      <div className="absolute top-4 left-4 w-56 bg-background/90 backdrop-blur border rounded-lg p-3 z-10">
        <h3 className="font-semibold text-sm mb-2">Projects</h3>
        <div className="space-y-1">
          {projects.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                setActiveProjectId(p.id)
                setSelectedIds(new Set())
                setPartOverrides({})
                setBevelCapabilities({})
              }}
              className={cn(
                'w-full text-left px-3 py-2 rounded text-sm transition-colors',
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

      {/* Parameter Panel - Top Right */}
      {activeProject && (
        <ParameterPanel
          params={activeParams}
          onChange={onParamsChange}
          paramDefs={activeProject.paramDefs}
          onExportSTL={onExportSTL}
          onExportGLB={onExportGLB}
        />
      )}

      {/* Selection Panel - Bottom Right (only when parts selected) */}
      {activeProject && selectedIds.size > 0 && (
        <SelectionPanel
          partLabel={activeProject.partLabel}
          selectedIds={selectedIds}
          partOverrides={partOverrides}
          bevelCapabilities={bevelCapabilities}
          onPartOverridesChange={onPartOverridesChange}
          onDelete={onDelete}
        />
      )}
    </div>
  )
}

export default App
