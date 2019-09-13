import * as THREE from 'three'
import { ControlUnit } from './controller'

/**
 * ThreeJS object used for moving parent object along certain axis
 */
export class TranslationAxis extends THREE.Group
  implements ControlUnit {
  /** Translation direction (180 degree symmetric) */
  private _direction: THREE.Vector3
  /** cone size */
  private _coneSize: number
  /** line */
  private _line: THREE.Line
  /** cone */
  private _cone: THREE.Mesh

  constructor (
    direction: THREE.Vector3, color: number, coneSize: number = 0.15
  ) {
    super()
    this._coneSize = coneSize

    this._direction = new THREE.Vector3()
    this._direction.copy(direction)
    this._direction.normalize()

    const lineGeometry = new THREE.BufferGeometry()
    lineGeometry.addAttribute(
      'position',
      new THREE.Float32BufferAttribute([ 0, 0, 0, 0, 1, 0 ], 3)
    )
    this._line = new THREE.Line(
      lineGeometry,
      new THREE.LineBasicMaterial({ color, transparent: true })
    )
    this.add(this._line)

    this._cone = new THREE.Mesh(
      new THREE.ConeGeometry(1, 1.2),
      new THREE.MeshBasicMaterial({ color, transparent: true })
    )
    this.add(this._cone)

    this._line.scale.set(1, .75 - this._coneSize, 1)

    this._cone.scale.set(this._coneSize, this._coneSize, this._coneSize)
    this._cone.position.y = .75

    const quaternion = new THREE.Quaternion()
    quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), this._direction)
    this.applyQuaternion(quaternion)

    this.setHighlighted()
  }

  /**
   * Mouse movement while mouse down on box (from raycast)
   * @param oldIntersection
   * @param newProjection
   * @param dragPlane
   */
  public getDelta (
    oldIntersection: THREE.Vector3,
    newProjection: THREE.Ray,
    dragPlane: THREE.Plane,
    _local: boolean
  ): [THREE.Vector3, THREE.Quaternion, THREE.Vector3, THREE.Vector3] {
    const direction = new THREE.Vector3()
    direction.copy(this._direction)

    if (this.parent) {
      const quaternion = new THREE.Quaternion()
      this.parent.getWorldQuaternion(quaternion)

      direction.applyQuaternion(quaternion)
    }

    const newIntersection = new THREE.Vector3()
    newProjection.intersectPlane(dragPlane, newIntersection)

    const mouseDelta = new THREE.Vector3()
    mouseDelta.copy(newIntersection)
    mouseDelta.sub(oldIntersection)

    const projectionLength = mouseDelta.dot(direction)
    const delta = new THREE.Vector3()
    delta.copy(direction)
    delta.multiplyScalar(projectionLength)

    const nextIntersection = new THREE.Vector3()
    nextIntersection.copy(oldIntersection)
    nextIntersection.add(delta)

    return [
      delta,
      new THREE.Quaternion(0, 0, 0, 1),
      new THREE.Vector3(),
      nextIntersection
    ]
  }

  /**
   * Set highlighted
   * @param object
   */
  public setHighlighted (intersection ?: THREE.Intersection): boolean {
    { (this._line.material as THREE.Material).needsUpdate = true }
    { (this._cone.material as THREE.Material).needsUpdate = true }
    if (
      intersection && (
        intersection.object === this ||
        intersection.object === this._line ||
        intersection.object === this._cone
      )
    ) {
      { (this._line.material as THREE.Material).opacity = 0.9 }
      { (this._cone.material as THREE.Material).opacity = 0.9 }
      return true
    } else {
      { (this._line.material as THREE.Material).opacity = 0.65 }
      { (this._cone.material as THREE.Material).opacity = 0.65 }
      return false
    }
  }

  /**
   * Override ThreeJS raycast to intersect with box
   * @param raycaster
   * @param intersects
   */
  public raycast (
    raycaster: THREE.Raycaster,
    intersects: THREE.Intersection[]
  ) {
    this._line.raycast(raycaster, intersects)
    this._cone.raycast(raycaster, intersects)
  }

  /**
   * Update scale according to world scale
   * @param worldScale
   */
  public updateScale (worldScale: THREE.Vector3) {
    if (this.parent) {
      const direction = new THREE.Vector3()
      direction.copy(this._direction)
      // direction.applyQuaternion(worldQuaternion.inverse())

      const newScale = Math.abs(direction.dot(worldScale)) * 3. / 4.

      this._line.scale.set(1, newScale, 1)

      this._cone.position.y = newScale
    }
  }
}
