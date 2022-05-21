import React from 'react';
import * as d3 from 'd3';
export const useTrajectoryChartRender = (renderChartFn, dependencies) => {
    const ref = React.useRef();

    React.useEffect(() => {
        renderChartFn(d3.select(ref.current));
	return () => {};
    }, dependencies);

    return ref;
}
