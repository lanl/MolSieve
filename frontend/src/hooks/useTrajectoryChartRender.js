import { startTransition, useRef, useEffect } from 'react';
import * as d3 from 'd3';

/* eslint-disable */
export const useTrajectoryChartRender = (renderChartFn, dependencies) => {
    const ref = useRef();

    useEffect(() => {
        const svg = d3.select(ref.current); 
        startTransition(() => { 
            renderChartFn(svg)
        });
    }, dependencies);

    return ref;
};
