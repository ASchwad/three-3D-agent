import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { ProjectParams } from '../projects'
import type { PartOverrides, ProjectHandle, BevelCapabilities } from '../types'

interface FinData {
  id: string
  type: 'x' | 'z'
  index: number
  overrides: PartOverrides
}

interface WavyStructureProps {
  params: ProjectParams
  onParamsChange: (p: ProjectParams) => void
  onSelectionChange?: (ids: Set<string>) => void
  handleRef?: React.MutableRefObject<ProjectHandle | null>
}

function waveHeight(x: number, width: number, avg: number, a: number, b: number): number {
  const t = x / width
  return avg + a * Math.cos(4 * Math.PI * t) + b * Math.cos(2 * Math.PI * t)
}

function createWavyFinShape(width: number, avg: number, a: number, b: number): THREE.Shape {
  const shape = new THREE.Shape()
  const segments = 100
  shape.moveTo(0, 0)
  shape.lineTo(0, waveHeight(0, width, avg, a, b))
  for (let i = 1; i <= segments; i++) {
    const x = (i / segments) * width
    const y = waveHeight(x, width, avg, a, b)
    shape.lineTo(x, y)
  }
  shape.lineTo(width, 0)
  shape.closePath()
  return shape
}

const DEFAULT_OVERRIDES: PartOverrides = { scaleX: 1.0, scaleY: 1.0, scaleZ: 1.0, bevelRadius: 0, bevelSegments: 1 }

function WavyFinMesh({
  position,
  rotation,
  scale,
  geometry,
  color,
  roughness,
  metalness,
  finId,
  selected,
  hovered,
  onSelect,
  onHover,
  onUnhover,
}: {
  position: [number, number, number]
  rotation?: [number, number, number]
  scale: [number, number, number]
  geometry: THREE.ExtrudeGeometry
  color: string
  roughness: number
  metalness: number
  finId: string
  selected: boolean
  hovered: boolean
  onSelect: (id: string, e: ThreeEvent<MouseEvent>) => void
  onHover: (id: string, e: ThreeEvent<PointerEvent>) => void
  onUnhover: () => void
}) {
  const matColor = selected ? '#ff6b6b' : hovered ? '#a0c4ff' : color

  return (
    <mesh
      position={position}
      rotation={rotation}
      scale={scale}
      geometry={geometry}
      onClick={(e) => onSelect(finId, e)}
      onPointerOver={(e) => onHover(finId, e)}
      onPointerOut={onUnhover}
    >
      <meshStandardMaterial color={matColor} roughness={roughness} metalness={metalness} />
    </mesh>
  )
}

