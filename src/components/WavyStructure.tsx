import { useMemo, useEffect, useCallback, useRef } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { ProjectParams } from '../projects'
import type { PartOverrides, ProjectHandle, PartBaseDimensions } from '../types'
import { usePartInteraction, type PartData } from '../hooks/usePartInteraction'

type FinType = 'base' | 'x' | 'z'

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

/** Parse the numeric index from a fin part id like "xfin-3" */
function finIndex(id: string): number {
  return parseInt(id.split('-')[1], 10) || 0
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

  const initialParts = useMemo((): PartData<FinType>[] => {
    const p: PartData<FinType>[] = [{ id: 'base', type: 'base', overrides: { ...DEFAULT_OVERRIDES } }]
    for (let i = 0; i < finCount; i++) p.push({ id: `xfin-${i}`, type: 'x', overrides: { ...DEFAULT_OVERRIDES } })
    for (let i = 0; i < finCount; i++) p.push({ id: `zfin-${i}`, type: 'z', overrides: { ...DEFAULT_OVERRIDES } })
    return p
  }, [finCount])

  // Bevel propagation: when bevel changes on selected fins, propagate to all fins of same type
  const customUpdateOverrides = useCallback(
    (prev: PartData<FinType>[], ids: Set<string>, partial: Partial<PartOverrides>) => {
      const hasBevelChange = partial.bevelRadius !== undefined || partial.bevelSegments !== undefined
      const updatedTypes = hasBevelChange
        ? new Set(prev.filter((f) => ids.has(f.id)).map((f) => f.type))
        : null
      return prev.map((f) => {
        if (ids.has(f.id)) {
          return { ...f, overrides: { ...f.overrides, ...partial } }
        }
        if (updatedTypes?.has(f.type)) {
          const bevelPatch: Partial<PartOverrides> = {}
          if (partial.bevelRadius !== undefined) bevelPatch.bevelRadius = partial.bevelRadius
          if (partial.bevelSegments !== undefined) bevelPatch.bevelSegments = partial.bevelSegments
          return { ...f, overrides: { ...f.overrides, ...bevelPatch } }
        }
        return f
      })
    },
    [],
  )

  const {
    parts, selectedIds, hoveredId,
    deleteSelected, getGroup, getPartOverrides, updatePartOverrides, getAllPartOverrides,
    onSelect, onHover, onUnhover, onCanvasPointerDown, onCanvasClick,
  } = usePartInteraction<FinType>({
    initialParts,
    modelRef,
    onSelectionChange,
    customUpdateOverrides,
  })

  // Derive bevel from fin overrides (shared per fin type)
  const xFins = parts.filter((f) => f.type === 'x')
  const zFins = parts.filter((f) => f.type === 'z')
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

  const getPartBaseDimensions = useCallback((id: string): PartBaseDimensions | null => {
    const part = parts.find((p) => p.id === id)
    if (!part) return null
    if (part.type === 'base') {
      return { x: baseWidth + 0.12, y: baseHeight, z: baseDepth + 0.12 }
    }
    const geo = part.type === 'x' ? xFinGeo : zFinGeo
    geo.computeBoundingBox()
    const box = geo.boundingBox!
    return { x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z }
  }, [parts, baseWidth, baseHeight, baseDepth, xFinGeo, zFinGeo])

  // Expose handle to parent
  useEffect(() => {
    if (handleRef) {
      handleRef.current = { selectedIds, deleteSelected, getGroup, getPartOverrides, updatePartOverrides, getAllPartOverrides, getPartBaseDimensions }
    }
  }, [handleRef, selectedIds, deleteSelected, getGroup, getPartOverrides, updatePartOverrides, getAllPartOverrides, getPartBaseDimensions])

  const xSpacing = baseDepth / (finCount - 1 || 1)
  const zSpacing = baseWidth / (finCount - 1 || 1)

  return (
    <group ref={groupRef} onPointerDown={onCanvasPointerDown} onClick={onCanvasClick}>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      <group ref={modelRef}>
        {/* Base plate */}
        {parts.some((p) => p.type === 'base') && (() => {
          const baseSelected = selectedIds.has('base')
          const baseHovered = hoveredId === 'base'
          const baseColor = baseSelected ? '#ff6b6b' : baseHovered ? '#a0c4ff' : colorHex
          const baseOv = parts.find((p) => p.id === 'base')?.overrides ?? DEFAULT_OVERRIDES
          return (
            <group scale={[baseOv.scaleX, baseOv.scaleY, baseOv.scaleZ]}>
              <mesh
                position={[0, baseHeight * 0.25, 0]}
                onClick={(e) => onSelect('base', e)}
                onPointerOver={(e) => onHover('base', e)}
                onPointerOut={onUnhover}
              >
                <boxGeometry args={[baseWidth + 0.12, baseHeight * 0.5, baseDepth + 0.12]} />
                <meshStandardMaterial color={baseColor} roughness={roughness} metalness={metalness} />
              </mesh>
              <mesh
                position={[0, baseHeight * 0.75, 0]}
                onClick={(e) => onSelect('base', e)}
                onPointerOver={(e) => onHover('base', e)}
                onPointerOut={onUnhover}
              >
                <boxGeometry args={[baseWidth + 0.04, baseHeight * 0.5, baseDepth + 0.04]} />
                <meshStandardMaterial color={baseColor} roughness={roughness} metalness={metalness} />
              </mesh>
            </group>
          )
        })()}

        {/* Fins */}
        {parts.filter((p) => p.type === 'x' || p.type === 'z').map((fin) => {
          const ov = fin.overrides
          const idx = finIndex(fin.id)
          if (fin.type === 'x') {
            return (
              <WavyFinMesh
                key={fin.id}
                finId={fin.id}
                position={[
                  -baseWidth / 2,
                  baseHeight,
                  -baseDepth / 2 + idx * xSpacing - finThickness / 2,
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
            const xPos = -baseWidth / 2 + idx * zSpacing
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
