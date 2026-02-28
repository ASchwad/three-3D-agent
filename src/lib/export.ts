import * as THREE from 'three'
import { STLExporter } from 'three/addons/exporters/STLExporter.js'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { stlScaleFactor, glbScaleFactor, type UnitSystem } from './units'

/**
 * Clone the model and rotate from Three.js Y-up to STL/CAD Z-up convention.
 * Optionally applies a uniform scale factor for unit conversion.
 */
function cloneForExport(group: THREE.Object3D, scale: number): THREE.Object3D {
  const clone = group.clone(true)
  const wrapper = new THREE.Group()
  wrapper.add(clone)
  // Rotate +90deg around X to convert Y-up → Z-up
  wrapper.rotation.x = Math.PI / 2
  if (scale !== 1) {
    wrapper.scale.setScalar(scale)
  }
  wrapper.updateMatrixWorld(true)
  return wrapper
}

/**
 * Export STL. Slicers expect mm, so we scale from the working unit to mm.
 */
export function downloadSTL(group: THREE.Object3D, filename: string, unit: UnitSystem) {
  const scale = stlScaleFactor(unit)
  const exportScene = cloneForExport(group, scale)
  const exporter = new STLExporter()
  const result = exporter.parse(exportScene, { binary: true })
  const blob = new Blob([result], { type: 'application/octet-stream' })
  triggerDownload(blob, `${filename}.stl`)
}

/**
 * Export GLB. glTF spec expects meters, so we scale from working unit to meters.
 */
export async function downloadGLB(group: THREE.Object3D, filename: string, unit: UnitSystem) {
  const scale = glbScaleFactor(unit)
  const wrapper = new THREE.Group()
  const clone = group.clone(true)
  wrapper.add(clone)
  if (scale !== 1) {
    wrapper.scale.setScalar(scale)
  }
  wrapper.updateMatrixWorld(true)

  const exporter = new GLTFExporter()
  // GLB/glTF uses Y-up natively (same as Three.js), no rotation needed
  const result = await exporter.parseAsync(wrapper, { binary: true })
  const blob = new Blob([result as ArrayBuffer], { type: 'application/octet-stream' })
  triggerDownload(blob, `${filename}.glb`)
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.style.display = 'none'
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 10000)
}
