import React from 'react';
import * as d3 from 'd3';

/* eslint-disable */
export const useTrajectoryChartRender = (renderChartFn, dependencies, returnFunc = () => {}) => {
    const ref = React.useRef();

    React.useEffect(() => {
        renderChartFn(d3.select(ref.current));
        return returnFunc;
    }, dependencies);

    return ref;
};
