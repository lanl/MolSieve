import { React, useState, useEffect, useReducer, useCallback } from 'react';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import IconButton from '@mui/material/IconButton';
import ViewListIcon from '@mui/icons-material/ViewList';
import DifferenceIcon from '@mui/icons-material/Difference';
import LibraryAddIcon from '@mui/icons-material/LibraryAdd';
import SwapVertIcon from '@mui/icons-material/SwapVert';

import ClearAllIcon from '@mui/icons-material/ClearAll';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';

import { useSnackbar } from 'notistack';

import TrajectoryChart from '../vis/TrajectoryChart';
import ChartBox from './ChartBox';
import StateDetailView from './StateDetailView';
import TransferListModal from '../modals/TransferListModal';
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
import { createUUID } from '../api/math/random';

import { zTest } from '../api/math/stats';
// import { getAllImportantStates } from '../api/trajectories';

const MULTIVARIATE_CHART_MODAL = 'multivariate_chart';

const NO_SELECT = 0;
const FIND_SIMILAR_SELECT = 1;
const CLEAR_SELECTION = 2;
const SWAP_SELECTIONS = 3;
const CHUNK_SELECT = 4;

// index with current selection mode to determine how many chunks should be selected
// for a valid selection
const SELECTION_LENGTH = [0, 1, 3, 2, 2];

