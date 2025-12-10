/*
 * © 2025. Triad National Security, LLC. All rights reserved.
 * This program was produced under U.S. Government contract 89233218CNA000001 for Los Alamos National Laboratory (LANL), which is operated by Triad National Security, LLC for the U.S. Department of Energy/National Nuclear Security Administration. All rights in the program are reserved by Triad National Security, LLC, and the U.S. Department of Energy/National Nuclear Security Administration. The Government is granted for itself and others acting on its behalf a nonexclusive, paid-up, irrevocable worldwide license in this material to reproduce, prepare. derivative works, distribute copies to the public, perform publicly and display publicly, and to permit others to do so.
 */
import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { useTransitionEffect } from 'use-transition-effect';

/* eslint-disable */
/**
 * Escape hatch to use d3 with React inside a functional component. 
 *
 * TODO: Rename
 * @param {Function} renderChartFn - The function to call with the d3 pointer.
 * @param {Array<Object>} dependencies - The dependencies for the useEffect.
 */
export const useTrajectoryChartRender = (renderChartFn, dependencies) => {
    const ref = useRef();

    const [_, startTransitionEffect, stopTransitionEffect] = useTransitionEffect();

    useEffect(() => {
        startTransitionEffect(function* () {
            const svg = d3.select(ref.current); 
            renderChartFn(svg);
            yield;
        });

        return () => stopTransitionEffect();
    }, dependencies);

    return ref;
};
