import { useMemo, useEffect, useCallback, useRef } from 'react'
import * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { ProjectParams } from '../projects'
import type { PartOverrides, ProjectHandle, PartBaseDimensions } from '../types'
import { usePartInteraction, type PartData } from '../hooks/usePartInteraction'

interface PartData {
  id: string
  type: 'frame'
  overrides: PartOverrides
}

interface ParaletteProps {
  params: ProjectParams
  onParamsChange: (p: ProjectParams) => void
  onSelectionChange?: (ids: Set<string>) => void
  handleRef?: React.MutableRefObject<ProjectHandle | null>
}

const DEFAULT_OVERRIDES: PartOverrides = { scaleX: 1, scaleY: 1, scaleZ: 1, bevelRadius: 0, bevelSegments: 1 }

/**
 * Compute the intersection point of two 2D lines.
 * Line 1: p1 + t * d1
 * Line 2: p2 + s * d2
 * Returns the intersection point, or the midpoint of p1 and p2 if lines are parallel.
 */
function lineLineIntersect(
  p1x: number, p1y: number, d1x: number, d1y: number,
  p2x: number, p2y: number, d2x: number, d2y: number,
): [number, number] {
  const det = d1x * d2y - d1y * d2x
  if (Math.abs(det) < 1e-10) return [(p1x + p2x) / 2, (p1y + p2y) / 2]
  const dx = p2x - p1x
  const dy = p2y - p1y
  const t = (dx * d2y - dy * d2x) / det
  return [p1x + t * d1x, p1y + t * d1y]
}

/**
 * Build a rounded polygon as an array of Vector2 points (CCW winding).
 * At each vertex, a fillet arc of the given radius replaces the sharp corner.
 */
function buildRoundedPolygonPath(
  vertices: { x: number; y: number; r: number }[],
  segments: number = 8,
): THREE.Vector2[] {
  const verts = vertices
  const pts: THREE.Vector2[] = []
  const n = verts.length

  for (let i = 0; i < n; i++) {
    const prev = verts[(i + n - 1) % n]
    const curr = verts[i]
    const next = verts[(i + 1) % n]
    const r = curr.r

    if (r <= 0.001) {
      pts.push(new THREE.Vector2(curr.x, curr.y))
      continue
    }

    // Directions from current vertex to adjacent vertices
    const dpx = prev.x - curr.x
    const dpy = prev.y - curr.y
    const dpLen = Math.sqrt(dpx * dpx + dpy * dpy)
    const dnx = next.x - curr.x
    const dny = next.y - curr.y
    const dnLen = Math.sqrt(dnx * dnx + dny * dny)

    // Normalized directions
    const dpnx = dpx / dpLen
    const dpny = dpy / dpLen
    const dnnx = dnx / dnLen
    const dnny = dny / dnLen

    // Half-angle at vertex (angle between the two edges / 2)
    const dot = dpnx * dnnx + dpny * dnny
    const fullAngle = Math.acos(Math.max(-1, Math.min(1, dot)))
    const halfAngle = fullAngle / 2

    // Clamp fillet radius so tangent points stay on edges
    const maxR = Math.min(dpLen, dnLen) * Math.tan(halfAngle) * 0.9
    const clampedR = Math.min(r, maxR)

    // Tangent distance from vertex along each edge
    const tanDist = clampedR / Math.tan(halfAngle)

    // Tangent points on each edge
    const tpx = curr.x + tanDist * dpnx
    const tpy = curr.y + tanDist * dpny
    const tnx = curr.x + tanDist * dnnx
    const tny = curr.y + tanDist * dnny

    // Fillet center: offset inward along bisector
    const bisx = dpnx + dnnx
    const bisy = dpny + dnny
    const bisLen = Math.sqrt(bisx * bisx + bisy * bisy)
    if (bisLen < 1e-10) {
      pts.push(new THREE.Vector2(curr.x, curr.y))
      continue
    }
    const insetDist = clampedR / Math.sin(halfAngle)
    const centerX = curr.x + (insetDist * bisx) / bisLen
    const centerY = curr.y + (insetDist * bisy) / bisLen

    // Arc angles
    const startAngle = Math.atan2(tpy - centerY, tpx - centerX)
    const endAngle = Math.atan2(tny - centerY, tnx - centerX)

    // For a CCW outer contour, the fillet arc should go CCW (positive angleDiff).
    // At a convex vertex, the arc sweeps from the tangent on the incoming edge
    // to the tangent on the outgoing edge in the CCW direction.
    let angleDiff = endAngle - startAngle
    // Normalize to positive (CCW) direction
    if (angleDiff <= 0) angleDiff += 2 * Math.PI
    // Safety: if angleDiff is close to 2π, the vertex is nearly flat - use 0
    if (angleDiff > Math.PI * 1.95) angleDiff = 0

    for (let s = 0; s <= segments; s++) {
      const t = s / segments
      const angle = startAngle + angleDiff * t
      pts.push(new THREE.Vector2(
        centerX + clampedR * Math.cos(angle),
        centerY + clampedR * Math.sin(angle),
      ))
    }
  }

  return pts
}

