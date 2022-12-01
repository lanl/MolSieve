import { React, useState, useEffect, useRef } from 'react';

import * as d3 from 'd3';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';

import Stack from '@mui/material/Stack';
import SparkLine from '../vis/SparkLine';

import { simpleMovingAverage, differentiate } from '../api/stats';
import { abbreviate, onEntityMouseOver, buildDictFromArray } from '../api/myutils';
import { apiGetSequence } from '../api/ajax';

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
    leftBoundary,
    rightBoundary,
}) {
    // set as useReducer
    const [isInitialized, setIsInitialized] = useState(false);
    const [progress, setProgress] = useState(0.0);
    const [isInterrupted, setIsInterrupted] = useState(false);

    const [isExpanded, setIsExpanded] = useState(false);

    const [colorFunc, setColorFunc] = useState(() => (d) => {
        const state = GlobalStates.get(d.id);
        return state.individualColor;
    });

    const [mva, setMva] = useState({});
    const [stats, setStats] = useState(
        buildDictFromArray(properties, { std: undefined, mean: undefined })
    );

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
        for (const prop of properties) {
            const propList = chunk.getPropList(prop);

            const std = d3.deviation(propList);
            const m = simpleMovingAverage(propList, mvaPeriod);
            const mean = d3.mean(m);
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

        if (!isExpanded) {
            setIsInitialized(false);
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
        } else {
            // grab all of the states for left & right...
            console.log(leftBoundary, rightBoundary);
            apiGetSequence(chunk.trajectory.name, [leftBoundary.timestep, leftBoundary.last]).then(
                (d) => console.log(d)
            );
        }

        return () => {
            if (ws.current) {
                ws.current.close();
                ws.current = null;
            }
        };
    }, [chunk, properties, isExpanded]);

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
                    setIsExpanded(!isExpanded);
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
