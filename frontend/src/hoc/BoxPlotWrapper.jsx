import { React, useState, useEffect, useRef } from 'react';

import * as d3 from 'd3';
import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';

import { boxPlotStats } from '../api/stats';

import BoxPlot from '../vis/BoxPlot';
import GlobalStates from '../api/globalStates';
import LoadingBox from '../components/LoadingBox';
import WebSocketManager from '../api/websocketmanager';

const moveBy = 100;

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
    const [isInitialized, setIsInitialized] = useState(false);
    const [isInterrupted, setIsInterrupted] = useState(false);
    const [progress, setProgress] = useState(0.0);
    const ws = useRef(null);

    const render = () => {
        const states = chunk.selected.map((id) => GlobalStates.get(id));
        const vals = states.map((d) => d[property]);

        updateGlobalScale(d3.min(vals), d3.max(vals));

        setBoxStats(boxPlotStats(vals));
        setIsInitialized(true);
    };

    const runSocket = () => {
        ws.current = WebSocketManager.connect('ws://localhost:8000/api/load_properties_for_subset');
        let i = 0;

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
                    props: [property],
                    stateIds: [...states],
                })
            );
        });

        ws.current.addEventListener('message', (e) => {
            const parsedData = JSON.parse(e.data);
            GlobalStates.addPropToStates(parsedData);

            setProgress(i * moveBy);
            render();

            let sendStates = [];

            if (i * moveBy < chunk.selected.length) {
                const nc = [...chunk.selected.slice(i * moveBy, (i + 1) * moveBy)];
                sendStates = nc;
            }

            if (!sendStates.length) {
                ws.current.close(1000);
            } else {
                i++;
                ws.current.send(
                    JSON.stringify({
                        props: [property],
                        stateIds: [...new Set(sendStates)],
                    })
                );
            }
        });
    };

    useEffect(() => {
        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }

        runSocket();

        return () => {
            ws.current.close();
            ws.current = null;
        };
    }, [chunk, property]);

    if (isInterrupted) {
        return <div>Loading interrupted</div>;
    }

    return isInitialized ? (
        <Box>
            {progress / chunk.selected.length < 1.0 ? (
                <LinearProgress
                    variant="determinate"
                    value={(progress / chunk.selected.length) * 100}
                />
            ) : null}
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
        </Box>
    ) : (
        <LoadingBox />
    );
}
