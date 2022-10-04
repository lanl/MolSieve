import { React, useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Container from '@mui/material/Container';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import * as d3 from 'd3';
import TrajectoryChart from '../vis/TrajectoryChart';
import Legend from '../vis/Legend';
import ChartBox from './ChartBox';

import SingleStateModal from '../modals/SingleStateModal';
import LoadingModal from '../modals/LoadingModal';

import '../css/App.css';
import GlobalStates from '../api/globalStates';

import { useContextMenu } from '../hooks/useContextMenu';
import { onEntityMouseOver, normalizeDict } from '../api/myutils';
import { structuralAnalysisProps } from '../api/constants';

import WebSocketManager from '../api/websocketmanager';

const SINGLE_STATE_MODAL = 'single_state';

export default function VisArea({ sx, trajectories, runs, properties }) {
    const [currentModal, setCurrentModal] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [stateHovered, setStateHovered] = useState(null);
    const [stateClicked, setClicked] = useState(null);
    const [globalProperty, setGlobalProperty] = useState(structuralAnalysisProps[0]);
    const { contextMenu, toggleMenu } = useContextMenu();

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

    // only clear websockets when charts change!
    return (
        <Container id="c" maxWidth={false} sx={{ display: 'flex', flexDirection: 'row', flex: 1 }}>
            {isLoading && <LoadingModal open={isLoading} title="Rendering..." />}
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: '10px' }}>
                <ChartBox sx={{ flexGrow: 1 }}>
                    {(width, height, isHovered) => (
                        <>
                            <Box
                                className="floatingToolBar"
                                sx={{ visibility: isHovered ? 'visible' : 'hidden' }}
                            >
                                <Button
                                    color="secondary"
                                    size="small"
                                    onClick={(e) => toggleMenu(e)}
                                >
                                    BoxPlotAttributes
                                </Button>
                            </Box>

                            {Object.values(trajectories).map((trajectory) => {
                                const { chunkList, name } = trajectory;
                                // this is all of the chunks we need for data
                                const topChunkList = chunkList.filter((d) => !d.hasParent);

                                // the important chunks we will render
                                const iChunks = topChunkList
                                    .filter((d) => d.important)
                                    .filter((d) => {
                                        const { extents } = runs[name];
                                        return extents[0] <= d.timestep && extents[1] >= d.last;
                                    });

                                // the unimportant chunks we will render
                                const uChunks = topChunkList
                                    .filter((d) => !d.important)
                                    .filter((d) => {
                                        const { extents } = runs[name];
                                        return extents[0] <= d.timestep && extents[1] >= d.last;
                                    });

                                // NOTE: we STILL need the topChunkList to be all of the chunks for expansion to work when zoomed in!

                                const uCharts = uChunks.map((chunk) => {
                                    return {
                                        id: chunk.id,
                                        chunk,
                                        important: chunk.important,
                                    };
                                });

                                const iCharts = iChunks.map((chunk) => {
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
                                        important: chunk.important,
                                    };
                                });

                                const charts = [...iCharts, ...uCharts];

                                return (
                                    <TrajectoryChart
                                        width={width || window.innerWidth}
                                        height={140}
                                        trajectory={trajectory}
                                        run={runs[trajectory.name]}
                                        loadingCallback={() => setIsLoading(false)}
                                        setStateHovered={setStateHovered}
                                        setStateClicked={setStateClicked}
                                        stateHovered={stateHovered}
                                        properties={properties}
                                        isParentHovered={isHovered}
                                        charts={charts}
                                        property={globalProperty}
                                    />
                                );
                            })}
                        </>
                    )}
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
                        value={globalProperty}
                        onChange={(e) => {
                            setGlobalProperty(e.target.value);
                        }}
                    >
                        {structuralAnalysisProps.map((property) => {
                            // move z-score into menuitem
                            return (
                                <MenuItem dense divider key={property} value={property}>
                                    {property}
                                </MenuItem>
                            );
                        })}
                    </Select>
                </MenuItem>
            </Menu>
        </Container>
    );
}
