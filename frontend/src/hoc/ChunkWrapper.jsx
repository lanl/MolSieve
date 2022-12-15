import { React, useState, useEffect, useRef } from 'react';

import * as d3 from 'd3';
import { create, all } from 'mathjs';

import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';

import Stack from '@mui/material/Stack';
import SparkLine from '../vis/SparkLine';

import { exponentialMovingAverage, differentiate } from '../api/stats';
import { abbreviate, onEntityMouseOver, buildDictFromArray } from '../api/myutils';

import Scatterplot from '../vis/Scatterplot';
import GlobalStates from '../api/globalStates';
import LoadingBox from '../components/LoadingBox';

import loadChart from '../api/websocketmethods';

const moveBy = 100;
const mvaPeriod = 100;

export default function ChunkWrapper({
    chunk,
    properties,
    width,
    trajectory,
    globalScale,
    updateGlobalScale,
    ranks,
    showStateClustering,
    selections,
    doubleClickAction,
    propertyCombos,
}) {
    // set as useReducer
    const [isInitialized, setIsInitialized] = useState(false);
    const [progress, setProgress] = useState(0.0);
    const [isInterrupted, setIsInterrupted] = useState(false);

    const [colorFunc, setColorFunc] = useState(() => (d) => {
        const state = GlobalStates.get(d.id);
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
        const rDict = {};
        const statDict = {};
        const states = chunk.sequence.map((id) => GlobalStates.get(id));
        for (const prop of properties) {
            const propList = states.map((d) => d[prop]);

            const std = d3.deviation(propList);
            const m = exponentialMovingAverage(propList, mvaPeriod);
            const mean = d3.mean(propList);
            const diffXtent = d3.extent(differentiate(m));

            mvaDict[prop] = m;
            rDict[prop] = diffXtent.reduce((acc, cv) => acc + Math.abs(cv), 0);
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
                moveBy,
                ws,
                chunk.trajectory.name,
                properties,
                setProgress,
                setIsInterrupted,
                updateGS,
                render,
                setIsInitialized
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
                    }
                }
                combos[combo.id] = t2;
            }
            setTDict(combos);
        }
    }, [JSON.stringify(propertyCombos)]);

    useEffect(() => {
        if (showStateClustering) {
            setColorFunc(() => (d) => {
                const state = GlobalStates.get(d.y);
                return state.stateClusteringColor;
            });
        } else {
            setColorFunc(() => (d) => {
                const state = GlobalStates.get(d.y);
                return state.individualColor;
            });
        }
    }, [showStateClustering]);

    if (isInterrupted) {
        return <div>Loading interrupted</div>;
    }

    return isInitialized ? (
        <Box
            onClick={(e) => {
                if (e.detail === 2) {
                    doubleClickAction();
                }
            }}
        >
            {progress < 1.0 ? (
                <LinearProgress variant="determinate" value={progress * 100} />
            ) : null}
            <Stack direction="column">
                {ranks.map((property) => {
                    const { min, max } = globalScale[property];
                    const { std, mean } = stats[property];
                    return (
                        <SparkLine
                            key={`${chunk.id}-${property}`}
                            globalScaleMin={min}
                            globalScaleMax={max}
                            std={std}
                            mean={mean}
                            width={width}
                            yAttributeList={mva[property]}
                            xAttributeList={chunk.timesteps}
                            lineColor={trajectory.colorByCluster(chunk)}
                            title={`${abbreviate(property)}`}
                        />
                    );
                })}
                {Object.keys(tDict).map((id) => {
                    const t = tDict[id];
                    console.log(t);
                    console.log(d3.mean(t), d3.min(t), d3.max(t), d3.deviation(t));
                    return (
                        <SparkLine
                            key={`${chunk.id}-${id}`}
                            globalScaleMin={d3.min(t)}
                            globalScaleMax={d3.max(t)}
                            std={d3.deviation(t)}
                            mean={d3.mean(t)}
                            width={width}
                            yAttributeList={t}
                            xAttributeList={chunk.timesteps}
                            lineColor={trajectory.colorByCluster(chunk)}
                        />
                    );
                })}
            </Stack>
            <Scatterplot
                width={width}
                height={50}
                colorFunc={colorFunc}
                selected={selections}
                xAttributeList={chunk.timesteps}
                yAttributeList={chunk.sequence}
                onElementMouseOver={(node, d) => {
                    const state = GlobalStates.get(d.y);
                    onEntityMouseOver(node, state);
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