export default function Paralette({ params, onSelectionChange, handleRef }: ParaletteProps) {
  const groupRef = useRef<THREE.Group>(null)
  const modelRef = useRef<THREE.Group>(null)

  const W = params.baseWidth
  const H = params.triangleHeight
  const T = params.barThickness
  const depth = params.depth
  const gripDia = params.gripDiameter
  const footR = params.footRadius
  const footH = params.footHeight
  const roughness = 0.5
  const metalness = 0.1

  const [parts, setParts] = useState<PartData[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  useEffect(() => {
    setParts([
      { id: 'frame', type: 'frame', overrides: { ...DEFAULT_OVERRIDES } },
    ])
    setSelectedIds(new Set())
  }, [])

  const deleteSelected = useCallback(() => {
    if (selectedIds.size > 0) {
      setParts(prev => prev.filter(p => !selectedIds.has(p.id)))
      setSelectedIds(new Set())
    }
  }, [selectedIds])

  const getGroup = useCallback(() => modelRef.current, [])
  const getPartOverrides = useCallback(
    (id: string) => parts.find(p => p.id === id)?.overrides, [parts]
  )
  const updatePartOverrides = useCallback((ids: Set<string>, partial: Partial<PartOverrides>) => {
    setParts(prev => prev.map(p => (ids.has(p.id) ? { ...p, overrides: { ...p.overrides, ...partial } } : p)))
  }, [])
  const getAllPartOverrides = useCallback((): Record<string, PartOverrides> => {
    const r: Record<string, PartOverrides> = {}
    for (const p of parts) r[p.id] = p.overrides
    return r
  }, [parts])

  useEffect(() => {
    if (handleRef) {
      handleRef.current = { selectedIds, deleteSelected, getGroup, getPartOverrides, updatePartOverrides, getAllPartOverrides }
    }
  }, [handleRef, selectedIds, deleteSelected, getGroup, getPartOverrides, updatePartOverrides, getAllPartOverrides])

  useEffect(() => { onSelectionChange?.(selectedIds) }, [selectedIds, onSelectionChange])

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
    setSelectedIds(prev => {
      if (isMulti) {
        const next = new Set(prev)
        next.has(id) ? next.delete(id) : next.add(id)
        return next
      }
      return prev.size === 1 && prev.has(id) ? new Set() : new Set([id])
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

  function matColor(id: string) {
    if (selectedIds.has(id)) return '#ff6b6b'
    if (hoveredId === id) return '#a0c4ff'
    return '#4488cc'
  }

  // ── Derived values ──
  const hw = W / 2
  const gripInnerR = gripDia / 2
  // Disc outer radius: directly controlled via parameter
  const discR = params.discRadius
  // Moderate bevel for softened edges matching reference
  const bevelR = Math.min(T, depth) * 0.2

  // ── Frame geometry: ExtrudeGeometry with 2D triangular frame profile ──
  const frameGeo = useMemo(() => {
    try {
      const halfT = T / 2
      const legLen = Math.sqrt(hw * hw + H * H)

      // Edge directions
      const rightLegDx = -hw  // direction from (hw, 0) to (0, H)
      const rightLegDy = H
      const leftLegDx = hw    // direction from (-hw, 0) to (0, H)
      const leftLegDy = H

      // Outward normals for each edge (perpendicular, pointing away from triangle center)
      // Right leg outward normal: rotate direction 90° CW → (H, hw) / legLen
      const rnx = H / legLen
      const rny = hw / legLen
      // Left leg outward normal: rotate direction 90° CCW → (-H, hw) / legLen
      const lnx = -H / legLen
      const lny = hw / legLen
      // Base bar outward normal: pointing down → (0, -1)

      // ── OUTER triangle vertices (offset each edge outward by halfT) ──

      // Base bottom line: y = -halfT (base center is at y=0, shifted down by halfT)
      // Right leg outer line: passes through (hw + halfT*rnx, halfT*rny), direction (-hw, H)
      // Left leg outer line: passes through (-hw + halfT*lnx, halfT*lny), direction (hw, H)

      // Bottom-right outer: intersection of base-bottom and right-leg outer
      const [outerBRx, outerBRy] = lineLineIntersect(
        0, -halfT, 1, 0,  // base bottom: any point on y=-halfT, direction (1,0)
        hw + halfT * rnx, halfT * rny, rightLegDx, rightLegDy,  // right leg outer
      )

      // Bottom-left outer: intersection of base-bottom and left-leg outer
      const [outerBLx, outerBLy] = lineLineIntersect(
        0, -halfT, 1, 0,
        -hw + halfT * lnx, halfT * lny, leftLegDx, leftLegDy,
      )

      // ── INNER triangle vertices (offset each edge inward by halfT) ──

      // Base top line: y = halfT
      // Right leg inner line: offset inward → through (hw - halfT*rnx, -halfT*rny), direction (-hw, H)
      // Left leg inner line: offset inward → through (-hw - halfT*lnx, -halfT*lny), direction (hw, H)

      const [innerBRx, innerBRy] = lineLineIntersect(
        0, halfT, 1, 0,
        hw - halfT * rnx, -halfT * rny, rightLegDx, rightLegDy,
      )

      const [innerBLx, innerBLy] = lineLineIntersect(
        0, halfT, 1, 0,
        -hw - halfT * lnx, -halfT * lny, leftLegDx, leftLegDy,
      )

      const [innerApexX, innerApexYRaw] = lineLineIntersect(
        hw - halfT * rnx, -halfT * rny, rightLegDx, rightLegDy,
        -hw - halfT * lnx, -halfT * lny, leftLegDx, leftLegDy,
      )

      // Clamp inner apex below the grip ring area
      const innerApexY = Math.min(innerApexYRaw, H - discR * 0.8)

      // ── Fillet radii ──
      const innerCornerR = T * 0.5    // Moderate inner corner fillets
      const innerApexR = T * 0.3      // Small inner apex fillet

      // ── Foot vertex positions (integrated into outer contour) ──
      const footBelowBase = footH
      const footWidthExtra = footR * 0.5
      const leftFootX = outerBLx - footBelowBase * (hw / H) - footWidthExtra
      const leftFootY = outerBLy - footBelowBase
      const rightFootX = outerBRx + footBelowBase * (hw / H) + footWidthExtra
      const rightFootY = outerBRy - footBelowBase
      const returnOffset = footR * 2.5
      const leftReturnX = outerBLx + returnOffset
      const leftReturnY = outerBLy
      const rightReturnX = outerBRx - returnOffset
      const rightReturnY = outerBRy

      // ── Build outer contour with explicit disc arc at top ──

      // Helper: line-circle intersection
      function lineCircleHit(
        px: number, py: number, dx: number, dy: number,
        cx: number, cy: number, r: number,
      ): [number, number] | null {
        const ex = px - cx, ey = py - cy
        const a = dx * dx + dy * dy
        const b = 2 * (ex * dx + ey * dy)
        const c = ex * ex + ey * ey - r * r
        const det = b * b - 4 * a * c
        if (det < 0) return null
        const sq = Math.sqrt(det)
        const t1 = (-b - sq) / (2 * a)
        const t2 = (-b + sq) / (2 * a)
        const t = t1 > 0 ? t1 : t2
        return [px + t * dx, py + t * dy]
      }

      // Helper: add a fillet arc at a vertex between two adjacent points
      function addFilletArc(
        pts: THREE.Vector2[],
        prev: [number, number], curr: [number, number], next: [number, number],
        r: number, segs: number,
      ) {
        if (r <= 0.001) { pts.push(new THREE.Vector2(curr[0], curr[1])); return }
        const dpx = prev[0] - curr[0], dpy = prev[1] - curr[1]
        const dnx = next[0] - curr[0], dny = next[1] - curr[1]
        const dpLen = Math.sqrt(dpx * dpx + dpy * dpy)
        const dnLen = Math.sqrt(dnx * dnx + dny * dny)
        const dpnx = dpx / dpLen, dpny = dpy / dpLen
        const dnnx = dnx / dnLen, dnny = dny / dnLen
        const dot = dpnx * dnnx + dpny * dnny
        const fullAngle = Math.acos(Math.max(-1, Math.min(1, dot)))
        const half = fullAngle / 2
        const maxR = Math.min(dpLen, dnLen) * Math.tan(half) * 0.9
        const cr = Math.min(r, maxR)
        const tanD = cr / Math.tan(half)
        const tpx = curr[0] + tanD * dpnx, tpy = curr[1] + tanD * dpny
        const tnx = curr[0] + tanD * dnnx, tny = curr[1] + tanD * dnny
        const bisx = dpnx + dnnx, bisy = dpny + dnny
        const bisLen = Math.sqrt(bisx * bisx + bisy * bisy)
        if (bisLen < 1e-10) { pts.push(new THREE.Vector2(curr[0], curr[1])); return }
        const insetD = cr / Math.sin(half)
        const cx = curr[0] + (insetD * bisx) / bisLen
        const cy = curr[1] + (insetD * bisy) / bisLen
        const sa = Math.atan2(tpy - cy, tpx - cx)
        const ea = Math.atan2(tny - cy, tnx - cx)
        let ad = ea - sa
        if (ad <= 0) ad += 2 * Math.PI
        if (ad > Math.PI * 1.95) ad = 0
        for (let s = 0; s <= segs; s++) {
          const a = sa + ad * (s / segs)
          pts.push(new THREE.Vector2(cx + cr * Math.cos(a), cy + cr * Math.sin(a)))
        }
      }

      // Find where each outer leg intersects the disc circle at (0, H)
      const rightHit = lineCircleHit(
        outerBRx, outerBRy, rightLegDx, rightLegDy, 0, H, discR,
      )
      const leftHit = lineCircleHit(
        outerBLx, outerBLy, leftLegDx, leftLegDy, 0, H, discR,
      )

      // Build outer contour manually (CCW):
      // leftFoot → leftReturn → rightReturn → rightFoot → right leg → disc arc → left leg → close
      const outerPts: THREE.Vector2[] = []
      const lf: [number, number] = [leftFootX, leftFootY]
      const lr: [number, number] = [leftReturnX, leftReturnY]
      const rr: [number, number] = [rightReturnX, rightReturnY]
      const rf: [number, number] = [rightFootX, rightFootY]
      const rh: [number, number] = rightHit ?? [outerBRx, H]
      const lh: [number, number] = leftHit ?? [outerBLx, H]

      // Left foot fillet (between left-leg-down and leftReturn edge)
      addFilletArc(outerPts, lh, lf, lr, footR, 12)
      // leftReturn (sharp, bevel handles it)
      outerPts.push(new THREE.Vector2(lr[0], lr[1]))
      // rightReturn (sharp)
      outerPts.push(new THREE.Vector2(rr[0], rr[1]))
      // Right foot fillet (between rightReturn edge and right-leg-up)
      addFilletArc(outerPts, rr, rf, rh, footR, 12)
      // Right leg up to disc intersection
      outerPts.push(new THREE.Vector2(rh[0], rh[1]))

      // Disc arc: from rightHit to leftHit going CCW over the top
      if (rightHit && leftHit) {
        const rightAngle = Math.atan2(rightHit[1] - H, rightHit[0])
        const leftAngle = Math.atan2(leftHit[1] - H, leftHit[0])
        let arcStart = rightAngle
        let arcEnd = leftAngle
        if (arcEnd <= arcStart) arcEnd += 2 * Math.PI
        const arcSegs = 24
        for (let i = 0; i <= arcSegs; i++) {
          const a = arcStart + (arcEnd - arcStart) * (i / arcSegs)
          outerPts.push(new THREE.Vector2(discR * Math.cos(a), H + discR * Math.sin(a)))
        }
      }

      // Left leg down from disc to leftFoot (shape.closePath() handles the final edge)
      outerPts.push(new THREE.Vector2(lh[0], lh[1]))

      // ── Build inner contour (CCW, will be reversed for hole) ──
      const innerPts = buildRoundedPolygonPath([
        { x: innerBLx, y: innerBLy, r: innerCornerR },
        { x: innerBRx, y: innerBRy, r: innerCornerR },
        { x: innerApexX, y: innerApexY, r: innerApexR },
      ], 10)

      // ── Create the THREE.Shape ──
      const shape = new THREE.Shape()
      if (outerPts.length > 0) {
        shape.moveTo(outerPts[0].x, outerPts[0].y)
        for (let i = 1; i < outerPts.length; i++) {
          shape.lineTo(outerPts[i].x, outerPts[i].y)
        }
        shape.closePath()
      }

      // Inner triangle hole (THREE.js holes must be wound CW = reverse CCW points)
      if (innerPts.length > 0) {
        const innerHole = new THREE.Path()
        const revInner = [...innerPts].reverse()
        innerHole.moveTo(revInner[0].x, revInner[0].y)
        for (let i = 1; i < revInner.length; i++) {
          innerHole.lineTo(revInner[i].x, revInner[i].y)
        }
        innerHole.closePath()
        shape.holes.push(innerHole)
      }

      // Grip bore hole punched through the frame disc
      const gripHole = new THREE.Path()
      gripHole.absarc(0, H, gripInnerR, 0, Math.PI * 2, true)
      shape.holes.push(gripHole)

      // ── Extrude with small bevel for subtle edge rounding ──
      const extrudedGeo = new THREE.ExtrudeGeometry(shape, {
        depth: depth,
        bevelEnabled: true,
        bevelThickness: bevelR,
        bevelSize: bevelR,
        bevelOffset: 0,
        bevelSegments: 3,
      })

      // Center along Z axis.
      // ExtrudeGeometry with bevel spans from z = -bevelR to z = depth + bevelR,
      // so its geometric center is at z = depth/2 (bevel is symmetric, cancels out).
      extrudedGeo.translate(0, 0, -depth / 2)
      extrudedGeo.computeVertexNormals()

      return extrudedGeo
    } catch (err) {
      console.warn('ExtrudeGeometry failed for paralette frame:', err)
      return new THREE.BoxGeometry(W, H, depth)
    }
  }, [W, H, T, depth, hw, gripInnerR, bevelR, footR, footH, discR])

  const getPartBaseDimensions = useCallback((id: string): PartBaseDimensions | null => {
    const part = parts.find((p) => p.id === id)
    if (!part) return null
    const geoMap: Record<string, THREE.BufferGeometry | null> = {
      frame: frameGeo,
      grip: gripTubeGeo,
      'foot-left': footGeo,
      'foot-right': footGeo,
    }
    const geo = geoMap[part.type]
    if (!geo) return null
    geo.computeBoundingBox()
    const box = geo.boundingBox!
    return { x: box.max.x - box.min.x, y: box.max.y - box.min.y, z: box.max.z - box.min.z }
  }, [parts, frameGeo, gripTubeGeo, footGeo])

  // Expose handle to parent
  useEffect(() => {
    if (handleRef) {
      handleRef.current = { selectedIds, deleteSelected, getGroup, getPartOverrides, updatePartOverrides, getAllPartOverrides, getPartBaseDimensions }
    }
  }, [handleRef, selectedIds, deleteSelected, getGroup, getPartOverrides, updatePartOverrides, getAllPartOverrides, getPartBaseDimensions])

  return (
    <group ref={groupRef} onPointerDown={onCanvasPointerDown} onClick={onCanvasClick}>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      <group ref={modelRef} position={[0, -H / 2, 0]}>
        {/* Frame — Extruded flat-plate 2D profile */}
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


      </group>
    </group>
  )
}