export default function VisArea({ trajectories, runs, properties, swapPositions, expand, sx }) {
    const [currentModal, setCurrentModal] = useState(null);
    const [stateHovered, setStateHovered] = useState(null);

    const [selectionMode, setSelectionMode] = useState(NO_SELECT);
    const [selectedObjects, setSelectedObjects] = useState([]);

    const { enqueueSnackbar } = useSnackbar();

    const [selections, setSelections] = useReducer(
        (state, action) => {
            switch (action.type) {
                case 'create': {
                    return {
                        values: { ...state.values, [createUUID()]: action.payload },
                        current: state.current,
                    };
                }
                case 'delete': {
                    const { [action.payload]: _, ...rest } = state.values;
                    return {
                        values: rest,
                        current: state.current,
                    };
                }
                case 'setCurrent':
                    return { values: state.values, current: action.payload };
                default:
                    throw new Error('Unknown action');
            }
        },
        {
            values: {},
            current: null,
        }
    );

    const addSelection = (extent, trajectoryName, originalExtent, brushValues) => {
        setSelections({
            type: 'create',
            payload: { extent, trajectoryName, originalExtent, brushValues },
        });
    };

    const addSelectionCallback = useCallback(addSelection, []);

    const deleteExtents = (id) => {
        setSelections({ type: 'delete', payload: id });
    };

    const setCurrentSelection = (selection) => {
        setSelections({ type: 'setCurrent', payload: selection });
    };

    const [anchorEl, setAnchorEl] = useState(null);

    const [toolTipList, setToolTipList] = useState([]);
    const oldToolTipList = usePrevious(toolTipList);

    const [showTop, setShowTop] = useState(4);

    const updateGS = (oldGS, newGS) => {
        const updatedGS = {};
        for (const property of Object.keys(oldGS)) {
            const oldProp = oldGS[property];
            const newProp = newGS[property];
            if (newProp) {
                updatedGS[property] = {
                    min: newProp.min < oldProp.min ? newProp.min : oldProp.min,
                    max: newProp.max > oldProp.max ? newProp.max : oldProp.max,
                };
            }
        }
        return updatedGS;
    };

    const [globalScale, updateGlobalScale] = useReducer((state, action) => {
        switch (action.type) {
            case 'create':
                return {
                    ...state,
                    [action.payload]: { min: Number.MAX_VALUE, max: Number.MIN_VALUE },
                };
            case 'update':
                return updateGS(state, action.payload);
            case 'addProperties':
                return {
                    ...state,
                    ...buildDictFromArray(action.payload, {
                        min: Number.MAX_VALUE,
                        max: Number.MIN_VALUE,
                    }),
                };
            default:
                throw new Error('Unknown action');
        }
    }, buildDictFromArray(properties, { min: Number.MAX_VALUE, max: Number.MIN_VALUE }));

    useEffect(() => {
        if (globalScale) {
            const currentProperties = Object.keys(globalScale);
            const newProperties = properties.filter(
                (property) => !currentProperties.includes(property)
            );
            updateGlobalScale({ type: 'addProperties', payload: newProperties });
        }
    }, [JSON.stringify(properties)]);

    const [propertyCombos, reducePropertyCombos] = useReducer((state, action) => {
        switch (action.type) {
            case 'create': {
                const id = createUUID();
                updateGlobalScale({ type: 'create', payload: id });
                return [...state, { id, properties: action.payload }];
            }
            default:
                throw new Error('Unknown action');
        }
    }, []);

    const [showStateClustering, setShowStateClustering] = useState(false);

    /**
     * Gets all visible chunks across all trajectories.
     *
     * @returns {Array<Chunk>} All chunks visible on the screen
     */
    const getAllVisibleChunks = () => {
        let visible = [];
        for (const trajectory of Object.values(trajectories)) {
            const { name } = trajectory;
            const { extents } = runs[name];
            const { iChunks, uChunks } = trajectory.getVisibleChunks(extents);
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
    }, [JSON.stringify(trajectories)]);

    useEffect(() => {
        console.log('selectionMode set to', selectionMode);
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

    const selectObject = (o) => {
        // add chunk if it is not already in the array, otherwise remove it from the array
        console.log(o, selectedObjects, SELECTION_LENGTH[selectionMode], selectionMode);
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

    const selectObjectCallback = useCallback(selectObject, [
        selectionMode,
        JSON.stringify(selectedObjects),
    ]);

    const startSelection = (selectedMode, action) => {
        // the button was clicked again, finish the selection
        if (selectionMode === selectedMode) {
            // if we have the correct amount of objects selected, perform the action
            if (selectedObjects.length === SELECTION_LENGTH[selectedMode]) {
                // calls action with selectedObjects as a parameter
                action(selectedObjects);
            } else {
                enqueueSnackbar(
                    `Invalid length for selection. Expected ${SELECTION_LENGTH[selectedMode]}.`,
                    { variant: 'error' }
                );
            }
            // add notification if selection was incorrect length
            setSelectionMode(NO_SELECT);
        } else {
            setSelectionMode(selectedMode);
        }
    };

    const findSimilar = (chunkSimilarityFunc, formatFunc, selection) => {
        // compare all chunks to the one that was selected
        const selected = selection[0];
        focusChart(selected.id);

        const visible = getAllVisibleChunks().filter((c) => c.id !== selected.id && c.important);
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
    };

    // only clear websockets when charts change!
    return (
        <Box id="c" sx={sx}>
            <CssBaseline />
            <ChartBox sx={{ marginBottom: 5 }}>
                {(width) => (
                    <>
                        <Box display="flex">
                            <Tooltip title="Adjust number of properties shown" arrow>
                                <IconButton
                                    color="secondary"
                                    size="small"
                                    id="showTopButton"
                                    onClick={(e) => setAnchorEl(e.currentTarget)}
                                >
                                    <ViewListIcon />
                                </IconButton>
                            </Tooltip>
                            {/* <IconButton
                                size="small"
                                color={selectionMode !== CHUNK_SELECT ? 'secondary' : 'default'}
                                onClick={() =>
                                    startSelection(CHUNK_SELECT, (selection) => {
                                        console.log(selection);
                                    })
                                }
                            >
                                <DifferenceIcon />
                            </IconButton> */}
                            {/* <Button
                                color="secondary"
                                size="small"
                                onClick={(e) =>
                                    selectionMode !== FIND_SIMILAR_SELECT
                                        ? startSelection(FIND_SIMILAR_SELECT, () => {})
                                        : setAnchorEl(e.currentTarget)
                                }
                                id="findSimilarButton"
                            >
                                {selectionMode !== FIND_SIMILAR_SELECT
                                    ? 'FindSimilar'
                                    : 'ToggleFindSimilar'}
                            </Button> */}

                            <Tooltip title="Swap selections" arrow>
                                <IconButton
                                    color="secondary"
                                    size="small"
                                    onClick={() =>
                                        startSelection(SWAP_SELECTIONS, (selection) =>
                                            swapPositions(selection[0], selection[1])
                                        )
                                    }
                                >
                                    <SwapVertIcon />
                                </IconButton>
                            </Tooltip>
                            {/* <Button
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
                            </Button> */}
                            <Tooltip title="Add multivariate chart" arrow>
                                <IconButton
                                    color="secondary"
                                    size="small"
                                    onClick={() => setCurrentModal(MULTIVARIATE_CHART_MODAL)}
                                >
                                    <LibraryAddIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Clear selections" arrow>
                                <IconButton
                                    color="secondary"
                                    size="small"
                                    onClick={() => setSelectionMode(CLEAR_SELECTION)}
                                >
                                    <ClearAllIcon />
                                </IconButton>
                            </Tooltip>
                        </Box>

                        <Stack direction="column" spacing={2}>
                            {Object.values(trajectories)
                                .sort((a, b) => a.position > b.position)
                                .map((trajectory) => {
                                    const run = runs[trajectory.name];
                                    const { extents } = run;
                                    return (
                                        <TrajectoryChart
                                            width={width}
                                            height={(showTop + propertyCombos.length) * 50 + 50}
                                            scatterplotHeight={50}
                                            trajectory={trajectory}
                                            run={run}
                                            extents={extents}
                                            currentClustering={trajectory.current_clustering}
                                            chunkingThreshold={trajectory.chunkingThreshold}
                                            setStateHovered={setStateHovered}
                                            properties={properties}
                                            propertyCombos={propertyCombos}
                                            chunkSelectionMode={selectionMode}
                                            trajectorySelectionMode={
                                                selectionMode === SWAP_SELECTIONS
                                            }
                                            selectObject={selectObjectCallback}
                                            selectedObjects={selectedObjects}
                                            addSelection={addSelectionCallback}
                                            selections={selections}
                                            updateGlobalScale={updateGlobalScale}
                                            globalScale={globalScale}
                                            showStateClustering={showStateClustering}
                                            showTop={showTop}
                                            expand={expand}
                                        />
                                    );
                                })}
                        </Stack>
                    </>
                )}
            </ChartBox>
            <Stack direction="row" gap={1}>
                <Box marginLeft={5} maxWidth="250px">
                    {stateHovered !== null && stateHovered !== undefined && (
                        <StateDetailView state={GlobalStates.get(stateHovered)} />
                    )}
                </Box>

                <Box
                    display="flex"
                    gap={1}
                    sx={{
                        // overflow: 'auto',
                        // gridTemplateColumns: 'repeat(2, 1fr)',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                    }}
                >
                    {Object.keys(selections.values).map((uuid) => {
                        const selection = selections.values[uuid];
                        const { extent, trajectoryName } = selection;

                        const ids = extent.map((d) => d.id);
                        const timesteps = extent.map((d) => d.timestep);

                        // check if start and end timesteps are at least within some chunk of the trajectory
                        const t = trajectories[trajectoryName];
                        const disabled = t.isTimestepsWithinChunks(timesteps);

                        return (
                            <SubSequenceView
                                onMouseEnter={(activeState) => {
                                    setCurrentSelection({ id: uuid, activeState });
                                    setStateHovered(activeState);
                                }}
                                onMouseLeave={() => setCurrentSelection(null)}
                                disabled={disabled}
                                trajectoryName={trajectoryName}
                                stateIDs={ids}
                                timesteps={timesteps}
                                properties={properties}
                                globalScale={globalScale}
                                deleteFunc={() => {
                                    setCurrentSelection(null);
                                    deleteExtents(uuid);
                                }}
                                sx={{ flex: 1 }}
                            />
                        );
                    })}
                </Box>
            </Stack>
            <TransferListModal
                open={currentModal === MULTIVARIATE_CHART_MODAL}
                title="Create Multivariate Chart"
                options={properties}
                onSubmit={(chosen) => {
                    reducePropertyCombos({ type: 'create', payload: chosen });
                    setCurrentModal(null);
                }}
                handleClose={() => setCurrentModal(null)}
            />

            {/* equivalent to (condition) ? true : false; do this to get rid of annoying open prop is null error */}
            <Menu
                open={!!(anchorEl && anchorEl.id === 'findSimilarButton')}
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
            >
                {/* call with corresponding similarity function */}
                <MenuItem
                    onClick={() => {
                        startSelection(FIND_SIMILAR_SELECT, (selection) =>
                            findSimilar(chunkSimilarity, percentToString, selection)
                        );
                        setAnchorEl(null);
                    }}
                    dense
                    divider
                >
                    Unique state set comparison
                </MenuItem>
                <MenuItem
                    onClick={() => {
                        startSelection(FIND_SIMILAR_SELECT, (selection) =>
                            findSimilar(stateRatioChunkSimilarity, percentToString, selection)
                        );
                        setAnchorEl(null);
                    }}
                    dense
                >
                    State ratio comparison
                </MenuItem>
                <MenuItem
                    disabled
                    onClick={() => {
                        startSelection(FIND_SIMILAR_SELECT, (selection) =>
                            findSimilar(
                                (a, b) => {
                                    const aStates = a.states.map((id) => GlobalStates.get(id));
                                    const bStates = b.states.map((id) => GlobalStates.get(id));
                                    // for which property?
                                    return zTest(
                                        aStates.map((d) => d[properties]),
                                        bStates.map((d) => d[properties])
                                    );
                                },
                                (a) => `${a.toFixed(3)}`,
                                selection
                            )
                        );
                        setAnchorEl(null);
                    }}
                >
                    Z-score
                </MenuItem>
            </Menu>
            <Menu
                open={!!(anchorEl && anchorEl.id === 'showTopButton')}
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
            >
                <MenuItem>
                    <TextField
                        type="number"
                        inputProps={{
                            min: 1,
                            max: properties.length,
                            inputMode: 'numeric',
                            pattern: '[0-9]*',
                        }}
                        focused
                        value={showTop}
                        onChange={(e) => {
                            setShowTop(parseInt(e.target.value, 10));
                        }}
                        label={`Show top ${showTop} properties`}
                    />
                </MenuItem>
            </Menu>
        </Box>
    );
}
