import { React, useState, useEffect } from 'react';

import * as d3 from 'd3';
import { boxPlotStats } from '../api/stats';

import BoxPlot from '../vis/BoxPlot';
import GlobalStates from '../api/globalStates';
import LoadingBox from '../components/LoadingBox';

export default function ChunkWrapper({
    chunk,
    width,
    height,
    property,
    globalScaleMin,
    globalScaleMax,
    updateGlobalScale,
}) {
    const [boxStats, setBoxStats] = useState();
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        GlobalStates.ensureSubsetHasProperty(property, chunk.selected).then(() => {
            const states = chunk.selected.map((id) => GlobalStates.get(id));
            const vals = states.map((d) => d[property]);

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
            globalScaleMin={globalScaleMin}
            globalScaleMax={globalScaleMax}
        />
    ) : (
        <LoadingBox />
    );
}
