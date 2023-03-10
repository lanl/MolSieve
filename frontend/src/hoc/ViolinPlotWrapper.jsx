import { React, useState, useEffect, useRef, memo } from 'react';

import * as d3 from 'd3';
import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import '../css/App.css';

import { useSelector } from 'react-redux';
import { boxPlotStats } from '../api/math/stats';
import { LOADING_CHUNK_SIZE } from '../api/constants';

import ViolinPlot from '../vis/ViolinPlot';
import LoadingBox from '../components/LoadingBox';

import { getStates, subsetHasProperties } from '../api/states';

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
    propertyCombos,
    onClick,
}) {
    const [isInitialized, setIsInitialized] = useState(false);
    const [boxStats, setBoxStats] = useState({});
    const [progress, setProgress] = useState(0.0);

    const states = useSelector((state) => getStates(state, chunk.selected));
    const globalScale = useSelector((state) => state.states.globalScale);

    const render = () => {
        const bpStatDict = {};
        const rd = {};
        for (const prop of properties) {
            const vals = states.map((d) => d[prop]);
            const bpStats = boxPlotStats(vals);
            bpStatDict[prop] = bpStats;
            rd[prop] = vals;
        }
        setBoxStats(bpStatDict);
        updateRanks(rd, chunk.id);
        setIsInitialized(true);
    };

    useEffect(() => {
        const { missingProperties } = subsetHasProperties(properties, states);
        setProgress(missingProperties / states.length);
        render();
    }, [JSON.stringify(states)]);

    const boxPlotHeight = height / (ranks.length + propertyCombos.length);

    return (
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
            {(ww) =>
                isInitialized ? (
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
                                const propertyList = states.map((d) => d[property]);

                                return (
                                    <ViolinPlot
                                        key={`${chunk.id}-${property}`}
                                        showYAxis={false}
                                        data={propertyList}
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
                ) : (
                    <LoadingBox />
                )
            }
        </EmbeddedChart>
    );
}

export default memo(ViolinPlotWrapper);