export default function WavyStructure({ params, onSelectionChange, handleRef }: WavyStructureProps) {
  const groupRef = useRef<THREE.Group>(null)
  const modelRef = useRef<THREE.Group>(null)
  const baseWidth = params.baseWidth
  const baseDepth = params.baseDepth
  const baseHeight = params.baseHeight
  const finCount = Math.round(params.finCount)
  const finThickness = params.finThickness
  const waveAvg = params.waveAvg
  const waveA = params.waveA
  const waveB = params.waveB
  const colorHex = '#' + Math.round(params.color).toString(16).padStart(6, '0')
  const roughness = 0.4
  const metalness = 0.05

  const [fins, setFins] = useState<FinData[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useEffect(() => {
    const newFins: FinData[] = []
    for (let i = 0; i < finCount; i++) newFins.push({ id: `xfin-${i}`, type: 'x', index: i, overrides: { ...DEFAULT_OVERRIDES } })
    for (let i = 0; i < finCount; i++) newFins.push({ id: `zfin-${i}`, type: 'z', index: i, overrides: { ...DEFAULT_OVERRIDES } })
    setFins(newFins)
    setSelectedIds(new Set())
  }, [finCount])

  const deleteSelected = useCallback(() => {
    if (selectedIds.size > 0) {
      setFins((prev) => prev.filter((f) => !selectedIds.has(f.id)))
      setSelectedIds(new Set())
    }
  }, [selectedIds])

  const getGroup = useCallback(() => modelRef.current, [])

  const getPartOverrides = useCallback((id: string): PartOverrides | undefined => {
    return fins.find((f) => f.id === id)?.overrides
  }, [fins])

  const updatePartOverrides = useCallback((ids: Set<string>, partial: Partial<PartOverrides>) => {
    setFins((prev) =>
      prev.map((f) =>
        ids.has(f.id) ? { ...f, overrides: { ...f.overrides, ...partial } } : f
      )
    )
  }, [])

  const getAllPartOverrides = useCallback((): Record<string, PartOverrides> => {
    const result: Record<string, PartOverrides> = {}
    for (const fin of fins) {
      result[fin.id] = fin.overrides
    }
    return result
  }, [fins])

  const getBevelCapabilities = useCallback((): BevelCapabilities => ({}), [])

  // Expose handle to parent
  useEffect(() => {
    if (handleRef) {
      handleRef.current = { selectedIds, deleteSelected, getGroup, getPartOverrides, updatePartOverrides, getAllPartOverrides, getBevelCapabilities }
    }
  }, [handleRef, selectedIds, deleteSelected, getGroup, getPartOverrides, updatePartOverrides, getAllPartOverrides, getBevelCapabilities])

  useEffect(() => {
    onSelectionChange?.(selectedIds)
  }, [selectedIds, onSelectionChange])

  // Delete key handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if ((e.target as HTMLElement)?.tagName === 'INPUT') return
        deleteSelected()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [deleteSelected])

  const onSelect = useCallback((id: string, e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const isMulti = e.nativeEvent.metaKey || e.nativeEvent.ctrlKey
    setSelectedIds((prev) => {
      if (isMulti) {
        const next = new Set(prev)
        if (next.has(id)) {
          next.delete(id)
        } else {
          next.add(id)
        }
        return next
      } else {
        // Plain click: toggle if already sole selection, otherwise select only this
        if (prev.size === 1 && prev.has(id)) {
          return new Set()
        }
        return new Set([id])
      }
    })
  }, [])

  const onHover = useCallback((id: string, e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHoveredId(id)
    document.body.style.cursor = 'pointer'
  }, [])

  const onUnhover = useCallback(() => {
    setHoveredId(null)
    document.body.style.cursor = 'default'
  }, [])

  const onCanvasClick = useCallback(() => {
    setSelectedIds(new Set())
  }, [])

  // Geometries
  const xFinGeo = useMemo(() => {
    const shape = createWavyFinShape(baseWidth, waveAvg, waveA, waveB)
    const geo = new THREE.ExtrudeGeometry(shape, { depth: finThickness, bevelEnabled: false })
    geo.computeVertexNormals()
    return geo
  }, [baseWidth, finThickness, waveAvg, waveA, waveB])

  const zFinGeo = useMemo(() => {
    const shape = createWavyFinShape(baseDepth, waveAvg, waveA, waveB)
    const geo = new THREE.ExtrudeGeometry(shape, { depth: finThickness, bevelEnabled: false })
    geo.computeVertexNormals()
    return geo
  }, [baseDepth, finThickness, waveAvg, waveA, waveB])

  const xSpacing = baseDepth / (finCount - 1 || 1)
  const zSpacing = baseWidth / (finCount - 1 || 1)

  return (
    <group ref={groupRef} onClick={onCanvasClick}>
      {/* Invisible click-detection plane (excluded from export) */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Exportable model content */}
      <group ref={modelRef}>
        {/* Base plate */}
        <mesh position={[0, baseHeight * 0.25, 0]}>
          <boxGeometry args={[baseWidth + 0.12, baseHeight * 0.5, baseDepth + 0.12]} />
          <meshStandardMaterial color={colorHex} roughness={roughness} metalness={metalness} />
        </mesh>
        <mesh position={[0, baseHeight * 0.75, 0]}>
          <boxGeometry args={[baseWidth + 0.04, baseHeight * 0.5, baseDepth + 0.04]} />
          <meshStandardMaterial color={colorHex} roughness={roughness} metalness={metalness} />
        </mesh>

        {/* Fins */}
        {fins.map((fin) => {
          const ov = fin.overrides
          if (fin.type === 'x') {
            return (
              <WavyFinMesh
                key={fin.id}
                finId={fin.id}
                position={[
                  -baseWidth / 2,
                  baseHeight,
                  -baseDepth / 2 + fin.index * xSpacing - finThickness / 2,
                ]}
                scale={[ov.scaleX, ov.scaleY, ov.scaleZ]}
                geometry={xFinGeo}
                color={colorHex}
                roughness={roughness}
                metalness={metalness}
                selected={selectedIds.has(fin.id)}
                hovered={hoveredId === fin.id}
                onSelect={onSelect}
                onHover={onHover}
                onUnhover={onUnhover}
              />
            )
          } else {
            const xPos = -baseWidth / 2 + fin.index * zSpacing
            return (
              <WavyFinMesh
                key={fin.id}
                finId={fin.id}
                position={[xPos - finThickness / 2, baseHeight, baseDepth / 2]}
                rotation={[0, Math.PI / 2, 0]}
                scale={[ov.scaleX, ov.scaleY, ov.scaleZ]}
                geometry={zFinGeo}
                color={colorHex}
                roughness={roughness}
                metalness={metalness}
                selected={selectedIds.has(fin.id)}
                hovered={hoveredId === fin.id}
                onSelect={onSelect}
                onHover={onHover}
                onUnhover={onUnhover}
              />
            )
          }
        })}
      </group>
    </group>
  )
}
