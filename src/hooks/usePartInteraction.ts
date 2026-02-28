import { useState, useEffect, useCallback, useRef } from 'react'
import type * as THREE from 'three'
import type { ThreeEvent } from '@react-three/fiber'
import type { PartOverrides } from '../types'

export interface PartData<T extends string = string> {
  id: string
  type: T
  overrides: PartOverrides
}

interface UsePartInteractionOptions<T extends string> {
  initialParts: PartData<T>[]
  modelRef: React.RefObject<THREE.Group | null>
  onSelectionChange?: (ids: Set<string>) => void
  /** Override the default update logic (e.g. to propagate bevel across part types) */
  customUpdateOverrides?: (
    parts: PartData<T>[],
    ids: Set<string>,
    partial: Partial<PartOverrides>,
  ) => PartData<T>[]
}

export function usePartInteraction<T extends string>({
  initialParts,
  modelRef,
  onSelectionChange,
  customUpdateOverrides,
}: UsePartInteractionOptions<T>) {
  const [parts, setParts] = useState<PartData<T>[]>(initialParts)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [hoveredId, setHoveredId] = useState<string | null>(null)

  // Re-init parts when initialParts identity changes (e.g. finCount changed)
  const prevInitRef = useRef(initialParts)
  useEffect(() => {
    if (prevInitRef.current !== initialParts) {
      prevInitRef.current = initialParts
      setParts(initialParts)
      setSelectedIds(new Set())
    }
  }, [initialParts])

  // ── Handle-compatible callbacks ──

  const deleteSelected = useCallback(() => {
    if (selectedIds.size > 0) {
      setParts((prev) => prev.filter((p) => !selectedIds.has(p.id)))
      setSelectedIds(new Set())
    }
  }, [selectedIds])

  const getGroup = useCallback(() => modelRef.current, [modelRef])

  const getPartOverrides = useCallback(
    (id: string) => parts.find((p) => p.id === id)?.overrides,
    [parts],
  )

  const updatePartOverrides = useCallback(
    (ids: Set<string>, partial: Partial<PartOverrides>) => {
      setParts((prev) => {
        if (customUpdateOverrides) return customUpdateOverrides(prev, ids, partial)
        return prev.map((p) =>
          ids.has(p.id) ? { ...p, overrides: { ...p.overrides, ...partial } } : p,
        )
      })
    },
    [customUpdateOverrides],
  )

  const getAllPartOverrides = useCallback((): Record<string, PartOverrides> => {
    const r: Record<string, PartOverrides> = {}
    for (const p of parts) r[p.id] = p.overrides
    return r
  }, [parts])

  // ── Selection change notification ──

  useEffect(() => {
    onSelectionChange?.(selectedIds)
  }, [selectedIds, onSelectionChange])

  // ── Delete key handler ──

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

  // ── Interaction callbacks ──

  const onSelect = useCallback((id: string, e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    const isMulti = e.nativeEvent.metaKey || e.nativeEvent.ctrlKey
    setSelectedIds((prev) => {
      if (isMulti) {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
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

  // Canvas deselect (ignore drags)
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

  // ── Color helper ──

  const matColor = useCallback(
    (id: string, baseColor: string) => {
      if (selectedIds.has(id)) return '#ff6b6b'
      if (hoveredId === id) return '#a0c4ff'
      return baseColor
    },
    [selectedIds, hoveredId],
  )

  return {
    parts,
    selectedIds,
    hoveredId,
    // Handle-compatible callbacks
    deleteSelected,
    getGroup,
    getPartOverrides,
    updatePartOverrides,
    getAllPartOverrides,
    // Interaction
    onSelect,
    onHover,
    onUnhover,
    onCanvasPointerDown,
    onCanvasClick,
    matColor,
    // Convenience
    hasPart: (type: T) => parts.some((p) => p.type === type),
    partOv: (type: T) => parts.find((p) => p.type === type)?.overrides,
  }
}
