import { React, useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

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

    return (
        <Box sx={sx}>
            {isLoading && <LoadingModal open={isLoading} title="Rendering..." />}
            <Box sx={{ display: 'flex', flexDirection: 'row' }}>
                <Box sx={{ display: 'flex', flexBasis: '10%', flexDirection: 'column' }}>
                    <Typography align="center" gutterBottom color="secondary" variant="h6">
                        Legend
                    </Typography>
                    <Legend trajectories={trajectories} />
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography align="center" gutterBottom color="secondary" variant="h6">
                        Sequence View
                    </Typography>
                    <ChartBox sx={{ flexGrow: 1 }}>
                        {(width, height, isHovered) => (
                            <TrajectoryChart
                                width={width}
                                height={height}
                                trajectories={trajectories}
                                runs={runs}
                                loadingCallback={() => setIsLoading(false)}
                                setStateHovered={setStateHovered}
                                setStateClicked={setStateClicked}
                                stateHovered={stateHovered}
                                properties={properties}
                                isParentHovered={isHovered}
                                charts={Object.keys(trajectories).flatMap((trajectoryName) => {
                                    const trajectory = trajectories[trajectoryName];
                                    const { chunkList } = trajectory;
                                    const topChunkList = chunkList.filter((d) => !d.hasParent);
                                    const iChunks = topChunkList.filter((d) => d.important);

                                    return iChunks.map((chunk) => {
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

                                        // for each important chunk in the trajectory
                                        // build a chart
                                        return {
                                            id: chunk.id,
                                            leftBoundary,
                                            chunk,
                                            rightBoundary,
                                            trajectoryName,
                                        };
                                    });
                                })}
                            />
                        )}
                    </ChartBox>
                </Box>
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
        </Box>
    );
}
