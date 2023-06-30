import { React, useState, useEffect, useReducer, useCallback, startTransition } from 'react';
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

/**
 * Main view of the system. Contains all visual components.
 *
 * @param {Array<String>} trajectories - Names of the trajectories to render.
 * @param {Array<String>} properties - Properties currently loaded in the system.
 * @param {Array<String>} visScripts - The visualization scripts available to the user.
 * @param {Function} simplifySet - Function to simplify trajectory.
 * @param {Function} recalculateClustering - Function to recalculate PCCA clustering count.
 */
export default function VisArea({
    trajectories,
    properties,
    sx,
    visScripts,
    simplifySet,
    recalculateClustering,
}) {
    const [currentModal, setCurrentModal] = useState(null); // TODO: can be just one modal
    const [activeState, setActiveState] = useState(null); // currently clicked state

    const dispatch = useDispatch();

    const [selectionMode, setSelectionMode] = useState(NO_SELECT); // are we currently selecting anything?
    const [selectedObjects, setSelectedObjects] = useState([]);

    const [anchorEl, setAnchorEl] = useState(null);
    const colorState = useSelector((state) => state.states.colorState);

    const [toolTipList, setToolTipList] = useState([]); // list of current tooltips, used in find similar
    const oldToolTipList = usePrevious(toolTipList);

    const [showTop, setShowTop] = useState(4); // number of currently visible properties
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
        console.log(selectionType);
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
                return [...state, { id, properties: action.payload }];
            }
            case 'delete': {
                return state.filter((d) => d.id !== action.payload);
            }
            case 'pop': {
                return state.slice(1);
            }
            default:
                throw new Error('Unknown action');
        }
    }, []); // creates multi-variate charts

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

    const selectObjectCallback = useCallback(
        (o) => selectObject(o),
        [selectionMode, selectedObjects.length]
    );

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

    // TODO: move?
    const findSimilar = (chunkSimilarityFunc, formatFunc, selection) => {
        // compare all chunks to the one that was selected
        const selected = selection[0];
        focusChart(selected.id);

        const v = visible.filter((d) => d.id !== selected.id && d.important);
        const similarities = {};
        for (const vc of v) {
            const sim = chunkSimilarityFunc(selected, vc);
            similarities[`chunk_${vc.id}`] = sim;
        }

        const charts = document.querySelectorAll('rect.important');
        const ttList = [];
        // const oScale = d3.scaleLinear().domain([minS, maxS]).range([0, 1]);
        for (let i = 0; i < charts.length; i++) {
            const chart = charts[i];
            if (similarities[chart.id] !== undefined) {
                // chart.style.opacity = `${oScale(similarities[chart.id])}`;
                if (similarities[chart.id] > 0.05) {
                    const tt = tooltip(chart, formatFunc(similarities[chart.id]), {
                        allowHTML: true,
                        arrow: true,
                        theme: 'translucent',
                        placement: 'top',
                    });
                    ttList.push(tt);
                }
            }
        }

        setToolTipList(ttList);
    };

    // TODO: move toolbar to seperate component?
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
                            <Tooltip title="Compare regions / sub-regions" arrow>
                                <IconButton
                                    size="small"
                                    color={selectionMode !== CHUNK_SELECT ? 'secondary' : 'default'}
                                    onClick={() => {
                                        startSelection(CHUNK_SELECT, (selection) => {
                                            // check if selection is all one type
                                            // bad, but better than obj.constructor.name
                                            const types = selection.map(
                                                (obj) => obj.color !== null && obj.color !== undefined
                                            );

                                            const allEqual = types.every((val) => val === types[0]);

                                            if (allEqual) {
                                                const type =
                                                    types[0] ? 'Chunk' : 'Selection';
                                                addComparison(selection, type);
                                            } else {
                                                enqueueSnackbar(
                                                    'Cannot mix selections. Please choose either only selections or regions.',
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
                                            ? startSelection(FIND_SIMILAR_SELECT, () => { })
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
                                    colorState
                                        ? 'Color states by structural properties'
                                        : 'Color states by ID'
                                }
                                arrow
                            >
                                <IconButton
                                    color="secondary"
                                    size="small"
                                    onClick={() =>
                                        !colorState
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
                            {trajectories.map((trajectory) => (
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
                            ))}
                        </Stack>
                    </>
                )}
            </ChartBox>
            <Stack direction="row" gap={1}>
                <Box marginLeft={5} minWidth="190px">
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
                        key={vs}
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
                            startTransition(() => setShowTop(parseInt(e.target.value, 10)));
                        }}
                        label={`Show top ${showTop} properties`}
                    />
                </MenuItem>
            </Menu>
        </Box>
    );
}
