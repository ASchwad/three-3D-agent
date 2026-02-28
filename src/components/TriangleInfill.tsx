import { useMemo, useEffect, useCallback, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Evaluator, Brush, INTERSECTION } from 'three-bvh-csg'
import type { ProjectParams } from '../projects'
import type { PartOverrides, ProjectHandle, PartBaseDimensions } from '../types'
import { usePartInteraction, type PartData } from '../hooks/usePartInteraction'

type InfillPartType = 'frame' | 'infill'

const PATTERN = { NONE: 0, HONEYCOMB: 1, TRIANGLE: 2 } as const

const DEFAULT_OVERRIDES: PartOverrides = { scaleX: 1, scaleY: 1, scaleZ: 1, bevelRadius: 0.4, bevelSegments: 3 }

const INITIAL_PARTS: PartData<InfillPartType>[] = [
  { id: 'frame', type: 'frame', overrides: { ...DEFAULT_OVERRIDES } },
  { id: 'infill', type: 'infill', overrides: { ...DEFAULT_OVERRIDES } },
]

// ── Geometry helpers ──

function pointInTriangle(px: number, py: number, v0: [number, number], v1: [number, number], v2: [number, number]): boolean {
  const d1 = (px - v1[0]) * (v0[1] - v1[1]) - (v0[0] - v1[0]) * (py - v1[1])
  const d2 = (px - v2[0]) * (v1[1] - v2[1]) - (v1[0] - v2[0]) * (py - v2[1])
  const d3 = (px - v0[0]) * (v2[1] - v0[1]) - (v2[0] - v0[0]) * (py - v0[1])
  const hasNeg = (d1 < 0) || (d2 < 0) || (d3 < 0)
  const hasPos = (d1 > 0) || (d2 > 0) || (d3 > 0)
  return !(hasNeg && hasPos)
}

function getInnerTriVerts(hw: number, H: number, T: number): [number, number][] {
  return [
    [-hw + T / 2, T / 2],
    [hw - T / 2, T / 2],
    [0, H - T / 2],
  ]
}

function createOuterFrame(hw: number, H: number, T: number): THREE.Shape {
  const shape = new THREE.Shape()
  shape.moveTo(-hw - T / 2, -T / 2)
  shape.lineTo(hw + T / 2, -T / 2)
  shape.lineTo(0, H + T / 2)
  shape.closePath()

  const hole = new THREE.Path()
  hole.moveTo(-hw + T / 2, T / 2)
  hole.lineTo(0, H - T / 2)
  hole.lineTo(hw - T / 2, T / 2)
  hole.closePath()
  shape.holes.push(hole)

  return shape
}

function createInnerTriangleSolid(hw: number, H: number, T: number, depth: number, offset: number = 0): THREE.BufferGeometry {
  const verts = getInnerTriVerts(hw, H, T)
  let finalVerts = verts
  if (offset !== 0) {
    const cx = (verts[0][0] + verts[1][0] + verts[2][0]) / 3
    const cy = (verts[0][1] + verts[1][1] + verts[2][1]) / 3
    finalVerts = verts.map((v) => {
      const dx = cx - v[0], dy = cy - v[1]
      const dist = Math.sqrt(dx * dx + dy * dy)
      return [v[0] + dx * (offset / dist), v[1] + dy * (offset / dist)] as [number, number]
    })
  }
  const shape = new THREE.Shape()
  shape.moveTo(finalVerts[0][0], finalVerts[0][1])
  shape.lineTo(finalVerts[1][0], finalVerts[1][1])
  shape.lineTo(finalVerts[2][0], finalVerts[2][1])
  shape.closePath()
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false })
  geo.translate(0, 0, -depth / 2)
  return geo
}

// ── Pattern slab generators ──

