import * as THREE from 'three';

export default function arrToVec(arr) {
    const [x, y, z] = arr;
    return new THREE.Vector3(x, y, z);
}
