import { React, useState, useEffect, useRef } from 'react';

import * as d3 from 'd3';
import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import { boxPlotStats } from '../api/math/stats';
import loadChart from '../api/websocketmethods';

import BoxPlot from '../vis/BoxPlot';
import GlobalStates from '../api/globalStates';
import LoadingBox from '../components/LoadingBox';

const moveBy = 100;

export default function BoxPlotWrapper({
    chunk,
    width,
    properties,
    updateRanks,
    ranks,
    globalScale,
    updateGlobalScale,
}) {
    const [boxStats, setBoxStats] = useState({});
    const [isInitialized, setIsInitialized] = useState(false);
    const [isInterrupted, setIsInterrupted] = useState(false);
    const [progress, setProgress] = useState(0.0);
    const ws = useRef(null);

    const render = () => {
        const bpStatDict = {};
        const rd = {};
        for (const prop of properties) {
            const vals = chunk.getPropList(prop);
            const bpStats = boxPlotStats(vals);
            bpStatDict[prop] = bpStats;
            rd[prop] = vals;
        }
        setBoxStats(bpStatDict);
        updateRanks(rd, chunk.id);
    };

    const updateGS = (states) => {
        const propDict = {};
        for (const prop of properties) {
            const vals = states.map((d) => d[prop]);
            propDict[prop] = { min: d3.min(vals), max: d3.max(vals) };
        }
        updateGlobalScale({ type: 'update', payload: propDict });
    };

    /* useEffect(() => {
        render();
    }, [globalScaleMin, globalScaleMax, width, height]); */

    useEffect(() => {
        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }

        setIsInitialized(false);
        const { hasProperties, missingProperties } = GlobalStates.subsetHasProperties(
            properties,
            chunk.selected
        );

        if (!hasProperties) {
            loadChart(
                missingProperties,
                moveBy,
                ws,
                chunk.trajectory.name,
                properties,
                setProgress,
                setIsInterrupted,
                updateGS,
                render,
                setIsInitialized
            );
        } else {
            setIsInitialized(true);
            setProgress(1.0);
            render();
        }

        return () => {
            if (ws.current) {
                ws.current.close();
                ws.current = null;
            }
        };
    }, [chunk, properties]);

    if (isInterrupted) {
        return <div>Loading interrupted</div>;
    }

    return isInitialized ? (
        <Box>
            {progress < 1.0 ? (
                <LinearProgress variant="determinate" value={progress * 100} />
            ) : null}
            <Stack direction="column">
                {ranks.map((property) => {
                    const { min, max } = globalScale[property];
                    return (
                        <BoxPlot
                            key={`${chunk.id}-${property}`}
                            showYAxis={false}
                            data={boxStats[property]}
                            chunk={chunk}
                            property={property}
                            width={width}
                            height={20}
                            globalScaleMin={min}
                            globalScaleMax={max}
                        />
                    );
                })}
            </Stack>
        </Box>
    ) : (
        <LoadingBox />
    );
}

BoxPlot.defaultProps = {
    showTop: 4,
};
