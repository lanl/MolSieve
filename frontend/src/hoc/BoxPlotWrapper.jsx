import { React, useState, useEffect } from 'react';

import { boxPlotStats } from '../api/stats';

import BoxPlot from '../vis/BoxPlot';
import GlobalStates from '../api/globalStates';
import GlobalChartScale from '../api/GlobalChartScale';

export default function ChunkWrapper({ chunk, width, height, property }) {
    const [boxStats, setBoxStats] = useState();
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        GlobalStates.ensureSubsetHasProperty(property, chunk.selected).then(() => {
            const states = chunk.selected.map((id) => GlobalStates.get(id));
            const vals = states.map((d) => d[property]);

            GlobalChartScale.update(vals, property);

            setBoxStats(boxPlotStats(vals));
            setIsLoaded(true);
        });
    }, [chunk, property]);

    return isLoaded ? (
        <BoxPlot
            showYAxis={false}
            data={boxStats}
            property={property}
            width={width}
            height={height}
            globalScale={GlobalChartScale.scale}
        />
    ) : (
        <div>Loading...</div>
    );
}
