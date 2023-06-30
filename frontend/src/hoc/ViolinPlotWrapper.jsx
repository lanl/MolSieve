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
import { abbreviate, showToolTip } from '../api/myutils';

import EmbeddedChart from '../vis/EmbeddedChart';

/**
 * Super-State View; a small multiple of Violin Plots that show the distribution of regions that were considered to be unimportant
 * by the simplfication algorithm
 * TODO: Rename to Super-State View
 *
 * @param {Chunk} chunk - The chunk associated with this view.
 * @param {Function} selectObject - Function to select this region.
 * @param {Array<String>} ranks - Properties ranked by importance.
 * @param {Number} chunkSelectionMode - Selection mode.
 * @param {Array<Object>} selectedObjects - Currently selected objects.
 * @param {Function} onClick - Function called on view click.
 * @param {Function} onMouseEnter - Function called when mouse enters view.
 * @param {Function} onMouseLeave - Function called when mouse exits view.
 */
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
    const violinPlotTooltip = (property, values) => (node) => {
        const content = `<b>${abbreviate(property)}</b><br/> 
        ${chunk.toString()}<br/>
        <em>Q1:</em> ${values.stats.q1}</br> 
        <em>Median:</em> ${values.stats.median}</br> 
        <em>Q3:</em> ${values.stats.q3}</br>
        <em>IQR:</em> ${values.stats.iqr} <br/>`;
        showToolTip(node, content);
    };

    // selected can be a prop, will remove need for chunkSelectionMode entirely
    // onChartClick should just be a general prop as well

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
                            {ranks.map((property) => (
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
                                            onMouseEnter={violinPlotTooltip(property, values)}
                                            height={boxPlotHeight}
                                            globalScaleMin={min}
                                            globalScaleMax={max}
                                        />
                                    )}
                                </PropertyWrapper>
                            ))}
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
