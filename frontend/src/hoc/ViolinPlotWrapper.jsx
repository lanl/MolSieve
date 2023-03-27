import { React, useState, useEffect, memo, useCallback } from 'react';

import LinearProgress from '@mui/material/LinearProgress';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import '../css/App.css';

import { useSelector } from 'react-redux';
import { boxPlotStats } from '../api/math/stats';

import ViolinPlot from '../vis/ViolinPlot';
import LoadingBox from '../components/LoadingBox';
import PropertyWrapper from './PropertyWrapper';

import { makeGetStates } from '../api/states';
import { abbreviate, tooltip } from '../api/myutils';

import EmbeddedChart from '../vis/EmbeddedChart';

function ViolinPlotWrapper({
    chunk,
    height,
    width,
    selectObject,
    ranks,
    chunkSelectionMode,
    selectedObjects,
    onClick,
    onMouseEnter,
    onMouseLeave,
}) {
    const [isInitialized, setIsInitialized] = useState(false);
    const [progress, setProgress] = useState(0.0);

    const getStates = makeGetStates();

    const states = useSelector(
        (state) => getStates(state, chunk.selected).filter((d) => d.loaded),
        (prevState, currState) => prevState.length === currState.length
    );

    const calcStats = useCallback(
        (vals, property) => {
            const data = vals.map((d) => d[property]).filter((d) => d !== undefined);
            return { data, stats: boxPlotStats(data) };
        },
        [states.length]
    );

    useEffect(() => {
        setProgress(states.length / chunk.selected.length);
        setIsInitialized(true);
    }, [states.length]);

    const boxPlotHeight = height / ranks.length;

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
                    <Box
                        onClick={() => onClick(chunk)}
                        onMouseEnter={() => {
                            onMouseEnter(chunk);
                        }}
                        onMouseLeave={() => {
                            onMouseLeave(chunk);
                        }}
                    >
                        {progress < 1.0 ? (
                            <LinearProgress
                                variant="determinate"
                                value={progress * 100}
                                className="bar"
                            />
                        ) : null}
                        <Stack direction="column">
                            {ranks.map((property) => {
                                return (
                                    <PropertyWrapper
                                        key={`${chunk.id}-${property}`}
                                        property={property}
                                        data={states}
                                        calculateValues={calcStats}
                                    >
                                        {(min, max, values) => (
                                            <ViolinPlot
                                                showYAxis={false}
                                                data={values.data}
                                                color={chunk.color}
                                                property={property}
                                                width={ww}
                                                onMouseEnter={(node) => {
                                                    /* eslint-disable-next-line */
                                                    let instance = node._tippy;
                                                    const content = `<b>${abbreviate(
                                                        property
                                                    )}</b><br/> 
                                                    ${chunk.toString()}<br/>
                            <em>Q1:</em> ${values.stats.q1}</br> 
                            <em>Median:</em> ${values.stats.median}</br> 
                            <em>Q3:</em> ${values.stats.q3}</br>
                            <em>IQR:</em> ${values.stats.iqr} <br/>`;
                                                    if (!instance) {
                                                        instance = tooltip(node, content);
                                                    } else {
                                                        instance.setContent(content);
                                                    }
                                                    instance.show();
                                                }}
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
