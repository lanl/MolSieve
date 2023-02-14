import { React, useState, useEffect, useRef, memo } from 'react';

import * as d3 from 'd3';
import { create, all } from 'mathjs';

import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';

import '../css/App.css';

import Stack from '@mui/material/Stack';
import ControlChart from '../vis/ControlChart';
import AggregateScatterplot from '../vis/AggregateScatterplot';

import { exponentialMovingAverage, betaPDF } from '../api/math/stats';
import { abbreviate, buildDictFromArray } from '../api/myutils';

import { LOADING_CHUNK_SIZE } from '../api/constants';

import GlobalStates from '../api/globalStates';
import LoadingBox from '../components/LoadingBox';

import loadChart from '../api/websocketmethods';

function ChunkWrapper({
    chunk,
    properties,
    height,
    width,
    trajectory,
    globalScale,
    updateGlobalScale,
    ranks,
    showStateClustering,
    doubleClickAction,
    propertyCombos,
    extents,
    scatterplotHeight,
    setStateHovered,
}) {
    // set as useReducer
    const [isInitialized, setIsInitialized] = useState(false);
    const [progress, setProgress] = useState(0.0);
    const [isInterrupted, setIsInterrupted] = useState(false);

    const [colorFunc, setColorFunc] = useState(() => (d) => {
        const state = GlobalStates.get(d);
        return state.individualColor;
    });

    const [mva, setMva] = useState({});
    const [stats, setStats] = useState(
        buildDictFromArray(properties, { std: undefined, mean: undefined })
    );

    const [tDict, setTDict] = useState({});
    const ws = useRef(null);

    const updateGS = (states) => {
        const propDict = {};
        for (const prop of properties) {
            const vals = states.map((d) => d[prop]);
            propDict[prop] = { min: d3.min(vals), max: d3.max(vals) };
        }
        updateGlobalScale({ type: 'update', payload: propDict });
    };

    const render = () => {
        const mvaDict = {};
        // const rDict = {};
        const statDict = {};
        const states = chunk.sequence.map((id) => GlobalStates.get(id));

        const mvaP = Math.round(Math.log10(chunk.sequence.length));
        const mvaPeriod = mvaP > 1 ? mvaP : 2;

        for (const prop of properties) {
            const propList = states.map((d) => d[prop]);

            const std = d3.deviation(propList);
            const m = exponentialMovingAverage(propList, mvaPeriod);
            const mean = d3.mean(propList);
            // const diffXtent = d3.extent(differentiate(m));

            mvaDict[prop] = m;
            // rDict[prop] = diffXtent.reduce((acc, cv) => acc + Math.abs(cv), 0);
            statDict[prop] = { std, mean };
        }
        setMva(mvaDict);
        // updateRanks(rDict, 1);
        setStats(statDict);
    };

    useEffect(() => {
        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }

        const { hasProperties, missingProperties } = GlobalStates.subsetHasProperties(
            properties,
            chunk.states
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
            setProgress(1.0);
            setIsInitialized(true);
            render();
        }

        return () => {
            if (ws.current) {
                ws.current.close();
                ws.current = null;
            }
        };
    }, [JSON.stringify(chunk)]);

    useEffect(() => {
        if (propertyCombos) {
            const states = chunk.sequence.map((id) => GlobalStates.get(id));

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
    }, [JSON.stringify(propertyCombos), JSON.stringify(chunk), JSON.stringify(stats)]);

    useEffect(() => {
        if (showStateClustering) {
            setColorFunc(() => (d) => {
                const state = GlobalStates.get(d);
                return state.stateClusteringColor;
            });
        } else {
            setColorFunc(() => (d) => {
                const state = GlobalStates.get(d);
                return state.individualColor;
            });
        }
    }, [showStateClustering]);

    if (isInterrupted) {
        return <div>Loading interrupted</div>;
    }

    const [slice, setSlice] = useState([0, chunk.last]);
    const [timesteps, setTimesteps] = useState(chunk.timesteps);

    useEffect(() => {
        const [start, end] = extents;
        const { timestep, last } = chunk;
        const sliceStart = start <= timestep ? 0 : start - timestep;
        const sliceEnd = end >= last ? last : end - last;

        setSlice([sliceStart, sliceEnd]);
    }, [JSON.stringify(extents)]);

    useEffect(() => {
        const [sliceStart, sliceEnd] = slice;
        setTimesteps(chunk.timesteps.filter((d) => d >= sliceStart && d <= sliceEnd));
    }, [JSON.stringify(slice)]);

    const [sliceStart, sliceEnd] = slice;
    const controlChartHeight =
        (height - scatterplotHeight) / (ranks.length + Object.keys(tDict).length);

    return isInitialized ? (
        <Box
            onClick={(e) => {
                if (e.detail === 2) {
                    doubleClickAction();
                }
            }}
        >
            {progress < 1.0 ? (
                <LinearProgress variant="determinate" value={progress * 100} className="bar" />
            ) : null}
            <Stack direction="column">
                {ranks.map((property) => {
                    const { min, max } = globalScale[property];
                    const { std, mean } = stats[property];
                    return (
                        <ControlChart
                            key={`${chunk.id}-${property}`}
                            globalScaleMin={min}
                            globalScaleMax={max}
                            ucl={mean + std}
                            lcl={mean - std}
                            height={controlChartHeight}
                            width={width}
                            yAttributeList={mva[property].slice(sliceStart, sliceEnd)}
                            xAttributeList={timesteps}
                            lineColor={trajectory.colorByCluster(chunk)}
                            title={`${abbreviate(property)}`}
                        />
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
    );
}

ChunkWrapper.defaultProps = {
    showTop: 4,
};

export default memo(ChunkWrapper);
