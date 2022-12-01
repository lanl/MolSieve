import { React, useState, useEffect, useRef, useReducer } from 'react';

import * as d3 from 'd3';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';

import Stack from '@mui/material/Stack';
import SparkLine from '../vis/SparkLine';

import { simpleMovingAverage, differentiate } from '../api/stats';
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
    neighbors,
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

    const [data, reduceData] = useReducer(
        (state, action) => {
            switch (action.type) {
                case 'changeIsExpanded':
                    return action.payload;
                default:
                    throw new Error();
            }
        },
        {
            sequence: chunk.sequence,
            timesteps: chunk.timesteps,
            states: chunk.states,
        }
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
        const states = data.sequence.map((id) => GlobalStates.get(id));
        for (const prop of properties) {
            const propList = states.map((d) => d[prop]);

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

    const loadNeighbors = (left, right) => {
        return new Promise((resolve, reject) => {
            if (left) {
                left.loadSequence().then(() => {
                    if (right) {
                        right.loadSequence().then(() => resolve());
                    } else {
                        resolve();
                    }
                });
            } else if (right) {
                right.loadSequence().then(() => resolve());
            } else {
                reject();
            }
        });
    };

    useEffect(() => {
        if (ws.current) {
            ws.current.close();
            ws.current = null;
        }

        setIsInitialized(false);
        const { hasProperties, missingProperties } = GlobalStates.subsetHasProperties(
            properties,
            data.states
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
    }, [chunk, properties, JSON.stringify(data)]);

    useEffect(() => {
        // set sequence, timesteps correctly
        if (!isExpanded) {
            reduceData({
                type: 'changeIsExpanded',
                payload: {
                    sequence: chunk.sequence,
                    timesteps: chunk.timesteps,
                    states: chunk.states,
                },
            });
        } else {
            const { left, right } = neighbors;
            loadNeighbors(left, right)
                .then(() => {
                    reduceData({
                        type: 'changeIsExpanded',
                        payload: {
                            sequence: [...left.sequence, ...chunk.sequence, ...right.sequence],
                            timesteps: [...left.timesteps, ...chunk.timesteps, ...right.timesteps],
                            states: [
                                ...new Set([...left.states, ...chunk.states, ...right.states]),
                            ],
                        },
                    });
                })
                .catch(() => setIsExpanded(false));
        }
    }, [isExpanded]);

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
                            xAttributeList={data.timesteps}
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
                // this will change if isExpanded
                xAttributeList={data.timesteps}
                yAttributeList={data.sequence}
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
