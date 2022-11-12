import { React, useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Stack from '@mui/material/Stack';
import Paper from '@mui/material/Paper';
import TrajectoryChart from '../vis/TrajectoryChart';
import ChartBox from './ChartBox';

import SingleStateModal from '../modals/SingleStateModal';

import '../css/App.css';
import GlobalStates from '../api/globalStates';

import SubSequenceView from './SubSequenceView';

import usePrevious from '../hooks/usePrevious';
import {
    chunkSimilarity,
    stateRatioChunkSimilarity,
    buildDictFromArray,
    percentToString,
    tooltip,
} from '../api/myutils';
import { createUUID } from '../api/random';

import { structuralAnalysisProps, SPARKLINE_CHART_HEIGHT } from '../api/constants';
import { zTest } from '../api/stats';
import { getAllImportantStates } from '../api/trajectories';

const SINGLE_STATE_MODAL = 'single_state';

const NO_SELECT = 0;
const FIND_SIMILAR_SELECT = 1;
const CLEAR_SELECTION = 2;
const SWAP_SELECTIONS = 3;

// index with current selection mode to determine how many chunks should be selected
// for a valid selection
const SELECTION_LENGTH = [0, 1, 3, 2];

export default function VisArea({ trajectories, runs, properties, swapPositions }) {
    const [currentModal, setCurrentModal] = useState(null);
    const [stateHovered, setStateHovered] = useState(null);
    const [stateClicked, setClicked] = useState(null);

    const [selectionMode, setSelectionMode] = useState(NO_SELECT);
    const [selectedObjects, setSelectedObjects] = useState([]);

    const [selections, setSelections] = useState({});

    const [anchorEl, setAnchorEl] = useState(null);

    const [toolTipList, setToolTipList] = useState([]);
    const oldToolTipList = usePrevious(toolTipList);

    const [globalProperties, setGlobalProperties] = useState(properties);
    const [globalMin, setGlobalMin] = useState(buildDictFromArray(properties, Number.MAX_VALUE));
    const [globalMax, setGlobalMax] = useState(buildDictFromArray(properties, Number.MIN_VALUE));
    const [showStateClustering, setShowStateClustering] = useState(false);

    const updateGlobalScale = (valMin, valMax, property) => {
        setGlobalMin((minDict) => ({
            ...minDict,
            [property]: minDict[property] > valMin ? valMin : minDict[property],
        }));

        setGlobalMax((maxDict) => ({
            ...maxDict,
            [property]: maxDict[property] < valMax ? valMax : maxDict[property],
        }));
    };

    /**
     * [TODO:description]
     *
     * @param {[TODO:type]} trajectory - [TODO:descriptin]
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

        // the unimportant chunks we will rende + 2.5r
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
            const { iChunks, uChunks } = getVisibleChunks(trajectory);
            visible = [...visible, ...iChunks, ...uChunks];
        }
        return visible;
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

    const findSimilar = (chunkSimilarityFunc, formatFunc) => {
        if (selectionMode === NO_SELECT) {
            /* const charts = document.querySelectorAll('.embeddedChart');
            for (const chart of charts) {
                chart.style.opacity = `${1.0}`;
            } */
            setSelectionMode(FIND_SIMILAR_SELECT);
        }

        if (selectionMode === FIND_SIMILAR_SELECT) {
            if (selectedObjects.length === SELECTION_LENGTH[FIND_SIMILAR_SELECT]) {
                // compare all chunks to the one that was selected
                const selected = selectedObjects[0];
                focusChart(selected.id);

                const visible = getAllVisibleChunks().filter((c) => c.id !== selected.id);
                const similarities = {};
                for (const vc of visible) {
                    const sim = chunkSimilarityFunc(selected, vc);
                    similarities[`ec_${vc.id}`] = sim;
                }

                const charts = document.querySelectorAll('.embeddedChart');
                const ttList = [];
                for (const chart of charts) {
                    if (similarities[chart.id] !== undefined) {
                        // chart.style.opacity = `${similarities[chart.id]}`;
                        const tt = tooltip(chart, formatFunc(similarities[chart.id]), {
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
            setSelectionMode(NO_SELECT);
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
        setSelectionMode(NO_SELECT);
        setToolTipList([]);
        GlobalStates.clearClusterStates();
    }, [trajectories]);

    useEffect(() => {
        if (selectionMode === NO_SELECT) {
            setSelectedObjects([]);
        } else {
            unFocusCharts();
            setToolTipList([]);

            if (selectionMode === CLEAR_SELECTION) {
                setSelectionMode(NO_SELECT);
            }
        }
    }, [selectionMode]);
    // essentially the same as useCallback
    /* setStateClickedProp = this.setStateClicked.bind(this);

    setStateHoveredProp = this.setStateHovered.bind(this);

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
        setSelections((prevState) => ({ ...prevState, [createUUID()]: extent }));
    };

    const deleteExtents = (id) => {
        setSelections(({ [id]: toDelete, ...rest }) => rest);
    };

    const selectObject = (o) => {
        // add chunk if it is not already in the array, otherwise remove it from the array
        if (!selectedObjects.map((d) => d.id).includes(o.id)) {
            // check if the selected length is acceptable for the current mode
            if (selectedObjects.length === SELECTION_LENGTH[selectionMode]) {
                setSelectedObjects([...selectedObjects.slice(1), o]);
            } else {
                setSelectedObjects([...selectedObjects, o]);
            }
        } else {
            setSelectedObjects(selectedObjects.filter((oo) => oo.id !== o.id));
        }
    };

    const swapButtonClick = () => {
        if (selectionMode === NO_SELECT) {
            setSelectionMode(SWAP_SELECTIONS);
        }

        if (selectionMode === SWAP_SELECTIONS) {
            if (selectedObjects.length === SELECTION_LENGTH[SWAP_SELECTIONS]) {
                swapPositions(selectedObjects[0], selectedObjects[1]);
            }
            setSelectionMode(NO_SELECT);
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
                                    id="setAttributeButton"
                                    onClick={(e) => setAnchorEl(e.currentTarget)}
                                >
                                    AttributeSelection
                                </Button>
                                <Button
                                    color="secondary"
                                    size="small"
                                    onClick={(e) =>
                                        selectionMode !== FIND_SIMILAR_SELECT
                                            ? findSimilar()
                                            : setAnchorEl(e.currentTarget)
                                    }
                                    id="findSimilarButton"
                                >
                                    {selectionMode !== FIND_SIMILAR_SELECT
                                        ? 'FindSimilar'
                                        : 'ToggleFindSimilar'}
                                </Button>

                                <Button
                                    color="secondary"
                                    size="small"
                                    onClick={() => swapButtonClick()}
                                >
                                    {selectionMode !== SWAP_SELECTIONS
                                        ? 'SwapSelections'
                                        : 'CompleteSwap'}
                                </Button>
                                <Button
                                    color="secondary"
                                    size="small"
                                    onClick={() =>
                                        !showStateClustering
                                            ? GlobalStates.clusterStates(
                                                  getAllImportantStates(trajectories)
                                              ).then(() => setShowStateClustering(true))
                                            : setShowStateClustering(false)
                                    }
                                >
                                    {showStateClustering ? 'ShowStateID' : 'ClusterStates'}
                                </Button>
                                <Button
                                    color="secondary"
                                    size="small"
                                    onClick={() => setSelectionMode(CLEAR_SELECTION)}
                                >
                                    ClearSelection
                                </Button>
                            </Box>

                            <Stack direction="column" spacing={2}>
                                {Object.values(trajectories)
                                    .sort((a, b) => a.position > b.position)
                                    .map((trajectory) => {
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
                                                leftBoundary = topChunkList[chunkIndex - 1];
                                            }

                                            if (chunkIndex < topChunkList.length - 1) {
                                                // get +1
                                                rightBoundary = topChunkList[chunkIndex + 1];
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
                                                height={
                                                    (globalProperties.length + 1) *
                                                        SPARKLINE_CHART_HEIGHT +
                                                    25
                                                }
                                                trajectory={trajectory}
                                                run={runs[trajectory.name]}
                                                setStateHovered={setStateHovered}
                                                setStateClicked={setStateClicked}
                                                stateHovered={stateHovered}
                                                isParentHovered={isHovered}
                                                charts={charts}
                                                properties={globalProperties}
                                                chunkSelectionMode={selectionMode}
                                                trajectorySelectionMode={
                                                    selectionMode === SWAP_SELECTIONS
                                                }
                                                selectObject={(o) => selectObject(o)}
                                                selectedObjects={selectedObjects}
                                                setExtents={setExtents}
                                                updateGlobalScale={updateGlobalScale}
                                                globalScaleMin={globalMin}
                                                showStateClustering={showStateClustering}
                                                globalScaleMax={globalMax}
                                            />
                                        );
                                    })}
                            </Stack>
                        </>
                    )}
                </ChartBox>
            </Box>
            <Stack
                component={Paper}
                direction="column"
                spacing={0.5}
                sx={{
                    overflow: 'scroll',
                    marginLeft: 5,
                    marginRight: 5,
                }}
            >
                {Object.keys(selections).map((uuid) => {
                    const selection = selections[uuid];
                    return (
                        <SubSequenceView selection={selection}>
                            <Button
                                color="secondary"
                                size="small"
                                onClick={() => {
                                    deleteExtents(uuid);
                                }}
                            >
                                X
                            </Button>
                        </SubSequenceView>
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
            {/* equivalent to (condition) ? true : false; do this to get rid of annoying open prop is null error */}
            <Menu
                open={!!(anchorEl && anchorEl.id === 'findSimilarButton')}
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
            >
                {/* call with corresponding similarity function */}
                <MenuItem
                    onClick={() => {
                        findSimilar(chunkSimilarity, percentToString);
                        setAnchorEl(null);
                    }}
                    dense
                    divider
                >
                    Unique state set comparison
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        findSimilar(stateRatioChunkSimilarity, percentToString);
                        setAnchorEl(null);
                    }}
                    dense
                >
                    State ratio comparison
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        findSimilar(
                            (a, b) => {
                                const aStates = a.states.map((id) => GlobalStates.get(id));
                                const bStates = b.states.map((id) => GlobalStates.get(id));
                                return zTest(
                                    aStates.map((d) => d[globalProperties]),
                                    bStates.map((d) => d[globalProperties])
                                );
                            },
                            (a) => `${a.toFixed(3)}`
                        );
                        setAnchorEl(null);
                    }}
                >
                    Z-score
                </MenuItem>
            </Menu>
            <Menu
                open={!!(anchorEl && anchorEl.id === 'setAttributeButton')}
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
            >
                <MenuItem>
                    <Select
                        value={globalProperties}
                        onChange={(e) => {
                            setGlobalProperties(e.target.value);
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

VisArea.defaultProps = {
    properties: structuralAnalysisProps,
};
