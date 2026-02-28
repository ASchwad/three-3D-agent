import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { ProjectParams } from '../projects'
import type { PartOverrides, ProjectHandle } from '../types'

interface PartData {
  id: string
  type: 'base' | 'x' | 'z'
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

  const [parts, setParts] = useState<PartData[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useEffect(() => {
    const newParts: PartData[] = [
      { id: 'base', type: 'base', index: 0, overrides: { ...DEFAULT_OVERRIDES } },
    ]
    for (let i = 0; i < finCount; i++) newParts.push({ id: `xfin-${i}`, type: 'x', index: i, overrides: { ...DEFAULT_OVERRIDES } })
    for (let i = 0; i < finCount; i++) newParts.push({ id: `zfin-${i}`, type: 'z', index: i, overrides: { ...DEFAULT_OVERRIDES } })
    setParts(newParts)
    setSelectedIds(new Set())
  }, [finCount])

  const deleteSelected = useCallback(() => {
    if (selectedIds.size > 0) {
      setParts((prev) => prev.filter((f) => !selectedIds.has(f.id)))
      setSelectedIds(new Set())
    }
  }, [selectedIds])

  const getGroup = useCallback(() => modelRef.current, [])

  const getPartOverrides = useCallback((id: string): PartOverrides | undefined => {
    return parts.find((f) => f.id === id)?.overrides
  }, [parts])

  const updatePartOverrides = useCallback((ids: Set<string>, partial: Partial<PartOverrides>) => {
    const hasBevelChange = partial.bevelRadius !== undefined || partial.bevelSegments !== undefined
    setParts((prev) => {
      // Find which fin types are being updated
      const updatedTypes = hasBevelChange
        ? new Set(prev.filter(f => ids.has(f.id)).map(f => f.type))
        : null
      return prev.map((f) => {
        if (ids.has(f.id)) {
          return { ...f, overrides: { ...f.overrides, ...partial } }
        }
        // Propagate bevel changes to all fins of the same type (geometry is shared)
        if (updatedTypes?.has(f.type)) {
          const bevelPatch: Partial<PartOverrides> = {}
          if (partial.bevelRadius !== undefined) bevelPatch.bevelRadius = partial.bevelRadius
          if (partial.bevelSegments !== undefined) bevelPatch.bevelSegments = partial.bevelSegments
          return { ...f, overrides: { ...f.overrides, ...bevelPatch } }
        }
        return f
      })
    })
  }, [])

  const getAllPartOverrides = useCallback((): Record<string, PartOverrides> => {
    const result: Record<string, PartOverrides> = {}
    for (const p of parts) {
      result[p.id] = p.overrides
    }
    return result
  }, [parts])

  // Expose handle to parent
  useEffect(() => {
    if (handleRef) {
      handleRef.current = { selectedIds, deleteSelected, getGroup, getPartOverrides, updatePartOverrides, getAllPartOverrides }
    }
  }, [handleRef, selectedIds, deleteSelected, getGroup, getPartOverrides, updatePartOverrides, getAllPartOverrides])

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

  const pointerDownPos = useRef<{ x: number; y: number } | null>(null)
  const onCanvasPointerDown = useCallback((e: ThreeEvent<PointerEvent>) => {
    pointerDownPos.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }
  }, [])
  const onCanvasClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (pointerDownPos.current) {
      const dx = e.nativeEvent.clientX - pointerDownPos.current.x
      const dy = e.nativeEvent.clientY - pointerDownPos.current.y
      if (dx * dx + dy * dy > 25) return
    }
    setSelectedIds(new Set())
  }, [])

  // Derive bevel from fin overrides (shared per fin type)
  const xFins = parts.filter(f => f.type === 'x')
  const zFins = parts.filter(f => f.type === 'z')
  const xBevelRadius = xFins.length > 0 ? xFins[0].overrides.bevelRadius : 0
  const xBevelSegments = xFins.length > 0 ? xFins[0].overrides.bevelSegments : 1
  const zBevelRadius = zFins.length > 0 ? zFins[0].overrides.bevelRadius : 0
  const zBevelSegments = zFins.length > 0 ? zFins[0].overrides.bevelSegments : 1

  // Geometries
  const xFinGeo = useMemo(() => {
    const shape = createWavyFinShape(baseWidth, waveAvg, waveA, waveB)
    const bevelSize = xBevelRadius * finThickness * 0.5
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: finThickness,
      bevelEnabled: xBevelRadius > 0,
      bevelThickness: bevelSize,
      bevelSize,
      bevelSegments: xBevelSegments,
    })
    geo.computeVertexNormals()
    return geo
  }, [baseWidth, finThickness, waveAvg, waveA, waveB, xBevelRadius, xBevelSegments])

  const zFinGeo = useMemo(() => {
    const shape = createWavyFinShape(baseDepth, waveAvg, waveA, waveB)
    const bevelSize = zBevelRadius * finThickness * 0.5
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: finThickness,
      bevelEnabled: zBevelRadius > 0,
      bevelThickness: bevelSize,
      bevelSize,
      bevelSegments: zBevelSegments,
    })
    geo.computeVertexNormals()
    return geo
  }, [baseDepth, finThickness, waveAvg, waveA, waveB, zBevelRadius, zBevelSegments])

  const xSpacing = baseDepth / (finCount - 1 || 1)
  const zSpacing = baseWidth / (finCount - 1 || 1)

  return (
    <group ref={groupRef} onPointerDown={onCanvasPointerDown} onClick={onCanvasClick}>
      {/* Invisible click-detection plane (excluded from export) */}
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Exportable model content */}
      <group ref={modelRef}>
        {/* Base plate */}
        {parts.some(p => p.type === 'base') && (() => {
          const baseSelected = selectedIds.has('base')
          const baseHovered = hoveredId === 'base'
          const baseColor = baseSelected ? '#ff6b6b' : baseHovered ? '#a0c4ff' : colorHex
          const baseOv = parts.find(p => p.id === 'base')?.overrides ?? DEFAULT_OVERRIDES
          return (
            <group scale={[baseOv.scaleX, baseOv.scaleY, baseOv.scaleZ]}>
              <mesh
                position={[0, baseHeight * 0.25, 0]}
                onClick={e => onSelect('base', e)}
                onPointerOver={e => onHover('base', e)}
                onPointerOut={onUnhover}
              >
                <boxGeometry args={[baseWidth + 0.12, baseHeight * 0.5, baseDepth + 0.12]} />
                <meshStandardMaterial color={baseColor} roughness={roughness} metalness={metalness} />
              </mesh>
              <mesh
                position={[0, baseHeight * 0.75, 0]}
                onClick={e => onSelect('base', e)}
                onPointerOver={e => onHover('base', e)}
                onPointerOut={onUnhover}
              >
                <boxGeometry args={[baseWidth + 0.04, baseHeight * 0.5, baseDepth + 0.04]} />
                <meshStandardMaterial color={baseColor} roughness={roughness} metalness={metalness} />
              </mesh>
            </group>
          )
        })()}

        {/* Fins */}
        {parts.filter(p => p.type === 'x' || p.type === 'z').map((fin) => {
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
