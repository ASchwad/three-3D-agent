import { useMemo, useState, useEffect, useCallback, useRef } from 'react'
import * as THREE from 'three'
import { Evaluator, Brush, ADDITION, SUBTRACTION } from 'three-bvh-csg'
import { RoundedBoxGeometry } from 'three-stdlib'
import type { ThreeEvent } from '@react-three/fiber'
import type { ProjectParams } from '../projects'
import type { PartOverrides, ProjectHandle, BevelCapabilities } from '../types'

interface PartData {
  id: string
  type: 'frame' | 'grip' | 'foot-left' | 'foot-right'
  overrides: PartOverrides
}

interface ParaletteProps {
  params: ProjectParams
  onParamsChange: (p: ProjectParams) => void
  onSelectionChange?: (ids: Set<string>) => void
  handleRef?: React.MutableRefObject<ProjectHandle | null>
}

const DEFAULT_OVERRIDES: PartOverrides = { scaleX: 1, scaleY: 1, scaleZ: 1, bevelRadius: 0, bevelSegments: 1 }

export default function Paralette({ params, onSelectionChange, handleRef }: ParaletteProps) {
  const groupRef = useRef<THREE.Group>(null)
  const modelRef = useRef<THREE.Group>(null)

  const W = params.baseWidth
  const H = params.triangleHeight
  const T = params.barThickness
  const depth = params.depth
  const gripDia = params.gripDiameter
  const gripExt = params.gripExtension
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
      { id: 'grip', type: 'grip', overrides: { ...DEFAULT_OVERRIDES } },
      { id: 'foot-left', type: 'foot-left', overrides: { ...DEFAULT_OVERRIDES } },
      { id: 'foot-right', type: 'foot-right', overrides: { ...DEFAULT_OVERRIDES } },
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

  const getBevelCapabilities = useCallback((): BevelCapabilities => ({}), [])

  useEffect(() => {
    if (handleRef) {
      handleRef.current = { selectedIds, deleteSelected, getGroup, getPartOverrides, updatePartOverrides, getAllPartOverrides, getBevelCapabilities }
    }
  }, [handleRef, selectedIds, deleteSelected, getGroup, getPartOverrides, updatePartOverrides, getAllPartOverrides, getBevelCapabilities])

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

  const onCanvasClick = useCallback(() => setSelectedIds(new Set()), [])

  function matColor(id: string) {
    if (selectedIds.has(id)) return '#ff6b6b'
    if (hoveredId === id) return '#a0c4ff'
    return '#4488cc'
  }

  // ── Derived values ──
  const hw = W / 2
  const gripInnerR = gripDia / 2
  // Grip outer radius: wall = T*0.4, outer ≈ inner + 0.4T
  // Reference analysis: outer radius ≈ 1.2x T, inner ≈ 0.73x T → wall ≈ 0.47T
  const gripOuterR = gripDia / 2 + T * 0.4
  // Near-max corner radius for tube-like bar cross-sections
  const cornerR = T * 0.48
  const legLength = Math.sqrt(hw * hw + H * H)
  const legAngle = Math.atan2(H, hw)

  // ── Frame geometry (CSG: rounded bars + integrated grip ring - grip hole) ──
  const frameGeo = useMemo(() => {
    try {
      const evaluator = new Evaluator()
      const segs = 6

      // Extend legs past apex so they overlap well inside the grip ring
      const legExt = gripOuterR * 0.9
      const extLegLen = legLength + legExt
      const shiftX = (legExt / 2) * (hw / legLength)
      const shiftY = (legExt / 2) * (H / legLength)

      // Base bar — horizontal, centered at origin
      const baseBrush = new Brush(new RoundedBoxGeometry(W, T, depth, segs, cornerR))
      baseBrush.updateMatrixWorld()

      // Left leg — from (-hw, 0) toward and past (0, H)
      const leftLegBrush = new Brush(new RoundedBoxGeometry(extLegLen, T, depth, segs, cornerR))
      leftLegBrush.position.set(-hw / 2 + shiftX, H / 2 + shiftY, 0)
      leftLegBrush.rotation.set(0, 0, legAngle)
      leftLegBrush.updateMatrixWorld()

      let result = evaluator.evaluate(baseBrush, leftLegBrush, ADDITION)
      result.updateMatrixWorld()

      // Right leg — from (hw, 0) toward and past (0, H)
      const rightLegBrush = new Brush(new RoundedBoxGeometry(extLegLen, T, depth, segs, cornerR))
      rightLegBrush.position.set(hw / 2 - shiftX, H / 2 + shiftY, 0)
      rightLegBrush.rotation.set(0, 0, Math.PI - legAngle)
      rightLegBrush.updateMatrixWorld()

      result = evaluator.evaluate(result, rightLegBrush, ADDITION)
      result.updateMatrixWorld()

      // Apex cap — solid cylinder at top, integrated into the frame (height = frame depth)
      // This creates the grip ring visible from the front view
      const capBrush = new Brush(new THREE.CylinderGeometry(gripOuterR, gripOuterR, depth + 0.01, 32))
      capBrush.position.set(0, H, 0)
      capBrush.rotation.set(Math.PI / 2, 0, 0)
      capBrush.updateMatrixWorld()

      result = evaluator.evaluate(result, capBrush, ADDITION)
      result.updateMatrixWorld()

      // Grip hole — subtract cylinder through the ring
      const holeBrush = new Brush(new THREE.CylinderGeometry(gripInnerR, gripInnerR, depth * 3, 32))
      holeBrush.position.set(0, H, 0)
      holeBrush.rotation.set(Math.PI / 2, 0, 0)
      holeBrush.updateMatrixWorld()

      result = evaluator.evaluate(result, holeBrush, SUBTRACTION)

      const finalGeo = result.geometry
      finalGeo.groups.length = 0
      finalGeo.computeVertexNormals()
      return finalGeo
    } catch (err) {
      console.warn('CSG evaluation failed for paralette frame:', err)
      const geo = new THREE.BoxGeometry(W, H, depth)
      return geo
    }
  }, [W, H, T, depth, hw, legLength, legAngle, cornerR, gripOuterR, gripInnerR])

  // ── Grip tube (hollow cylinder extending along Z at apex) ──
  // Outer radius is slightly smaller than the CSG apex cap so the tube
  // hides behind the frame within the frame depth — only the extensions
  // beyond the frame are visible, avoiding z-fighting.
  const gripTubeGeo = useMemo(() => {
    const totalLen = depth + gripExt * 2
    const tubeOuterR = gripOuterR - 0.005
    const points: THREE.Vector2[] = [
      new THREE.Vector2(gripInnerR, -totalLen / 2),
      new THREE.Vector2(tubeOuterR, -totalLen / 2),
      new THREE.Vector2(tubeOuterR, totalLen / 2),
      new THREE.Vector2(gripInnerR, totalLen / 2),
    ]
    const geo = new THREE.LatheGeometry(points, 32)
    geo.computeVertexNormals()
    return geo
  }, [gripOuterR, gripInnerR, depth, gripExt])

  // ── Foot geometry: capsule along Z (depth direction) ──
  const footGeo = useMemo(() => {
    const geo = new THREE.CapsuleGeometry(footR, depth * 0.7, 8, 16)
    geo.rotateX(Math.PI / 2)
    geo.computeVertexNormals()
    return geo
  }, [footR, depth])

  const hasPart = (type: string) => parts.some(p => p.type === type)
  const partOv = (type: string) => parts.find(p => p.type === type)?.overrides ?? DEFAULT_OVERRIDES

  return (
    <group ref={groupRef} onClick={onCanvasClick}>
      <mesh position={[0, -0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[20, 20]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      <group ref={modelRef} position={[0, -H / 2, 0]}>
        {/* Frame — CSG union of rounded bars with grip hole */}
        {hasPart('frame') && (() => {
          const ov = partOv('frame')
          return (
            <mesh
              geometry={frameGeo}
              scale={[ov.scaleX, ov.scaleY, ov.scaleZ]}
              onClick={e => onSelect('frame', e)}
              onPointerOver={e => onHover('frame', e)}
              onPointerOut={onUnhover}
            >
              <meshStandardMaterial color={matColor('frame')} roughness={roughness} metalness={metalness} />
            </mesh>
          )
        })()}

        {/* Grip tube at apex */}
        {hasPart('grip') && (() => {
          const ov = partOv('grip')
          return (
            <mesh
              geometry={gripTubeGeo}
              position={[0, H, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              scale={[ov.scaleX, ov.scaleY, ov.scaleZ]}
              onClick={e => onSelect('grip', e)}
              onPointerOver={e => onHover('grip', e)}
              onPointerOut={onUnhover}
            >
              <meshStandardMaterial color={matColor('grip')} roughness={roughness} metalness={metalness} />
            </mesh>
          )
        })()}

        {/* Left foot — capsule along depth at bottom-left corner */}
        {hasPart('foot-left') && (() => {
          const ov = partOv('foot-left')
          return (
            <mesh
              geometry={footGeo}
              position={[-hw, -T / 2 + footR * 0.1, 0]}
              scale={[ov.scaleX, footH / footR * ov.scaleY, ov.scaleZ]}
              onClick={e => onSelect('foot-left', e)}
              onPointerOver={e => onHover('foot-left', e)}
              onPointerOut={onUnhover}
            >
              <meshStandardMaterial color={matColor('foot-left')} roughness={roughness} metalness={metalness} />
            </mesh>
          )
        })()}

        {/* Right foot — capsule along depth at bottom-right corner */}
        {hasPart('foot-right') && (() => {
          const ov = partOv('foot-right')
          return (
            <mesh
              geometry={footGeo}
              position={[hw, -T / 2 + footR * 0.1, 0]}
              scale={[ov.scaleX, footH / footR * ov.scaleY, ov.scaleZ]}
              onClick={e => onSelect('foot-right', e)}
              onPointerOver={e => onHover('foot-right', e)}
              onPointerOut={onUnhover}
            >
              <meshStandardMaterial color={matColor('foot-right')} roughness={roughness} metalness={metalness} />
            </mesh>
          )
        })()}
      </group>
    </group>
  )
}