function createHoneycombSlab(hw: number, H: number, T: number, cellSize: number, wallThickness: number, depth: number, fromTop: boolean): THREE.BufferGeometry {
  const innerVerts = getInnerTriVerts(hw, H, T)
  const margin = cellSize * 1.5
  const expandedVerts: [number, number][] = (() => {
    const cx = (innerVerts[0][0] + innerVerts[1][0] + innerVerts[2][0]) / 3
    const cy = (innerVerts[0][1] + innerVerts[1][1] + innerVerts[2][1]) / 3
    return innerVerts.map((v) => {
      const dx = v[0] - cx, dy = v[1] - cy
      const dist = Math.sqrt(dx * dx + dy * dy)
      return [v[0] + dx * (margin / dist), v[1] + dy * (margin / dist)] as [number, number]
    })
  })()

  const minX = Math.min(expandedVerts[0][0], expandedVerts[1][0], expandedVerts[2][0])
  const maxX = Math.max(expandedVerts[0][0], expandedVerts[1][0], expandedVerts[2][0])
  const minY = Math.min(expandedVerts[0][1], expandedVerts[1][1], expandedVerts[2][1])
  const maxY = Math.max(expandedVerts[0][1], expandedVerts[1][1], expandedVerts[2][1])

  const shape = new THREE.Shape()
  shape.moveTo(minX, minY)
  shape.lineTo(maxX, minY)
  shape.lineTo(maxX, maxY)
  shape.lineTo(minX, maxY)
  shape.closePath()

  const holeR = cellSize - wallThickness / Math.sqrt(3)
  if (holeR <= 0.01) {
    const geo = new THREE.ExtrudeGeometry(shape, { depth: depth + 0.02, bevelEnabled: false })
    geo.translate(0, 0, -(depth + 0.02) / 2)
    return geo
  }

  const spacingX = Math.sqrt(3) * cellSize
  const spacingY = 1.5 * cellSize
  const anchorY = fromTop ? (H - T / 2) : (T / 2)
  const rowsDown = Math.ceil((anchorY - minY) / spacingY) + 2
  const rowsUp = Math.ceil((maxY - anchorY) / spacingY) + 2
  const colsHalf = Math.ceil((maxX - minX) / spacingX) + 2

  for (let rowIdx = -rowsDown; rowIdx <= rowsUp; rowIdx++) {
    const cy = anchorY + rowIdx * spacingY
    if (cy < minY - cellSize || cy > maxY + cellSize) continue

    const rowParity = ((rowIdx % 2) + 2) % 2
    for (let colIdx = -colsHalf; colIdx <= colsHalf; colIdx++) {
      const cx = colIdx * spacingX + (rowParity === 1 ? spacingX / 2 : 0)
      if (!pointInTriangle(cx, cy, expandedVerts[0], expandedVerts[1], expandedVerts[2])) continue

      const hole = new THREE.Path()
      for (let i = 0; i <= 6; i++) {
        const angle = (Math.PI / 6) + (i * Math.PI) / 3
        const hx = cx + holeR * Math.cos(angle)
        const hy = cy + holeR * Math.sin(angle)
        if (i === 0) hole.moveTo(hx, hy)
        else hole.lineTo(hx, hy)
      }
      hole.closePath()
      shape.holes.push(hole)
    }
  }

  const geo = new THREE.ExtrudeGeometry(shape, { depth: depth + 0.02, bevelEnabled: false })
  geo.translate(0, 0, -(depth + 0.02) / 2)
  return geo
}

function createTriangleSlab(hw: number, H: number, T: number, cellSize: number, wallThickness: number, depth: number, fromTop: boolean): THREE.BufferGeometry {
  const margin = cellSize * 2
  const minX = -hw - margin, maxX = hw + margin
  const minY = -margin, maxY = H + margin
  const slabW = maxX - minX + margin * 2
  const diag = Math.sqrt(slabW ** 2 + (maxY - minY + margin * 2) ** 2)
  const anchorY = fromTop ? (H - T / 2) : (T / 2)
  const slabDepth = depth + 0.02
  const geos: THREE.BufferGeometry[] = []

  const addParallelLines = (theta: number) => {
    const nx = -Math.sin(theta)
    const ny = Math.cos(theta)
    const anchorProj = 0 * nx + anchorY * ny
    for (let d = -diag; d <= diag; d += cellSize) {
      const offset = anchorProj + d
      const box = new THREE.BoxGeometry(diag * 2, wallThickness, slabDepth)
      box.rotateZ(theta)
      box.translate(offset * nx, offset * ny, 0)
      geos.push(box)
    }
  }

  addParallelLines(0)
  addParallelLines(Math.PI / 3)
  addParallelLines(-Math.PI / 3)

  const merged = mergeGeometries(geos)
  for (const g of geos) g.dispose()
  return merged
}

// ── CSG infill generator ──

function generateInfill(
  pattern: number, hw: number, H: number, T: number,
  cellSize: number, wallThickness: number, depth: number, fromTop: boolean,
): THREE.BufferGeometry | null {
  if (pattern === PATTERN.NONE) return null

  let patternGeo: THREE.BufferGeometry
  switch (pattern) {
    case PATTERN.HONEYCOMB:
      patternGeo = createHoneycombSlab(hw, H, T, cellSize, wallThickness, depth, fromTop)
      break
    case PATTERN.TRIANGLE:
      patternGeo = createTriangleSlab(hw, H, T, cellSize, wallThickness, depth, fromTop)
      break
    default:
      return null
  }

  const outset = -(T * 0.3)
  const triangleGeo = createInnerTriangleSolid(hw, H, T, depth, outset)

  try {
    const evaluator = new Evaluator()
    const triangleBrush = new Brush(triangleGeo)
    triangleBrush.updateMatrixWorld()
    const patternBrush = new Brush(patternGeo)
    patternBrush.updateMatrixWorld()

    const result = evaluator.evaluate(triangleBrush, patternBrush, INTERSECTION)
    const resultGeo = result.geometry
    resultGeo.computeVertexNormals()

    triangleGeo.dispose()
    patternGeo.dispose()
    return resultGeo
  } catch {
    triangleGeo.dispose()
    patternGeo.dispose()
    return null
  }
}

