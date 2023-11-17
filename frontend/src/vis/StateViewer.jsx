import { React, useRef, useEffect } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls';
import arrToVec from '../api/math/3d';

const defaultMaterial = new THREE.MeshLambertMaterial({ color: '#C4B289' });

function StateViewer({
    width,
    height,
    data
}) {
    const ref = useRef(null);

    useEffect(() => {
        if (data === undefined) return;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(
            45,
            width / height,
            0.1,
            1000
        )
        camera.position.z = 1;

        const renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.setClearColor('#FFFFFF');
        renderer.setSize(width, height);
        ref.current.appendChild(renderer.domElement);
        const controls = new OrbitControls(camera, renderer.domElement);

        const sl = new THREE.SpotLight(0xFFFFFF, 2.0);
        camera.add(sl);
        scene.add(camera);

        const geometry = new THREE.SphereGeometry(0.01, 16, 16);
        // assume orthogonal cell for now
        const { cell } = data;
        const cx = cell[0][0];
        const cy = cell[1][1];
        const cz = cell[2][2];

        const { position, color, transparency, bonds } = data;

        const centeredPosition = position.map((p) => {
            const [x, y, z] = p;
            return [(x - (cx / 2)) / cx, (y - (cy / 2)) / cy, (z - (cz / 2)) / cz];
        });

        centeredPosition.forEach((p, i) => {
            let material;
            if (color) {
                material = new THREE.MeshLambertMaterial();
                const c = color[i];
                material.color.set(c[0], c[1], c[2]);
            } else {
                material = defaultMaterial;
            }

            if (transparency) {
                material.transparent = true;
                material.opacity = 1 - transparency[i];
            }

            const atom = new THREE.Mesh(geometry, material);
            const [x, y, z] = p;
            atom.position.set(x, y, z);

            scene.add(atom);
        });


        if (bonds.topology !== undefined) {
            bonds.topology.forEach((t, i) => {
                const [a1, a2] = t;
                const p1 = arrToVec(centeredPosition[a1]);
                const p2 = arrToVec(centeredPosition[a2]);
                const line = new THREE.LineCurve3(p1, p2);
                const g = new THREE.TubeGeometry(line, 20, 0.01, 8, true);

                let material;
                if (bonds.color) {
                    material = new THREE.MeshLambertMaterial();
                    const c = bonds.color[i];
                    material.color.set(c[0], c[1], c[2]);
                } else {
                    material = defaultMaterial;

                }

                const bond = new THREE.Mesh(g, material);
                scene.add(bond);

            });
        }

        controls.update();
        function animate() {
            requestAnimationFrame(animate);
            controls.update();
            renderer.render(scene, camera);
        }

        animate();
        return () => ref.current.removeChild(renderer.domElement);
    }, [data]);

    return <div width={width} height={height} ref={ref} />
}

export default StateViewer;
