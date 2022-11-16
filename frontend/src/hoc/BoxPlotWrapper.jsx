import { React, useState, useEffect, useRef } from 'react';

import * as d3 from 'd3';
import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

import useRanks from '../hooks/useRanks';
import { boxPlotStats } from '../api/stats';

import BoxPlot from '../vis/BoxPlot';
import GlobalStates from '../api/globalStates';
import LoadingBox from '../components/LoadingBox';
import WebSocketManager from '../api/websocketmanager';

const moveBy = 100;

export default function BoxPlotWrapper({
    chunk,
    width,
    height,
    properties,
    globalScaleMin,
    globalScaleMax,
    updateGlobalScale,
    showTop,
}) {
    const [boxStats, setBoxStats] = useState({});
    const [isInitialized, setIsInitialized] = useState(false);
    const [isInterrupted, setIsInterrupted] = useState(false);
    const [progress, setProgress] = useState(0.0);
    const ws = useRef(null);

    const { updateRank, ranks, rankDict } = useRanks(properties);
    // Start here
    const render = (states, property) => {
        const vals = states.map((d) => d[property]);
        const bpStats = boxPlotStats(vals);
        updateRank(bpStats.iqr, property);
        setBoxStats((bStats) => ({ ...bStats, [property]: bpStats }));
    };

    const updateGS = (states, property) => {
        const vals = states.map((d) => d[property]);
        updateGlobalScale(d3.min(vals), d3.max(vals), property);
    };

    const runSocket = () => {
        ws.current = WebSocketManager.connect(
            'ws://localhost:8000/api/load_properties_for_subset',
            chunk.trajectory.name
        );
        let i = 0;
        const cStates = chunk.selected.map((id) => GlobalStates.get(id));

        ws.current.addEventListener('close', ({ code }) => {
            if (code === 3001 || code === 1011) {
                setIsInterrupted(true);
            }
        });

        ws.current.addEventListener('open', () => {
            const states = [...chunk.selected.slice(i * moveBy, (i + 1) * moveBy)];
            i++;
            ws.current.send(
                JSON.stringify({
                    props: properties,
                    stateIds: [...states],
                })
            );
        });

        ws.current.addEventListener('message', (e) => {
            const parsedData = JSON.parse(e.data);
            GlobalStates.addPropToStates(parsedData);

            setProgress((i * moveBy) / chunk.selected.length);

            for (const property of properties) {
                render(cStates, property);
            }
            setIsInitialized(true);
            let sendStates = [];

            if (i * moveBy < chunk.selected.length) {
                const nc = [...chunk.selected.slice(i * moveBy, (i + 1) * moveBy)];
                sendStates = nc;
            }

            if (!sendStates.length) {
                ws.current.close(1000);
            } else {
                i++;

                for (const property of properties) {
                    updateGS(cStates, property);
                }

                ws.current.send(
                    JSON.stringify({
                        props: properties,
                        stateIds: [...new Set(sendStates)],
                    })
                );
            }
        });
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
            runSocket();
        } else {
            setIsInitialized(true);
            setProgress(1.0);
            const states = chunk.selected.map((id) => GlobalStates.get(id));
            for (const p of properties) {
                render(states, p);
            }
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
                {ranks.slice(0, showTop).map((property) => {
                    return (
                        <BoxPlot
                            showYAxis={false}
                            data={boxStats[property]}
                            chunk={chunk}
                            property={property}
                            width={width}
                            height={20}
                            globalScaleMin={globalScaleMin[property]}
                            globalScaleMax={globalScaleMax[property]}
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
