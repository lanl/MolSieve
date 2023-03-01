import { React, useState, useEffect, useRef, memo } from 'react';

import * as d3 from 'd3';
import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import '../css/App.css';

import { boxPlotStats } from '../api/math/stats';
import loadChart from '../api/websocketmethods';
import { LOADING_CHUNK_SIZE } from '../api/constants';

import ViolinPlot from '../vis/ViolinPlot';
import GlobalStates from '../api/globalStates';
import LoadingBox from '../components/LoadingBox';

import EmbeddedChart from '../vis/EmbeddedChart';

function ViolinPlotWrapper({
    chunk,
    height,
    width,
    properties,
    updateRanks,
    selectObject,
    ranks,
    chunkSelectionMode,
    selectedObjects,
    globalScale,
    updateGlobalScale,
    propertyCombos,
    onClick,
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
                ws,
                chunk.trajectory.name,
                properties,
                setProgress,
                setIsInterrupted,
                updateGS,
                render,
                setIsInitialized,
                LOADING_CHUNK_SIZE
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
    }, [JSON.stringify(chunk)]);

    if (isInterrupted) {
        return <div>Loading interrupted</div>;
    }

    const boxPlotHeight = height / (ranks.length + propertyCombos.length);

    return isInitialized ? (
        <EmbeddedChart
            height={height}
            width={width}
            color={chunk.color}
            onChartClick={() => selectObject(chunk)}
            id={`ec_${chunk.id}`}
            selected={
                chunkSelectionMode !== 0 &&
                chunkSelectionMode !== 3 &&
                selectedObjects.map((d) => d.id).includes(chunk.id)
            }
        >
            {(ww) => (
                <Box onClick={onClick}>
                    {progress < 1.0 ? (
                        <LinearProgress
                            variant="determinate"
                            value={progress * 100}
                            className="bar"
                        />
                    ) : null}
                    <Stack direction="column">
                        {ranks.map((property) => {
                            const { min, max } = globalScale[property];
                            const { q1, q3, median, iqr } = boxStats[property];

                            return (
                                <ViolinPlot
                                    key={`${chunk.id}-${property}`}
                                    showYAxis={false}
                                    data={chunk.getPropList(property)}
                                    color={chunk.color}
                                    property={property}
                                    width={ww}
                                    mouseOverText={`${chunk.toString()}<br/>
                            <em>${property}</em><br/> 
                            <b>Q1</b>: ${q1}</br> 
                            <b>Median</b>: ${median}</br> 
                            <b>Q3</b>: ${q3}</br>
                            <b>IQR</b>: ${iqr} <br/>`}
                                    height={boxPlotHeight}
                                    globalScaleMin={min}
                                    globalScaleMax={max}
                                />
                            );
                        })}
                    </Stack>
                </Box>
            )}
        </EmbeddedChart>
    ) : (
        <LoadingBox />
    );
}

export default memo(ViolinPlotWrapper);
