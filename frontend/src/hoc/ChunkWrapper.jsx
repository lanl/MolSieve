import { React, useState, useEffect, memo, useMemo, useCallback } from 'react';
import { useSelector } from 'react-redux';

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
import { abbreviate, getNumberLoaded } from '../api/myutils';

import LoadingBox from '../components/LoadingBox';

import EmbeddedChart from '../vis/EmbeddedChart';
import PropertyWrapper from './PropertyWrapper';

import { getStates } from '../api/states';

function ChunkWrapper({
    chunk,
    properties,
    height,
    addSelection,
    width,
    trajectory,
    selections,
    selectObject,
    chunkSelectionMode,
    selectedObjects,
    ranks,
    showStateClustering,
    doubleClickAction,
    propertyCombos,
    extents,
    scatterplotHeight,
    setStateHovered,
    setZoom,
}) {
    // set as useReducer
    const [isInitialized, setIsInitialized] = useState(false);
    const [progress, setProgress] = useState(0.0);

    // With useSelector(), returning a new object every time will always force a re-render by default.
    const states = useSelector(
        (state) => getStates(state, chunk.sequence)
        //    (oldStates, newStates) => getNumberLoaded(oldStates) === getNumberLoaded(newStates)
    );

    const stateMap = useMemo(
        () =>
            states.reduce((acc, v) => {
                acc[v.id] = { individualColor: v.individualColor };
                return acc;
            }, {}),
        []
    );

    const numLoaded = getNumberLoaded(states);

    const [colorFunc, setColorFunc] = useState(() => (d) => {
        const state = stateMap[d];
        return state.individualColor;
    });

    const [mvaPeriod, setMvaPeriod] = useState(Math.min(chunk.sequence.length / 4, 100));
    const [tDict, setTDict] = useState({});

    const calculations = useMemo(() => {
        const mva = {};
        // const rDict = {};
        const stats = {};

        for (const prop of properties) {
            const propList = states.map((d) => d[prop]);

            const std = d3.deviation(propList);
            const m = exponentialMovingAverage(propList, mvaPeriod);
            const mean = d3.mean(propList);
            // const diffXtent = d3.extent(differentiate(m));

            mva[prop] = m;
            // rDict[prop] = diffXtent.reduce((acc, cv) => acc + Math.abs(cv), 0);
            stats[prop] = { std, mean };
        }
        return { mva, stats };
    }, [mvaPeriod, numLoaded]);

    const { stats, mva } = calculations;

    useEffect(() => {
        setProgress(numLoaded / states.length);
        setIsInitialized(true);
    }, [numLoaded]);

    useEffect(() => {
        if (propertyCombos) {
            const math = create(all, {});

            const combos = {};
            for (const combo of propertyCombos) {
                const t2 = [];
                for (let i = 0; i < states.length - 1; i++) {
                    const md = [];
                    const ma = [];
                    for (const prop of combo.properties) {
                        const { mean } = stats[prop];
                        md.push(states[i][prop] - mean);
                        ma.push(states[i + 1][prop] - states[i][prop]);
                    }
                    // calculate S
                    const vv = math.multiply(math.transpose(ma), ma);
                    const s = math.divide(vv, 2 * (states.length - 1));
                    const t = math.multiply(math.transpose(md), math.inv(s), md);
                    if (t !== Infinity) {
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

                combos[combo.id] = { ucl, values: t2 };
            }
            setTDict(combos);
        }
    }, [JSON.stringify(propertyCombos), chunk.timestep, chunk.last, JSON.stringify(stats)]);

    useEffect(() => {
        if (showStateClustering) {
            setColorFunc(() => (d) => {
                const state = stateMap[d];
                return state.stateClusteringColor;
            });
        } else {
            setColorFunc(() => (d) => {
                const state = stateMap[d];
                return state.individualColor;
            });
        }
    }, [showStateClustering]);

    const [slice, setSlice] = useState([0, chunk.last]);
    const [timesteps, setTimesteps] = useState(chunk.timesteps);

    useEffect(() => {
        const [start, end] = extents;
        const { timestep, last } = chunk;
        const sliceStart = start <= timestep ? 0 : start - timestep;
        const sliceEnd = end >= last ? last : end - last;

        setSlice([sliceStart, sliceEnd]);
    }, [JSON.stringify(extents), chunk.timestep, chunk.last]);

    useEffect(() => {
        const [sliceStart, sliceEnd] = slice;
        setTimesteps(chunk.timesteps.filter((d) => d >= sliceStart && d <= sliceEnd));
    }, [JSON.stringify(slice), chunk.timestep, chunk.last]);

    const [sliceStart, sliceEnd] = slice;
    const controlChartHeight =
        (height - scatterplotHeight) / (ranks.length + Object.keys(tDict).length);

    const finishBrush = ({ selection }) => {
        // extents determines the zoom level
        const [chunkSliceStart, chunkSliceEnd] = extents;
        const x = d3
            .scaleLinear()
            .domain(
                d3.extent(chunk.timesteps.filter((d) => d >= chunkSliceStart && d <= chunkSliceEnd))
            )
            .range([0, width - 7.5]); // 7.5 to match margin on scatterplot

        const startTimestep = x.invert(selection[0]);
        const endTimestep = x.invert(selection[1]);

        const selectedStates = states
            .map((s, i) => ({
                timestep: chunk.timestep + i,
                id: s.id,
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
        () => d3.brushX().on('end', (e) => finishBrush(e)),
        [JSON.stringify(extents), chunk.timesteps.length]
    );

    const chartControls = useMemo(
        () => (
            <Box width={width} display="flex" alignItems="center" gap={1}>
                <Tooltip title="Zoom into region">
                    <IconButton
                        onClick={() => setZoom(trajectory.name, [chunk.timestep, chunk.last])}
                    >
                        <ZoomInMapIcon />
                    </IconButton>
                </Tooltip>
                <Slider
                    min={2}
                    defaultValue={Math.min(Math.trunc(chunk.sequence.length / 4), 100)}
                    max={Math.trunc(chunk.sequence.length / 4)}
                    step={1}
                    size="small"
                    onChangeCommitted={(_, v) => setMvaPeriod(v)}
                />
                <Tooltip title="Moving average period" arrow>
                    <Typography variant="caption">{mvaPeriod}</Typography>
                </Tooltip>
            </Box>
        ),
        [chunk.timestep, chunk.last]
    );

    return (
        <EmbeddedChart
            height={height}
            width={width}
            color={chunk.color}
            brush={brush}
            controls={chartControls}
            onChartClick={() => {
                if (chunkSelectionMode === 1 || chunkSelectionMode === 4) {
                    selectObject(chunk);
                }
            }}
            id={`ec_${chunk.id}`}
            selected={
                chunkSelectionMode !== 0 &&
                chunkSelectionMode !== 3 &&
                selectedObjects.map((d) => d.id).includes(chunk.id)
            }
            selections={selections}
        >
            {(ww) =>
                isInitialized ? (
                    <Box
                        onClick={(e) => {
                            if (e.detail === 2) {
                                doubleClickAction();
                            }
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
                                const { std, mean } = stats[property];
                                return (
                                    <PropertyWrapper
                                        key={`${chunk.id}-${property}`}
                                        property={property}
                                    >
                                        {(min, max) => (
                                            <ControlChart
                                                globalScaleMin={min}
                                                globalScaleMax={max}
                                                ucl={mean + std}
                                                lcl={mean - std}
                                                height={controlChartHeight}
                                                width={ww}
                                                yAttributeList={mva[property].slice(
                                                    sliceStart,
                                                    sliceEnd
                                                )}
                                                xAttributeList={timesteps}
                                                lineColor={trajectory.colorByCluster(chunk)}
                                                title={`${abbreviate(property)}`}
                                            />
                                        )}
                                    </PropertyWrapper>
                                );
                            })}
                            {Object.keys(tDict).map((id) => {
                                const t = tDict[id];
                                const { values, ucl } = t;
                                return (
                                    <ControlChart
                                        key={`${chunk.id}-${id}`}
                                        globalScaleMin={d3.min(values)}
                                        globalScaleMax={d3.max(values)}
                                        ucl={ucl}
                                        height={controlChartHeight}
                                        width={width}
                                        yAttributeList={values.slice(sliceStart, sliceEnd)}
                                        xAttributeList={timesteps}
                                        lineColor={trajectory.colorByCluster(chunk)}
                                    />
                                );
                            })}
                        </Stack>
                        <AggregateScatterplot
                            key={`${chunk.id}-aggregate-scatterplot`}
                            xAttributeList={timesteps}
                            yAttributeList={chunk.sequence.slice(sliceStart, sliceEnd)}
                            width={width}
                            height={scatterplotHeight}
                            colorFunc={colorFunc}
                            onElementClick={(node, d) => {
                                d3.selectAll('.clicked').classed('clicked', false);
                                setStateHovered(d);
                                d3.select(node).classed('clicked', true);
                            }}
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
