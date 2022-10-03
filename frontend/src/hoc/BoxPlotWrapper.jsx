import { React, useState, useEffect } from 'react';

import * as d3 from 'd3';
import { boxPlotStats } from '../api/stats';

import BoxPlot from '../vis/BoxPlot';
import GlobalStates from '../api/globalStates';

export default function ChunkWrapper({
    chunk,
    width,
    height,
    property,
    globalScale,
    updateGlobalScale,
}) {
    const [boxStats, setBoxStats] = useState();
    const [isLoaded, setIsLoaded] = useState(false);
    const [scale, setScale] = useState(() =>
        d3.scaleLinear().domain([Number.MIN_VALUE, Number.MAX_VALUE]).range([height, 5])
    );

    useEffect(() => {
        const { min, max } = globalScale;
        setScale(() => d3.scaleLinear().domain([min, max]).range([height, 5]));
    }, [globalScale]);

    useEffect(() => {
        GlobalStates.ensureSubsetHasProperty(property, chunk.selected).then(() => {
            const states = chunk.selected.map((id) => GlobalStates.get(id));
            const vals = states.map((d) => d[property]);

            // GlobalChartScale.update(vals, property);
            updateGlobalScale(d3.min(vals), d3.max(vals));

            setBoxStats(boxPlotStats(vals));
            setIsLoaded(true);
        });
    }, [chunk, property]);

    return isLoaded ? (
        <BoxPlot
            showYAxis={false}
            data={boxStats}
            chunk={chunk}
            property={property}
            width={width}
            height={height}
            globalScale={scale}
        />
    ) : (
        <div>Loading...</div>
    );
}
