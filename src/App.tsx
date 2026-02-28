import { Suspense, useState, useRef, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Grid } from '@react-three/drei'
import { projects, type ProjectParams } from './projects'
import ParameterPanel from './components/ParameterPanel'
import { downloadSTL, downloadGLB } from './lib/export'
import { cn } from './lib/utils'
import type { WavyStructureHandle } from './components/WavyStructure'

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
  onSelectionChange: (id: string | null) => void
  handleRef: React.MutableRefObject<WavyStructureHandle | null>
}) {
  const activeProject = projects.find((p) => p.id === activeProjectId)

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
      <OrbitControls makeDefault />
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
  const [selectedFinId, setSelectedFinId] = useState<string | null>(null)
  const handleRef = useRef<WavyStructureHandle | null>(null)

  const activeParams = paramsMap[activeProjectId] ?? {}

  const onParamsChange = useCallback(
    (newParams: ProjectParams) => {
      setParamsMap((prev) => ({ ...prev, [activeProjectId]: newParams }))
    },
    [activeProjectId]
  )

  const onSelectionChange = useCallback((id: string | null) => {
    setSelectedFinId(id)
  }, [])

  const onDelete = useCallback(() => {
    handleRef.current?.deleteFin()
  }, [])

  const activeProject = projects.find((p) => p.id === activeProjectId)

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
      <Canvas shadows camera={{ position: [4, 3.5, 4], fov: 45 }}>
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
                setSelectedFinId(null)
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

      {/* Parameter Panel - Right Side */}
      <ParameterPanel
        params={activeParams}
        onChange={onParamsChange}
        selectedFinId={selectedFinId}
        onDelete={onDelete}
        onExportSTL={onExportSTL}
        onExportGLB={onExportGLB}
      />
    </div>
  )
}

export default App
