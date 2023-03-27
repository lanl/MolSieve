import { React, useState, useEffect, memo, useMemo, useCallback, startTransition } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import * as d3 from 'd3';
import { create, all } from 'mathjs';

import Box from '@mui/material/Box';
import Slider from '@mui/material/Slider';
import LinearProgress from '@mui/material/LinearProgress';

import '../css/App.css';

import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Tooltip from '@mui/material/Tooltip';
import IconButton from '@mui/material/IconButton';
import ZoomInMapIcon from '@mui/icons-material/ZoomInMap';
import ControlChart from '../vis/ControlChart';
import AggregateScatterplot from '../vis/AggregateScatterplot';

import { exponentialMovingAverage, betaPDF } from '../api/math/stats';
import { abbreviate, tooltip } from '../api/myutils';

import LoadingBox from '../components/LoadingBox';

import EmbeddedChart from '../vis/EmbeddedChart';
import PropertyWrapper from './PropertyWrapper';

import { makeGetStates, getStateColoringMethod, updateGlobalScale } from '../api/states';

function ChunkWrapper({
    chunk,
    height,
    addSelection,
    width,
    selections,
    selectObject,
    chunkSelectionMode,
    selectedObjects,
    ranks,
    doubleClickAction,
    propertyCombos,
    extents,
    scatterplotHeight,
    setStateHovered,
    trajectory,
    setZoom,
    onMouseEnter,
    onMouseLeave,
}) {
    const [isInitialized, setIsInitialized] = useState(false);
    const [progress, setProgress] = useState(0.0);
    const [startExtent, endExtent] = extents;

    const [startSlice, endSlice, valCount] = useMemo(() => {
        const { timestep, last } = chunk;
        const sliceStart = startExtent <= timestep ? 0 : startExtent - timestep;
        const sliceEnd = endExtent >= last ? last : endExtent;

        return [sliceStart, sliceEnd, sliceEnd - timestep];
    }, [startExtent, endExtent, chunk.timestep, chunk.last]);

    // With useSelector(), returning a new object every time will always force a re-render by default.
    const slicedChunk = useMemo(() => chunk.slice(startSlice, endSlice), [startSlice, endSlice]);

    const dispatch = useDispatch();

    const getStates = makeGetStates();
    const states = useSelector((state) => getStates(state, chunk.sequence).filter((d) => d.loaded));

    const colorState = useSelector((state) => getStateColoringMethod(state));

    const chartSel = useMemo(
        () =>
            Object.keys(selections)
                .filter((selectionID) => {
                    const selection = selections[selectionID];
                    const timesteps = selection.extent.map((d) => d.timestep);
                    return (
                        selection.trajectoryName === trajectory.name &&
                        slicedChunk.containsSequence(timesteps)
                    );
                })
                .map((selectionID) => {
                    const selection = selections[selectionID];
                    const { start, end } = selection.originalExtent;

                    // this needs to be done so that the selection can rescale
                    const x = d3
                        .scaleLinear()
                        .domain(d3.extent(slicedChunk.timesteps))
                        .range([0, width - 7.5]);

                    return {
                        set: selection.extent.map((d) => d.timestep),
                        brushValues: { start: x(start), end: x(end) },
                        id: selectionID,
                    };
                }),
        [
            Object.keys(selections).length,
            width,
            slicedChunk.timesteps.length,
            startExtent,
            endExtent,
        ]
    );

    const [mvaPeriod, setMvaPeriod] = useState(Math.min(chunk.sequence.length / 4, 100));
    const [tDict, setTDict] = useState({});

    const calculateControlChart = useCallback(
        (vals, property) => {
            const data = vals.map((d) => d[property]);
            const std = d3.deviation(data);
            const mva = exponentialMovingAverage(data, mvaPeriod);
            const mean = d3.mean(data);

            return { mva, std, mean };
        },
        [mvaPeriod]
    );

    useEffect(() => {
        setProgress(states.length / chunk.sequence.length);
        setIsInitialized(true);
    }, [states.length]);

    useEffect(() => {
        if (propertyCombos) {
            startTransition(() => {
                const math = create(all, {});

                const combos = {};
                for (const combo of propertyCombos) {
                    const t2 = [];
                    const means = {};
                    for (const prop of combo.properties) {
                        means[prop] = d3.mean(states, (d) => d[prop]);
                    }
                    for (let i = 0; i < states.length - 1; i++) {
                        const md = [];
                        const ma = [];

                        for (const prop of combo.properties) {
                            md.push(states[i][prop] - means[prop]);
                            ma.push(states[i + 1][prop] - states[i][prop]);
                        }
                        // calculate S
                        const vv = math.multiply(math.transpose(ma), ma);
                        const s = math.divide(vv, 2 * (states.length - 1));
                        const t = math.multiply(math.transpose(md), math.inv(s), md);
                        if (t !== Infinity && !Number.isNaN(t)) {
                            t2.push(t);
                        } else {
                            t2.push(0);
                        }
                    }

                    // calculate UCL
                    const m = states.length;
                    const p = combo.properties.length;
                    const q = (2 * (m - 1) ** 2) / (3 * m - 4);

                    // determine best value for alpha
                    const ucl = ((m - 1) ** 2 / m) * betaPDF(0.005, p / 2, (q - p - 1) / 2);

                    dispatch(
                        updateGlobalScale({
                            property: combo.id,
                            values: t2,
                        })
                    );
                    combos[combo.id] = { ucl, values: t2, property: combo.id };
                }
                setTDict(combos);
            });
        }
    }, [propertyCombos.length]);

    const controlChartHeight =
        (height - scatterplotHeight) / (ranks.length + Object.keys(tDict).length);

    const finishBrush = ({ selection }) => {
        // extents determines the zoom level
        const x = d3
            .scaleLinear()
            .domain(d3.extent(slicedChunk.timesteps))
            .range([0, width - 7.5]); // 7.5 to match margin on scatterplot

        const startTimestep = x.invert(selection[0]);
        const endTimestep = x.invert(selection[1]);

        const selectedStates = chunk.sequence
            .map((s, i) => ({
                timestep: chunk.timestep + i,
                id: s,
            }))
            .filter(
                (d) =>
                    d.timestep >= Math.trunc(startTimestep) && d.timestep <= Math.trunc(endTimestep)
            );

        addSelection(
            selectedStates,
            trajectory.name,
            { start: startTimestep, end: endTimestep },
            { start: selection[0], end: selection[1] }
        );
    };

    const brush = useCallback(
        d3.brushX().on('end', (e) => finishBrush(e)),
        [startExtent, endExtent, width]
    );

    const chartControls = useMemo(
        () => (
            <Box width={width} display="flex" alignItems="center" gap={1}>
                <Tooltip title="Zoom into region">
                    <IconButton onClick={() => setZoom([chunk.timestep, chunk.last])}>
                        <ZoomInMapIcon />
                    </IconButton>
                </Tooltip>
                <Slider
                    min={2}
                    defaultValue={Math.min(Math.trunc(chunk.sequence.length / 10), 100)}
                    max={Math.trunc(chunk.sequence.length / 4)}
                    step={1}
                    size="small"
                    onChangeCommitted={(_, v) => startTransition(() => setMvaPeriod(v))}
                />
                <Tooltip title="Moving average period" arrow>
                    <Typography variant="caption">{mvaPeriod}</Typography>
                </Tooltip>
            </Box>
        ),
        [mvaPeriod, width]
    );

    const selectChunk = useCallback(() => {
        if (chunkSelectionMode === 1 || chunkSelectionMode === 4) {
            selectObject(chunk);
        }
    }, [chunkSelectionMode]);

    return (
        <EmbeddedChart
            height={height}
            width={width}
            color={chunk.color}
            brush={brush}
            controls={chartControls}
            onChartClick={selectChunk}
            id={`ec_${chunk.id}`}
            selected={
                chunkSelectionMode !== 0 &&
                chunkSelectionMode !== 3 &&
                selectedObjects.map((d) => d.id).includes(chunk.id)
            }
            selections={chartSel}
        >
            {(ww) =>
                isInitialized ? (
                    <Box
                        onClick={(e) => {
                            if (e.detail === 2) {
                                doubleClickAction(chunk);
                            }
                        }}
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
                                        calculateValues={calculateControlChart}
                                        data={states}
                                    >
                                        {(min, max, values) => (
                                            <ControlChart
                                                globalScaleMin={min}
                                                globalScaleMax={max}
                                                ucl={values.mean + values.std}
                                                lcl={values.mean - values.std}
                                                height={controlChartHeight}
                                                width={ww}
                                                finalLength={chunk.sequence.length}
                                                yAttributeList={values.mva}
                                                extents={[startSlice, valCount]}
                                                margin={{ top: 3, bottom: 2, left: 0, right: 0 }}
                                                lineColor={chunk.color}
                                                title={`${abbreviate(property)}`}
                                                onMouseOver={(node, coords) => {
                                                    const [x, y] = coords;
                                                    const content = `<b>Timestep:</b> ${
                                                        chunk.timestep + x
                                                    } <br/><b>${abbreviate(
                                                        property
                                                    )}:</b> ${y.toFixed(2)}`;
                                                    /* eslint-disable-next-line */
                                                    let instance = node._tippy;
                                                    if (!instance) {
                                                        instance = tooltip(node, content);
                                                    } else {
                                                        instance.setContent(content);
                                                    }
                                                    instance.show();
                                                }}
                                                onMouseOut={(node) => {
                                                    /* eslint-disable-next-line */
                                                    const instance = node._tippy;
                                                    if (instance) {
                                                        instance.destroy();
                                                    }
                                                }}
                                            />
                                        )}
                                    </PropertyWrapper>
                                );
                            })}

                            {Object.keys(tDict).map((id) => {
                                const t = tDict[id];
                                const { values, ucl, property } = t;

                                return (
                                    <PropertyWrapper
                                        key={`${chunk.id}-${property}`}
                                        property={property}
                                    >
                                        {(min, max) => (
                                            <ControlChart
                                                key={`${chunk.id}-${id}`}
                                                globalScaleMin={min}
                                                globalScaleMax={max}
                                                ucl={ucl}
                                                height={controlChartHeight}
                                                width={ww}
                                                extents={[startSlice, valCount]}
                                                margin={{ top: 3, bottom: 2, left: 2, right: 2 }}
                                                yAttributeList={values}
                                                xAttributeList={chunk.timesteps}
                                                lineColor={chunk.color}
                                            />
                                        )}
                                    </PropertyWrapper>
                                );
                            })}
                        </Stack>
                        <AggregateScatterplot
                            key={`${chunk.id}-aggregate-scatterplot`}
                            xAttributeList={slicedChunk.timesteps}
                            yAttributeList={slicedChunk.sequence}
                            width={ww}
                            height={scatterplotHeight}
                            colorFunc={colorState}
                            onElementClick={(node, d) => {
                                d3.selectAll('.clicked').classed('clicked', false);
                                setStateHovered(d);
                                d3.select(node).classed('clicked', true);
                            }}
                            margin={{ top: 0, bottom: 4, left: 0, right: 0 }}
                        />
                    </Box>
                ) : (
                    <LoadingBox />
                )
            }
        </EmbeddedChart>
    );
}

export default memo(ChunkWrapper);
