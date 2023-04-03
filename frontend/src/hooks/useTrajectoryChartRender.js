import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { useTransitionEffect } from 'use-transition-effect';

/* eslint-disable */
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
