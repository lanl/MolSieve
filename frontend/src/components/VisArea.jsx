import { React, useState, useEffect, useCallback } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import TrajectoryChart from '../vis/TrajectoryChart';
import ChartBox from './ChartBox';

import SingleStateModal from '../modals/SingleStateModal';

import '../css/App.css';
import GlobalStates from '../api/globalStates';

import ChunkComparisonView from '../hoc/ChunkComparisonView';

import { useContextMenu } from '../hooks/useContextMenu';
import { onEntityMouseOver, normalizeDict } from '../api/myutils';
import { structuralAnalysisProps } from '../api/constants';

const SINGLE_STATE_MODAL = 'single_state';

export default function VisArea({ sx, trajectories, runs, properties }) {
    const [currentModal, setCurrentModal] = useState(null);
    const [stateHovered, setStateHovered] = useState(null);
    const [stateClicked, setClicked] = useState(null);

    const [chunkSelectionMode, setChunkSelectionMode] = useState(false);
    const [selectedChunks, setSelectedChunks] = useState([]);
    const [chunkPairs, setChunkPairs] = useState([]);

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

    const setExtents = (extent) => {
        console.log(extent);
    };

    const selectChunk = (chunk) => {
        // add chunk if it is not already in the array, otherwise remove it from the array
        if (!selectedChunks.map((d) => d.id).includes(chunk.id)) {
            // add chunk to array, if it is larger than 2, remove the first element
            if (selectedChunks.length === 2) {
                setSelectedChunks([...selectedChunks.slice(1), chunk]);
            } else {
                setSelectedChunks([...selectedChunks, chunk]);
            }
        } else {
            setSelectedChunks(selectedChunks.filter((oChunk) => oChunk.id !== chunk.id));
        }
    };

    const selectionButtonClick = () => {
        if (chunkSelectionMode) {
            // check contents of selectedChunks, and then clear them
            if (selectedChunks.length === 2) {
                setChunkPairs([...chunkPairs, selectedChunks]);
            }
            setSelectedChunks([]);
        }
        setChunkSelectionMode(!chunkSelectionMode);
    };

    useEffect(() => {
        if (stateClicked) {
            toggleModal(SINGLE_STATE_MODAL);
        }
    }, [stateClicked]);

    useEffect(() => {}, [stateHovered]);
    /* useEffect(() => {
        const ids = getClassIds('filterable');
        ids.forEach((id) => applyFilters(trajectories, runs, id));
    }, [runs]); */

    useEffect(() => {
        setSelectedChunks([]);
        setChunkPairs([]);
        setChunkSelectionMode(false);
    }, [trajectories]);

    // only clear websockets when charts change!
    return (
        <Container
            id="c"
            maxWidth={false}
            sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}
        >
            <Box sx={{ display: 'flex', flexDirection: 'row', gap: '10px', flexBasis: '66%' }}>
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
                                <Button
                                    color="secondary"
                                    size="small"
                                    onClick={() => selectionButtonClick()}
                                >
                                    ChunkSelectionMode
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
                                        setStateHovered={setStateHovered}
                                        setStateClicked={setStateClicked}
                                        stateHovered={stateHovered}
                                        properties={properties}
                                        isParentHovered={isHovered}
                                        charts={charts}
                                        property={globalProperty}
                                        chunkSelectionMode={chunkSelectionMode}
                                        selectChunk={(chunk) => selectChunk(chunk)}
                                        selectedChunks={selectedChunks}
                                        setExtents={setExtents}
                                    />
                                );
                            })}
                        </>
                    )}
                </ChartBox>
            </Box>
            <Stack
                direction="row"
                alignItems="center"
                spacing={0.5}
                sx={{
                    overflow: 'scroll',
                    flexBasis: '33%',
                    background: '#f8f9f9',
                    fontColor: '#394043',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
                }}
            >
                {chunkPairs.map((pair) => {
                    const c1 = pair[0];
                    const c2 = pair[1];

                    // sort so that c1 is always the smaller id number
                    // could also do by timestep - sorted by temporal order
                    const first = c1.id < c2.id ? c1 : c2;
                    const second = c1.id < c2.id ? c2 : c1;

                    // not the best way to do it, but ok for now
                    return (
                        <Box
                            sx={{
                                flex: '0 0 auto',
                            }}
                            onMouseEnter={() => {
                                const charts = document.querySelectorAll('.embeddedChart');
                                for (const chart of charts) {
                                    if (chart.id !== `ec_${c1.id}` && chart.id !== `ec_${c2.id}`) {
                                        chart.classList.add('unfocused');
                                    }
                                }
                            }}
                            onMouseLeave={() => {
                                const charts = document.querySelectorAll(
                                    '.embeddedChart.unfocused'
                                );
                                for (const chart of charts) {
                                    chart.classList.remove('unfocused');
                                }
                            }}
                        >
                            <ChunkComparisonView
                                chunk1={first}
                                chunk2={second}
                                property={globalProperty}
                            />
                        </Box>
                    );
                })}
            </Stack>

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
