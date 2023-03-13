import { React, useState, useEffect, memo, useMemo } from 'react';

import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import '../css/App.css';

import { useSelector } from 'react-redux';
import { boxPlotStats } from '../api/math/stats';

import ViolinPlot from '../vis/ViolinPlot';
import LoadingBox from '../components/LoadingBox';
import PropertyWrapper from './PropertyWrapper';

import { getStates } from '../api/states';
import { getNumberLoaded } from '../api/myutils';

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
    const [progress, setProgress] = useState(0.0);

    const states = useSelector(
        (state) => getStates(state, chunk.sequence)
        // (oldStates, newStates) => getNumberLoaded(oldStates) === getNumberLoaded(newStates)
    );
    const numLoaded = getNumberLoaded(states);

    const { boxStats, rankDict } = useMemo(() => {
        const bpStatDict = {};
        const rd = {};
        for (const prop of properties) {
            const vals = states.map((d) => d[prop]);
            const bpStats = boxPlotStats(vals);
            bpStatDict[prop] = bpStats;
            rd[prop] = vals;
        }
        return { boxStats: bpStatDict, rankDict: rd };
    }, [numLoaded]);

    useEffect(() => {
        updateRanks(rankDict, chunk.id);
    }, [JSON.stringify(rankDict)]);

    useEffect(() => {
        setProgress(numLoaded / states.length);
        setIsInitialized(true);
    }, [numLoaded]);

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
                                const { q1, q3, median, iqr } = boxStats[property];
                                const propertyList = states
                                    .map((d) => d[property])
                                    .filter((d) => d !== undefined);

                                return (
                                    <PropertyWrapper
                                        key={`${chunk.id}-${property}`}
                                        property={property}
                                    >
                                        {(min, max) => (
                                            <ViolinPlot
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
                                        )}
                                    </PropertyWrapper>
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
