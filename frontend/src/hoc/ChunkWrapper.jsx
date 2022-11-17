import { React, useState, useEffect, useRef } from 'react';

import * as d3 from 'd3';
import Box from '@mui/material/Box';
import IconButton from '@mui/material/IconButton';
import LinearProgress from '@mui/material/LinearProgress';

import Stack from '@mui/material/Stack';
import HighlightAltIcon from '@mui/icons-material/HighlightAlt';
import DeselectIcon from '@mui/icons-material/Deselect';
import SparkLine from '../vis/SparkLine';

import { simpleMovingAverage, differentiate } from '../api/stats';
import { abbreviate, onEntityMouseOver } from '../api/myutils';

import Scatterplot from '../vis/Scatterplot';
import GlobalStates from '../api/globalStates';
import WebSocketManager from '../api/websocketmanager';
import LoadingBox from '../components/LoadingBox';

import useRanks from '../hooks/useRanks';

const moveBy = 100;
const mvaPeriod = 100;

export default function ChunkWrapper({
    leftBoundary,
    chunk,
    rightBoundary,
    properties,
    width,
    height,
    trajectory,
    setStateHovered,
    setStateClicked,
    run,
    isParentHovered,
    globalScaleMin,
    globalScaleMax,
    stateHovered,
    updateGlobalScale,
    disableControls,
    setExtents,
    showStateClustering,
    currentSelection,
    showTop,
}) {
    const [isInitialized, setIsInitialized] = useState(false);
    const [progress, setProgress] = useState(0.0);
    const [isInterrupted, setIsInterrupted] = useState(false);

    const [selectionMode, setSelectionMode] = useState(false);
    const [colorFunc, setColorFunc] = useState(() => (d) => {
        const state = GlobalStates.get(d.id);
        return state.individualColor;
    });

    const { setRankDict, ranks, rankDict } = useRanks(properties);

    const [mva, setMva] = useState({});

    const ws = useRef(null);

    const updateGS = (states, property) => {
        const vals = states.map((d) => d[property]);
        updateGlobalScale(d3.min(vals), d3.max(vals), property);
    };

    const render = (props) => {
        const mvaDict = {};
        const rDict = {};
        for (const prop of props) {
            const m = chunk.calculateMovingAverage(prop, mvaPeriod, simpleMovingAverage);
            const diffXtent = d3.extent(differentiate(m));
            mvaDict[prop] = m;
            rDict[prop] = diffXtent[1] - diffXtent[0];
        }
        setMva(mvaDict);
        setRankDict(rDict);
    };

    const runSocket = () => {
        ws.current = WebSocketManager.connect(
            'ws://localhost:8000/api/load_properties_for_subset',
            chunk.trajectory.name
        );

        setProgress(0.0);
        const seen = new Set();
        let i = 0;

        ws.current.addEventListener('close', ({ code }) => {
            if (code === 3001 || code === 1011) {
                setIsInterrupted(true);
            }
        });

        let cStates = [];
        const total = chunk.states.length;

        ws.current.addEventListener('open', () => {
            cStates = [...chunk.states.slice(i * moveBy, (i + 1) * moveBy)];

            i++;

            ws.current.send(
                JSON.stringify({
                    props: properties,
                    stateIds: [...new Set(cStates)],
                })
            );
        });

        ws.current.addEventListener('message', (e) => {
            const parsedData = JSON.parse(e.data);
            GlobalStates.addPropToStates(parsedData);

            for (const property of properties) {
                updateGS(parsedData, property);
            }

            const currProgress = i * moveBy;
            setProgress(currProgress / total);

            setIsInitialized(true);

            render(properties);

            let sendStates = [];
            // if the chunks have not been fully loaded, continue
            if (i * moveBy < chunk.states.length) {
                sendStates = [...chunk.states.slice(i * moveBy, (i + 1) * moveBy)];
            }

            if (!sendStates.length) {
                ws.current.close(1000);
            } else {
                i++;
                ws.current.send(
                    JSON.stringify({
                        props: properties,
                        stateIds: [...new Set(sendStates)],
                    })
                );
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
            chunk.states
        );

        if (!hasProperties) {
            runSocket();
        } else {
            setProgress(1.0);
            setIsInitialized(true);
            render(properties);
        }

        return () => {
            if (ws.current) {
                ws.current.close();
                ws.current = null;
            }
        };
    }, [chunk, properties]);

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
        <Box>
            {progress < 1.0 ? (
                <LinearProgress variant="determinate" value={progress * 100} />
            ) : null}
            <Box
                className="floatingToolBar"
                sx={{ visibility: isParentHovered ? 'visible' : 'hidden' }}
            >
                <IconButton
                    color="secondary"
                    size="small"
                    aria-label={selectionMode ? 'Clear Selection' : 'Start Selection'}
                    onClick={() => setSelectionMode(!selectionMode)}
                >
                    {selectionMode ? <DeselectIcon /> : <HighlightAltIcon />}
                </IconButton>
            </Box>
            <Stack direction="column">
                {ranks.slice(0, showTop).map((property) => {
                    return (
                        <SparkLine
                            key={`${chunk.id}-${property}`}
                            globalScaleMin={globalScaleMin[property]}
                            globalScaleMax={globalScaleMax[property]}
                            width={width}
                            yAttributeList={mva[property]}
                            xAttributeList={chunk.timesteps}
                            lineColor={trajectory.colorByCluster(chunk)}
                            title={`${abbreviate(property)} ${rankDict[property].toFixed(2)}`}
                        />
                    );
                })}
            </Stack>
            <Scatterplot
                setExtents={(extents) => {
                    const data = extents.map((d) => ({ timestep: d.x, id: d.y }));
                    setExtents(data, trajectory.name);
                }}
                width={width}
                height={50}
                selectionMode={selectionMode}
                onSetExtentsComplete={() => setSelectionMode(false)}
                colorFunc={colorFunc}
                highlight={
                    currentSelection && chunk.containsSequence(currentSelection.timesteps)
                        ? currentSelection.timesteps
                        : null
                }
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
