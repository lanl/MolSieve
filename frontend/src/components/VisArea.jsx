import { React, useState, useEffect } from 'react';
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
import usePrevious from '../hooks/usePrevious';
import { chunkSimilarity, tooltip } from '../api/myutils';
import { createUUID } from '../api/random';

import { structuralAnalysisProps } from '../api/constants';

const SINGLE_STATE_MODAL = 'single_state';

const NO_SELECT = 0;
const CHUNK_COMPARISON_SELECT = 1;
const FIND_SIMILAR_SELECT = 2;
const CLEAR_SELECTION = 3;

// index with current selection mode to determine how many chunks should be selected
// for a valid selection
const SELECTION_LENGTH = [0, 2, 1, 3];

export default function VisArea({ trajectories, runs, properties }) {
    const [currentModal, setCurrentModal] = useState(null);
    const [stateHovered, setStateHovered] = useState(null);
    const [stateClicked, setClicked] = useState(null);

    const [chunkSelectionMode, setChunkSelectionMode] = useState(NO_SELECT);
    const [selectedChunks, setSelectedChunks] = useState([]);
    const [chunkPairs, setChunkPairs] = useState({});

    const [toolTipList, setToolTipList] = useState([]);
    const oldToolTipList = usePrevious(toolTipList);

    const [globalProperty, setGlobalProperty] = useState(structuralAnalysisProps[0]);
    const { contextMenu, toggleMenu } = useContextMenu();

    /**
     * [TODO:description]
     *
     * @param {[TODO:type]} trajectory - [TODO:description]
     * @returns {[TODO:type]} [TODO:description]
     */
    const getVisibleChunks = (trajectory) => {
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

        return { iChunks, uChunks, topChunkList };
    };

    /**
     * [TODO:description]
     *
     * @returns {[TODO:type]} [TODO:description]
     */
    const getAllVisibleChunks = () => {
        let visible = [];
        for (const trajectory of Object.values(trajectories)) {
            const { iChunks, uChunks, topChunkList } = getVisibleChunks(trajectory);
            visible = [...visible, ...iChunks, ...uChunks];
        }
        return visible;
    };

    const focusCharts = (c1, c2) => {
        const charts = document.querySelectorAll('.embeddedChart');
        for (const chart of charts) {
            if (chart.id !== `ec_${c1.id}` && chart.id !== `ec_${c2.id}`) {
                chart.classList.add('unfocused');
            }
        }
    };

    const focusChart = (c1) => {
        const charts = document.querySelectorAll('.embeddedChart');
        for (const chart of charts) {
            if (chart.id !== `ec_${c1.id}`) {
                chart.classList.add('unfocused');
            }
        }
    };

    const unFocusCharts = () => {
        const charts = document.querySelectorAll('.embeddedChart.unfocused');
        for (const chart of charts) {
            chart.classList.remove('unfocused');
        }
    };

    /* Sets the currently clicked state to the supplied ID */
    const setStateClicked = (id) => {
        setClicked(GlobalStates.get(id));
    };

    const findSimilar = () => {
        if (chunkSelectionMode === NO_SELECT) {
            /* const charts = document.querySelectorAll('.embeddedChart');
            for (const chart of charts) {
                chart.style.opacity = `${1.0}`;
            } */
            setChunkSelectionMode(FIND_SIMILAR_SELECT);
        }

        if (chunkSelectionMode === FIND_SIMILAR_SELECT) {
            if (selectedChunks.length === SELECTION_LENGTH[FIND_SIMILAR_SELECT]) {
                // compare all chunks to the one that was selected
                const selected = selectedChunks[0];
                focusChart(selected.id);

                const visible = getAllVisibleChunks().filter((c) => c.id !== selected.id);
                const similarities = {};
                for (const vc of visible) {
                    const sim = chunkSimilarity(selected, vc);
                    similarities[`ec_${vc.id}`] = sim;
                }

                const charts = document.querySelectorAll('.embeddedChart');
                const ttList = [];
                for (const chart of charts) {
                    if (similarities[chart.id] !== undefined) {
                        // chart.style.opacity = `${similarities[chart.id]}`;
                        const tt = tooltip(chart, `${similarities[chart.id].toFixed(3) * 100}%`, {
                            allowHTML: true,
                            arrow: true,
                            theme: 'translucent',
                            placement: 'top',
                        });
                        ttList.push(tt);
                    }
                }

                setToolTipList(ttList);
            }
            setChunkSelectionMode(NO_SELECT);
        }
    };

    useEffect(() => {
        if (toolTipList.length > 0) {
            for (const tt of toolTipList) {
                tt.show();
            }
        } else if (oldToolTipList) {
            for (const tt of oldToolTipList) {
                tt.hide();
                tt.destroy();
            }
        }
    }, [toolTipList]);

    useEffect(() => {
        setChunkPairs([]);
        setChunkSelectionMode(NO_SELECT);
    }, [trajectories]);

    useEffect(() => {
        if (chunkSelectionMode === NO_SELECT) {
            setSelectedChunks([]);
        } else {
            unFocusCharts();
            setToolTipList([]);

            if(chunkSelectionMode === CLEAR_SELECTION) {
                setChunkSelectionMode(NO_SELECT);
            }
        }
    }, [chunkSelectionMode]);
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

    // perhaps these should be states instead of directly modifying the javascript like this
    const selectChunk = (chunk) => {
        // add chunk if it is not already in the array, otherwise remove it from the array
        if (!selectedChunks.map((d) => d.id).includes(chunk.id)) {
            // check if the selected length is acceptable for the current mode
            if (selectedChunks.length === SELECTION_LENGTH[chunkSelectionMode]) {
                setSelectedChunks([...selectedChunks.slice(1), chunk]);
            } else {
                setSelectedChunks([...selectedChunks, chunk]);
            }
        } else {
            setSelectedChunks(selectedChunks.filter((oChunk) => oChunk.id !== chunk.id));
        }
    };

    const removeChunkPair = (key) => {
        const cp = { ...chunkPairs };
        delete cp[key];
        setChunkPairs(cp);
    };

    const selectionButtonClick = () => {
        if (chunkSelectionMode === NO_SELECT) {
            setChunkSelectionMode(CHUNK_COMPARISON_SELECT);
        }
        if (chunkSelectionMode === CHUNK_COMPARISON_SELECT) {
            // check contents of selectedChunks, and then clear them
            if (selectedChunks.length === SELECTION_LENGTH[CHUNK_COMPARISON_SELECT]) {
                setChunkPairs({ ...chunkPairs, [createUUID()]: selectedChunks });
            }
            setChunkSelectionMode(NO_SELECT);
        }
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
                                    {chunkSelectionMode !== CHUNK_COMPARISON_SELECT
                                        ? 'ChunkComparison'
                                        : 'ToggleChunkComparison'}
                                </Button>
                                <Button
                                    color="secondary"
                                    size="small"
                                    onClick={() => findSimilar()}
                                >
                                    {chunkSelectionMode !== FIND_SIMILAR_SELECT
                                        ? 'FindSimilar'
                                        : 'ToggleFindSimilar'}
                                </Button>
                                <Button
                                    color="secondary"
                                    size="small"
                                    onClick={() => setChunkSelectionMode(CLEAR_SELECTION)}
                                >
                                    ClearSelection
                                </Button>
                            </Box>

                            {Object.values(trajectories).map((trajectory) => {
                                const { uChunks, iChunks, topChunkList } =
                                    getVisibleChunks(trajectory);

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
                {Object.keys(chunkPairs).map((key) => {
                    const pair = chunkPairs[key];

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
                            onMouseEnter={() => focusCharts(c1, c2)}
                            onMouseLeave={() => unFocusCharts()}
                        >
                            <ChunkComparisonView
                                chunk1={first}
                                chunk2={second}
                                property={globalProperty}
                            >
                                <Button
                                    color="secondary"
                                    size="small"
                                    onClick={() => {
                                        removeChunkPair(key);
                                        unFocusCharts();
                                    }}
                                >
                                    X
                                </Button>
                            </ChunkComparisonView>
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