// ── Main component ──

export default function TriangleInfill({ params, onSelectionChange, handleRef }: {
  params: ProjectParams
  onParamsChange: (p: ProjectParams) => void
  onSelectionChange?: (ids: Set<string>) => void
  handleRef?: React.MutableRefObject<ProjectHandle | null>
}) {
  const groupRef = useRef<THREE.Group>(null)
  const modelRef = useRef<THREE.Group>(null)

  const W = params.baseWidth
  const H = params.triangleHeight
  const T = params.wallThickness
  const depth = params.depth
  const pattern = params.fillPattern
  const fromTop = params.patternOrigin === 1
  const cellSize = params.cellSize
  const infillWall = params.infillWallThickness
  const roughness = 0.4
  const metalness = 0.1

  const hw = W / 2

  const {
    parts, selectedIds, hoveredId,
    deleteSelected, getGroup, getPartOverrides, updatePartOverrides, getAllPartOverrides,
    onSelect, onHover, onUnhover, onCanvasPointerDown, onCanvasClick,
    matColor, hasPart, partOv,
  } = usePartInteraction<InfillPartType>({
    initialParts: INITIAL_PARTS,
    modelRef,
    onSelectionChange,
  })

  // Frame geometry — bevel controlled by per-part overrides
  const frameBevel = parts.find((p) => p.id === 'frame')?.overrides ?? DEFAULT_OVERRIDES
  const frameGeo = useMemo(() => {
    const shape = createOuterFrame(hw, H, T)
    const bevelSize = frameBevel.bevelRadius * T * 0.25
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth,
      bevelEnabled: frameBevel.bevelRadius > 0,
      bevelThickness: bevelSize,
      bevelSize,
      bevelSegments: frameBevel.bevelSegments,
    })
    geo.translate(0, 0, -depth / 2)
    geo.computeVertexNormals()
    return geo
  }, [hw, H, T, depth, frameBevel.bevelRadius, frameBevel.bevelSegments])

  // Infill geometry via CSG intersection
  const infillGeo = useMemo(() => {
    return generateInfill(pattern, hw, H, T, cellSize, infillWall, depth, fromTop)
  }, [pattern, hw, H, T, cellSize, infillWall, depth, fromTop])

  const getPartBaseDimensions = useCallback((id: string): PartBaseDimensions | null => {
    const part = parts.find((p) => p.id === id)
    if (!part) return null
    const geo = part.type === 'frame' ? frameGeo : infillGeo
    if (!geo) return null
    geo.computeBoundingBox()
    const box = geo.boundingBox!
    return { x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z }
  }, [parts, frameGeo, infillGeo])

  // Expose handle to parent
  useEffect(() => {
    if (handleRef) {
      handleRef.current = { selectedIds, deleteSelected, getGroup, getPartOverrides, updatePartOverrides, getAllPartOverrides, getPartBaseDimensions }
    }
  }, [handleRef, selectedIds, deleteSelected, getGroup, getPartOverrides, updatePartOverrides, getAllPartOverrides, getPartBaseDimensions])

  return (
    <group ref={groupRef} onPointerDown={onCanvasPointerDown} onClick={onCanvasClick}>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      <group ref={modelRef} position={[0, -H / 3, 0]}>
        {/* Outer frame */}
        {hasPart('frame') && (() => {
          const ov = partOv('frame') ?? DEFAULT_OVERRIDES
          return (
            <mesh
              geometry={frameGeo}
              scale={[ov.scaleX, ov.scaleY, ov.scaleZ]}
              onClick={(e) => onSelect('frame', e)}
              onPointerOver={(e) => onHover('frame', e)}
              onPointerOut={onUnhover}
            >
              <meshStandardMaterial color={matColor('frame', '#4488cc')} roughness={roughness} metalness={metalness} />
            </mesh>
          )
        })()}

        {/* Infill */}
        {hasPart('infill') && infillGeo && (() => {
          const ov = partOv('infill') ?? DEFAULT_OVERRIDES
          return (
            <mesh
              geometry={infillGeo}
              scale={[ov.scaleX, ov.scaleY, ov.scaleZ]}
              onClick={(e) => onSelect('infill', e)}
              onPointerOver={(e) => onHover('infill', e)}
              onPointerOut={onUnhover}
            >
              <meshStandardMaterial color={matColor('infill', '#4488cc')} roughness={roughness} metalness={metalness} />
            </mesh>
          )
        })()}
      </group>
    </group>
  )
}
