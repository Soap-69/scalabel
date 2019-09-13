import * as THREE from 'three'
import { ControlUnit } from './controller'

/**
 * Translate along plane
 */
export class TranslationPlane extends THREE.Mesh
  implements ControlUnit {
  /** normal direction */
  private _normal: THREE.Vector3

  constructor (normal: THREE.Vector3, color: number) {
    super(
      new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshBasicMaterial({ 
        color, side: THREE.DoubleSide, transparent: true 
      })
    )
    this._normal = new THREE.Vector3()
    this._normal.copy(normal)
    this._normal.normalize()

    const quaternion = new THREE.Quaternion()
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), this._normal)
    this.quaternion.copy(quaternion)
  }

  /**
   * Set highlighted
   * @param object
   */
  public setHighlighted (intersection ?: THREE.Intersection): boolean {
    { (this.material as THREE.Material).needsUpdate = true }
    if (intersection && intersection.object === this) {
      { (this.material as THREE.Material).opacity = 0.9 }
      return true
    } else {
      { (this.material as THREE.Material).opacity = 0.65 }
      return false
    }
  }

  /**
   * Get translation delta
   * @param oldIntersection
   * @param newProjection
   * @param dragPlane
   */
  public getDelta (
    oldIntersection: THREE.Vector3,
    newProjection: THREE.Ray,
    _dragPlane: THREE.Plane,
    local: boolean
  ): [THREE.Vector3, THREE.Quaternion, THREE.Vector3, THREE.Vector3] {
    const normal = new THREE.Vector3()
    normal.copy(this._normal)

    if (local && this.parent) {
      const quaternion = new THREE.Quaternion()
      this.parent.getWorldQuaternion(quaternion)

      normal.applyQuaternion(quaternion)
    }
    const plane = new THREE.Plane()
    plane.setFromNormalAndCoplanarPoint(normal, oldIntersection)
    const newIntersection = new THREE.Vector3()
    newProjection.intersectPlane(plane, newIntersection)

    const delta = new THREE.Vector3()
    delta.copy(newIntersection)
    delta.sub(oldIntersection)
    return [
      delta,
      new THREE.Quaternion(0, 0, 0, 1),
      new THREE.Vector3(),
      newIntersection
    ]
  }

  /**
   * Update scale according to world scale
   * @param worldScale
   */
  public updateScale (_worldScale: THREE.Vector3) {
    return
  }
}
