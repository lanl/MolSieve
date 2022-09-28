import { React, useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import TrajectoryChart from '../vis/TrajectoryChart';
import Legend from '../vis/Legend';
import ChartBox from './ChartBox';

import SingleStateModal from '../modals/SingleStateModal';
import LoadingModal from '../modals/LoadingModal';

import '../css/App.css';
import GlobalStates from '../api/globalStates';

const SINGLE_STATE_MODAL = 'single_state';

export default function VisArea({ sx, trajectories, runs, properties }) {
    const [currentModal, setCurrentModal] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [stateHovered, setStateHovered] = useState(null);
    const [stateClicked, setClicked] = useState(null);

    /* Sets the currently clicked state to the supplied ID */
    const setStateClicked = (id) => {
        setClicked(GlobalStates.get(id));
    };

    // essentially the same as useCallback
    /* setStateClickedProp = this.setStateClicked.bind(this);

    setStateHoveredProp = this.setStateHovered.bind(this);

    setExtentsProp = this.setExtents.bind(this);

    setExtentsUniqueStatesProp = this.setExtentsUniqueStates.bind(this);

    setSequenceExtentProp = this.setSequenceExtent.bind(this); */

    const toggleModal = (key) => {
        if (currentModal) {
            setCurrentModal(currentModal);
        } else {
            setCurrentModal(key);
        }
    };

    useEffect(() => {
        if (stateClicked) {
            toggleModal(SINGLE_STATE_MODAL);
        }
    }, [stateClicked]);

    /* useEffect(() => {
        const ids = getClassIds('filterable');
        ids.forEach((id) => applyFilters(trajectories, runs, id));
    }, [runs]); */

    console.log(runs);
    return (
        <Container id="c" maxWidth={false} sx={{ display: 'flex', flexDirection: 'row', flex: 1 }}>
            {isLoading && <LoadingModal open={isLoading} title="Rendering..." />}
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
                <ChartBox sx={{ flexGrow: 1 }}>
                    {(width, height, isHovered) =>
                        Object.values(trajectories).map((trajectory, idx) => {
                            const { chunkList } = trajectory;
                            const topChunkList = chunkList.filter((d) => !d.hasParent);
                            const iChunks = topChunkList.filter((d) => d.important);

                            const charts = iChunks.map((chunk) => {
                                const chunkIndex = topChunkList.indexOf(chunk);
                                let leftBoundary;
                                let rightBoundary;
                                if (chunkIndex > 0) {
                                    // get -1
                                    if (!topChunkList[chunkIndex - 1].important) {
                                        leftBoundary = topChunkList[chunkIndex - 1];
                                    }
                                }

                                if (chunkIndex < topChunkList.length - 1) {
                                    // get +1
                                    if (!topChunkList[chunkIndex + 1].important) {
                                        rightBoundary = topChunkList[chunkIndex + 1];
                                    }
                                }

                                return {
                                    id: chunk.id,
                                    leftBoundary,
                                    chunk,
                                    rightBoundary,
                                };
                            });

                            return (
                                <TrajectoryChart
                                    width={width || window.innerWidth}
                                    height={70}
                                    trajectory={trajectory}
                                    run={runs[trajectory.name]}
                                    chunkThreshold={runs[trajectory.name].chunkingThreshold}
                                    loadingCallback={() => setIsLoading(false)}
                                    setStateHovered={setStateHovered}
                                    setStateClicked={setStateClicked}
                                    stateHovered={stateHovered}
                                    properties={properties}
                                    isParentHovered={isHovered}
                                    charts={charts}
                                />
                            );
                        })
                    }
                </ChartBox>
            </Box>

            {/* works for now, not the cleanest solution */}
            {currentModal === SINGLE_STATE_MODAL && stateClicked && (
                <SingleStateModal
                    open={currentModal === SINGLE_STATE_MODAL}
                    state={stateClicked}
                    closeFunc={() => {
                        setClicked(null);
                    }}
                />
            )}
        </Container>
    );
}

/*
            <Menu
                open={contextMenu !== null}
                onClose={toggleMenu}
                anchorReference="anchorPosition"
                anchorPosition={
                    contextMenu !== null
                        ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
                        : undefined
                }
            >
                <MenuItem>
                    <Select
                        value={boxPlotAttribute}
                        onChange={(e) => {
                            setBoxPlotAttribute(e.target.value);
                        }}
                    >
                        {structuralAnalysisProps.map((property) => {
                            // move z-score into menuitem
                            const zScores = [];
                            for (const trajectoryName of Object.keys(trajectories)) {
                                const trajectory = trajectories[trajectoryName];
                                const { featureImportance } = trajectory;
                                if (featureImportance) {
                                    const normDict = normalizeDict(featureImportance, [-1, 1]);
                                    zScores.push(
                                        <>
                                            <span> </span>
                                            <span
                                                key={`${property}_${trajectoryName}`}
                                                style={{
                                                    color: d3.interpolateRdBu(normDict[property]),
                                                }}
                                            >
                                                {featureImportance[property].toFixed(2)}
                                            </span>
                                        </>
                                    );
                                }
                            }
                            return (
                                <MenuItem dense divider key={property} value={property}>
                                    {property} {zScores}
                                </MenuItem>
                            );
                        })}
                    </Select>
                </MenuItem>
            </Menu>
*/
