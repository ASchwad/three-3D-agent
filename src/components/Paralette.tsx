import { useMemo, useEffect, useCallback, useRef } from 'react'
import * as THREE from 'three'
import { Evaluator, Brush, ADDITION, SUBTRACTION } from 'three-bvh-csg'
import { RoundedBoxGeometry } from 'three-stdlib'
import type { ProjectParams } from '../projects'
import type { PartOverrides, ProjectHandle, PartBaseDimensions } from '../types'
import { usePartInteraction, type PartData } from '../hooks/usePartInteraction'

type ParalettePartType = 'frame' | 'grip' | 'foot-left' | 'foot-right'

interface ParaletteProps {
  params: ProjectParams
  onParamsChange: (p: ProjectParams) => void
  onSelectionChange?: (ids: Set<string>) => void
  handleRef?: React.MutableRefObject<ProjectHandle | null>
}

const DEFAULT_OVERRIDES: PartOverrides = { scaleX: 1, scaleY: 1, scaleZ: 1, bevelRadius: 0, bevelSegments: 1 }

const INITIAL_PARTS: PartData<ParalettePartType>[] = [
  { id: 'frame', type: 'frame', overrides: { ...DEFAULT_OVERRIDES } },
  { id: 'grip', type: 'grip', overrides: { ...DEFAULT_OVERRIDES } },
  { id: 'foot-left', type: 'foot-left', overrides: { ...DEFAULT_OVERRIDES } },
  { id: 'foot-right', type: 'foot-right', overrides: { ...DEFAULT_OVERRIDES } },
]

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

  const {
    parts, selectedIds, hoveredId,
    deleteSelected, getGroup, getPartOverrides, updatePartOverrides, getAllPartOverrides,
    onSelect, onHover, onUnhover, onCanvasPointerDown, onCanvasClick,
    matColor, hasPart, partOv,
  } = usePartInteraction<ParalettePartType>({
    initialParts: INITIAL_PARTS,
    modelRef,
    onSelectionChange,
  })

  // ── Derived values ──
  const hw = W / 2
  const gripInnerR = gripDia / 2
  const gripOuterR = gripDia / 2 + T * 0.4
  const cornerR = T * 0.48
  const legLength = Math.sqrt(hw * hw + H * H)
  const legAngle = Math.atan2(H, hw)

  // ── Frame geometry (CSG: rounded bars + integrated grip ring - grip hole) ──
  const frameGeo = useMemo(() => {
    try {
      const evaluator = new Evaluator()
      const segs = 6
      const legExt = gripOuterR * 0.9
      const extLegLen = legLength + legExt
      const shiftX = (legExt / 2) * (hw / legLength)
      const shiftY = (legExt / 2) * (H / legLength)

      const baseBrush = new Brush(new RoundedBoxGeometry(W, T, depth, segs, cornerR))
      baseBrush.updateMatrixWorld()

      const leftLegBrush = new Brush(new RoundedBoxGeometry(extLegLen, T, depth, segs, cornerR))
      leftLegBrush.position.set(-hw / 2 + shiftX, H / 2 + shiftY, 0)
      leftLegBrush.rotation.set(0, 0, legAngle)
      leftLegBrush.updateMatrixWorld()

      let result = evaluator.evaluate(baseBrush, leftLegBrush, ADDITION)
      result.updateMatrixWorld()

      const rightLegBrush = new Brush(new RoundedBoxGeometry(extLegLen, T, depth, segs, cornerR))
      rightLegBrush.position.set(hw / 2 - shiftX, H / 2 + shiftY, 0)
      rightLegBrush.rotation.set(0, 0, Math.PI - legAngle)
      rightLegBrush.updateMatrixWorld()

      result = evaluator.evaluate(result, rightLegBrush, ADDITION)
      result.updateMatrixWorld()

      const capBrush = new Brush(new THREE.CylinderGeometry(gripOuterR, gripOuterR, depth + 0.01, 32))
      capBrush.position.set(0, H, 0)
      capBrush.rotation.set(Math.PI / 2, 0, 0)
      capBrush.updateMatrixWorld()

      result = evaluator.evaluate(result, capBrush, ADDITION)
      result.updateMatrixWorld()

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
      return new THREE.BoxGeometry(W, H, depth)
    }
  }, [W, H, T, depth, hw, legLength, legAngle, cornerR, gripOuterR, gripInnerR])

  // ── Grip tube (hollow cylinder extending along Z at apex) ──
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
        <planeGeometry args={[20, 20]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      <group ref={modelRef} position={[0, -H / 2, 0]}>
        {/* Frame */}
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

        {/* Grip tube at apex */}
        {hasPart('grip') && (() => {
          const ov = partOv('grip') ?? DEFAULT_OVERRIDES
          return (
            <mesh
              geometry={gripTubeGeo}
              position={[0, H, 0]}
              rotation={[Math.PI / 2, 0, 0]}
              scale={[ov.scaleX, ov.scaleY, ov.scaleZ]}
              onClick={(e) => onSelect('grip', e)}
              onPointerOver={(e) => onHover('grip', e)}
              onPointerOut={onUnhover}
            >
              <meshStandardMaterial color={matColor('grip', '#4488cc')} roughness={roughness} metalness={metalness} />
            </mesh>
          )
        })()}

        {/* Left foot */}
        {hasPart('foot-left') && (() => {
          const ov = partOv('foot-left') ?? DEFAULT_OVERRIDES
          return (
            <mesh
              geometry={footGeo}
              position={[-hw, -T / 2 + footR * 0.1, 0]}
              scale={[ov.scaleX, footH / footR * ov.scaleY, ov.scaleZ]}
              onClick={(e) => onSelect('foot-left', e)}
              onPointerOver={(e) => onHover('foot-left', e)}
              onPointerOut={onUnhover}
            >
              <meshStandardMaterial color={matColor('foot-left', '#4488cc')} roughness={roughness} metalness={metalness} />
            </mesh>
          )
        })()}

        {/* Right foot */}
        {hasPart('foot-right') && (() => {
          const ov = partOv('foot-right') ?? DEFAULT_OVERRIDES
          return (
            <mesh
              geometry={footGeo}
              position={[hw, -T / 2 + footR * 0.1, 0]}
              scale={[ov.scaleX, footH / footR * ov.scaleY, ov.scaleZ]}
              onClick={(e) => onSelect('foot-right', e)}
              onPointerOver={(e) => onHover('foot-right', e)}
              onPointerOut={onUnhover}
            >
              <meshStandardMaterial color={matColor('foot-right', '#4488cc')} roughness={roughness} metalness={metalness} />
            </mesh>
          )
        })()}
      </group>
    </group>
  )
}
