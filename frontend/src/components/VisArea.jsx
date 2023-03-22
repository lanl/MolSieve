import { React, useState, useEffect, useReducer, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import IconButton from '@mui/material/IconButton';
import ViewListIcon from '@mui/icons-material/ViewList';
import CompareIcon from '@mui/icons-material/Compare';
import FindInPageIcon from '@mui/icons-material/FindInPage';
import LibraryAddIcon from '@mui/icons-material/LibraryAdd';
import SwapVertIcon from '@mui/icons-material/SwapVert';

import InvertColorsIcon from '@mui/icons-material/InvertColors';

import ClearAllIcon from '@mui/icons-material/ClearAll';
import CameraAltIcon from '@mui/icons-material/CameraAlt';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';

import { useSnackbar } from 'notistack';
import * as d3 from 'd3';

import TrajectoryChart from '../vis/TrajectoryChart';
import ChartBox from './ChartBox';
import StateDetailView from './StateDetailView';
import TransferListModal from '../modals/TransferListModal';
import '../css/App.css';

import ComparisonView from './ComparisonView';
import SelectionComparisonView from './SelectionComparisonView';
import SubSequenceView from './SubSequenceView';

import usePrevious from '../hooks/usePrevious';
import {
    chunkSimilarity,
    stateRatioChunkSimilarity,
    percentToString,
    tooltip,
    focusChart,
    unFocusCharts,
} from '../api/myutils';
import { createUUID } from '../api/math/random';

import { getAllImportantStates, getAllVisibleChunks, swapPositions } from '../api/trajectories';

import { clearClusterStates, clusterStates } from '../api/states';

const MULTIVARIATE_CHART_MODAL = 'multivariate_chart';

const NO_SELECT = 0;
const FIND_SIMILAR_SELECT = 1;
const CLEAR_SELECTION = 2;
const SWAP_SELECTIONS = 3;
const CHUNK_SELECT = 4;
// index with current selection mode to determine how many chunks should be selected
// for a valid selection
const SELECTION_LENGTH = [0, 1, 3, 2, 2, 2];

export default function VisArea({
    trajectories,
    properties,
    sx,
    visScripts,
    simplifySet,
    recalculateClustering,
}) {
    const [currentModal, setCurrentModal] = useState(null);
    const [activeState, setActiveState] = useState(null);

    const dispatch = useDispatch();

    const [selectionMode, setSelectionMode] = useState(NO_SELECT);
    const [selectedObjects, setSelectedObjects] = useState([]);

    const [anchorEl, setAnchorEl] = useState(null);
    const showStateClustering = useSelector((state) => state.states.colorByStateCluster);

    const [toolTipList, setToolTipList] = useState([]);
    const oldToolTipList = usePrevious(toolTipList);

    const [showTop, setShowTop] = useState(4);
    const [visScript, setVisScript] = useState('default.py');

    const [comparisonSelections, setComparisonSelections] = useReducer((state, action) => {
        switch (action.type) {
            case 'add':
                return { ...state, [createUUID()]: action.payload };
            case 'delete': {
                const { [action.payload]: _, ...rest } = state;
                return rest;
            }
            default:
                throw new Error('Unknown action');
        }
    }, {});

    const addComparison = (selection, selectionType) => {
        setComparisonSelections({ type: 'add', payload: { selection, selectionType } });
    };

    const removeComparison = (uuid) => {
        setComparisonSelections({ type: 'delete', payload: uuid });
    };

    const { enqueueSnackbar } = useSnackbar();

    const [selections, setSelections] = useReducer((state, action) => {
        switch (action.type) {
            case 'create': {
                const id = createUUID();
                return {
                    ...state,
                    [id]: { ...action.payload, id },
                };
            }
            case 'delete': {
                const { [action.payload]: _, ...rest } = state;
                return rest;
            }
            default:
                throw new Error('Unknown action');
        }
    }, {});

    const addSelection = (extent, trajectoryName, originalExtent, brushValues) => {
        setSelections({
            type: 'create',
            payload: { extent, trajectoryName, originalExtent, brushValues },
        });
    };

    const deleteSelection = (id) => {
        setSelections({ type: 'delete', payload: id });
    };

    const addSelectionCallback = useCallback(addSelection, []);

    const [propertyCombos, reducePropertyCombos] = useReducer((state, action) => {
        switch (action.type) {
            case 'create': {
                const id = createUUID();
                //            updateGlobalScale({ type: 'create', payload: id });
                return [...state, { id, properties: action.payload }];
            }
            default:
                throw new Error('Unknown action');
        }
    }, []);

    /**
     * Gets all visible chunks across all trajectories.
     *
     * @returns {Array<Chunk>} All chunks visible on the screen
     */

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
        dispatch(clearClusterStates);
    }, [JSON.stringify(trajectories)]);

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

    const selectObject = (o) => {
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

    const selectObjectCallback = useCallback(selectObject, [selectionMode, selectedObjects.length]);

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

    const visible = useSelector((state) => getAllVisibleChunks(state));
    const allStates = useSelector((state) => getAllImportantStates(state));

    const findSimilar = (chunkSimilarityFunc, formatFunc, selection) => {
        // compare all chunks to the one that was selected
        const selected = selection[0];
        focusChart(selected.id);

        const v = visible.filter((d) => d.id !== selected.id && d.important);
        const similarities = {};
        for (const vc of v) {
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
            <ChartBox sx={{ marginBottom: '5px' }}>
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
                            <Tooltip title="Compare chunks / selections" arrow>
                                <IconButton
                                    size="small"
                                    color={selectionMode !== CHUNK_SELECT ? 'secondary' : 'default'}
                                    onClick={() => {
                                        startSelection(CHUNK_SELECT, (selection) => {
                                            // check if selection is all one type
                                            const types = selection.map(
                                                (obj) => obj.constructor.name
                                            );

                                            const allEqual = types.every((val) => val === types[0]);

                                            if (allEqual) {
                                                const type =
                                                    types[0] === 'Chunk' ? 'Chunk' : 'Selection';
                                                addComparison(selection, type);
                                            } else {
                                                enqueueSnackbar(
                                                    'Cannot mix selections. Please choose either only selections or only chunks.',
                                                    {
                                                        variant: 'error',
                                                    }
                                                );
                                            }
                                        });
                                        d3.selectAll('.selected').classed('selected', false);
                                    }}
                                >
                                    <CompareIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Find similar regions" arrow>
                                <IconButton
                                    color={
                                        selectionMode !== FIND_SIMILAR_SELECT
                                            ? 'secondary'
                                            : 'default'
                                    }
                                    size="small"
                                    onClick={(e) =>
                                        selectionMode !== FIND_SIMILAR_SELECT
                                            ? startSelection(FIND_SIMILAR_SELECT, () => {})
                                            : setAnchorEl(e.currentTarget)
                                    }
                                    id="findSimilarButton"
                                >
                                    <FindInPageIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Swap selections" arrow>
                                <IconButton
                                    color={
                                        selectionMode !== SWAP_SELECTIONS ? 'secondary' : 'default'
                                    }
                                    size="small"
                                    onClick={() =>
                                        startSelection(SWAP_SELECTIONS, (selection) => {
                                            dispatch(
                                                swapPositions({
                                                    a: selection[0].name,
                                                    b: selection[1].name,
                                                })
                                            );
                                        })
                                    }
                                >
                                    <SwapVertIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip
                                title={
                                    showStateClustering
                                        ? 'Color states by ID'
                                        : 'Color states by structural properties'
                                }
                                arrow
                            >
                                <IconButton
                                    color="secondary"
                                    size="small"
                                    onClick={() =>
                                        !showStateClustering
                                            ? dispatch(
                                                  clusterStates({
                                                      properties,
                                                      stateIDs: allStates,
                                                  })
                                              )
                                            : dispatch(clearClusterStates())
                                    }
                                >
                                    <InvertColorsIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Add multivariate chart" arrow>
                                <IconButton
                                    color="secondary"
                                    size="small"
                                    onClick={() => setCurrentModal(MULTIVARIATE_CHART_MODAL)}
                                >
                                    <LibraryAddIcon />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Change state visualization script" arrow>
                                <IconButton
                                    color="secondary"
                                    size="small"
                                    onClick={(e) => setAnchorEl(e.currentTarget)}
                                    id="changeVisScriptButton"
                                >
                                    <CameraAltIcon />
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

                        <Stack direction="column" spacing={1}>
                            {trajectories.map((trajectory) => {
                                return (
                                    <TrajectoryChart
                                        key={trajectory}
                                        width={width}
                                        height={(showTop + propertyCombos.length) * 50 + 50}
                                        scatterplotHeight={50}
                                        trajectoryName={trajectory}
                                        setStateHovered={setActiveState}
                                        properties={properties}
                                        propertyCombos={propertyCombos}
                                        chunkSelectionMode={selectionMode}
                                        selectObject={selectObjectCallback}
                                        addSelection={addSelectionCallback}
                                        selectedObjects={selectedObjects}
                                        selections={selections}
                                        showTop={showTop}
                                        simplifySet={simplifySet}
                                        recalculateClustering={recalculateClustering}
                                    />
                                );
                            })}
                        </Stack>
                    </>
                )}
            </ChartBox>
            <Stack direction="row" gap={1}>
                <Box marginLeft={5} minWidth="225px">
                    {activeState !== null && activeState !== undefined && (
                        <StateDetailView stateID={activeState} visScript={visScript} />
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
                    {Object.keys(selections).map((uuid) => {
                        const selection = selections[uuid];
                        const { extent, trajectoryName } = selection;

                        const ids = extent.map((d) => d.id);
                        const timesteps = extent.map((d) => d.timestep);

                        // check if start and end timesteps are at least within some chunk of the trajectory
                        // const t = trajectories[trajectoryName];
                        // const disabled = t.isTimestepsWithinChunks(timesteps);

                        return (
                            <SubSequenceView
                                key={uuid}
                                onMouseEnter={() => {
                                    d3.selectAll(`rect.${uuid}`).classed('selected', true);
                                }}
                                onMouseLeave={() => {
                                    d3.selectAll(`rect.${uuid}`).classed('selected', false);
                                }}
                                onClick={(e) => {
                                    if (selectionMode === CHUNK_SELECT) {
                                        selectObject(selection);
                                        const selected = d3
                                            .select(e.currentTarget)
                                            .classed('selected');
                                        d3.select(e.currentTarget).classed('selected', !selected);
                                    }
                                }}
                                className={uuid}
                                id={uuid}
                                onElementClick={(state) => setActiveState(state)}
                                // disabled={disabled}
                                trajectoryName={trajectoryName}
                                stateIDs={ids}
                                timesteps={timesteps}
                                visScript={visScript}
                                properties={properties}
                                deleteFunc={() => {
                                    deleteSelection(uuid);
                                }}
                                sx={{ flex: 1 }}
                            />
                        );
                    })}
                    {Object.keys(comparisonSelections)
                        .filter((uuid) => {
                            const { selectionType } = comparisonSelections[uuid];
                            return selectionType === 'Chunk';
                        })
                        .map((uuid) => {
                            const { selection } = comparisonSelections[uuid];
                            return (
                                <ComparisonView
                                    properties={properties}
                                    selection={selection}
                                    deleteFunc={() => removeComparison(uuid)}
                                />
                            );
                        })}
                    {Object.keys(comparisonSelections)
                        .filter((uuid) => {
                            const { selectionType } = comparisonSelections[uuid];
                            return selectionType === 'Selection';
                        })
                        .map((uuid) => {
                            const { selection } = comparisonSelections[uuid];
                            return (
                                <SelectionComparisonView
                                    selections={selection}
                                    onStateClick={(id) => setActiveState(id)}
                                    deleteFunc={() => removeComparison(uuid)}
                                    visScript={visScript}
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

            <Menu
                open={!!(anchorEl && anchorEl.id === 'changeVisScriptButton')}
                anchorEl={anchorEl}
                onClose={() => setAnchorEl(null)}
            >
                {visScripts.map((vs) => (
                    <MenuItem
                        onClick={() => {
                            setVisScript(vs);
                            setAnchorEl(null);
                        }}
                        dense
                        divider
                    >
                        {vs === visScript && <b>{vs}</b>}
                        {vs !== visScript && vs}
                    </MenuItem>
                ))}
            </Menu>
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
                        /* startSelection(FIND_SIMILAR_SELECT, (selection) =>
                            findSimilar(
                                (a, b) => {
                                    const aStates = a.states.map((id) => States.get(id));
                                    const bStates = b.states.map((id) => States.get(id));
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
                        setAnchorEl(null) */
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
