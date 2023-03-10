import React from 'react';

import { connect } from 'react-redux';

import './css/App.css';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import MenuIcon from '@mui/icons-material/Menu';

import { withSnackbar } from 'notistack';
import AjaxMenu from './components/AjaxMenu';
import LoadRunModal from './modals/LoadRunModal';
import Trajectory from './api/trajectory';
import VisArea from './components/VisArea';
import {
    apiLoadTrajectory,
    apiModifyTrajectory,
    apiGetScriptProperties,
    apiGetVisScripts,
} from './api/ajax';
import ControlDrawer from './components/ControlDrawer';
import { createUUID } from './api/math/random';
import { getNeighbors } from './api/myutils';

import { calculateGlobalUniqueStates, addProperties } from './api/states';
import { wsConnect } from './api/websocketmiddleware';

import WebSocketManager from './api/websocketmanager';
import ColorManager from './api/colormanager';

import { WS_URL, API_URL } from './api/constants';

const RUN_MODAL = 'run_modal';

class App extends React.Component {
    constructor() {
        super();
        WebSocketManager.addKey('selections');
        this.runListButton = React.createRef();

        this.state = {
            currentModal: null,
            showRunList: false,
            drawerOpen: false,
            run: null,
            trajectories: {},
            runs: {},
            colors: new ColorManager(),
            properties: [],
            visScripts: [],
        };
    }

    componentDidMount() {
        const { dispatch } = this.props;

        apiGetScriptProperties()
            .then((properties) => {
                apiGetVisScripts().then((scripts) => {
                    dispatch(addProperties(properties));
                    this.setState((prevState) => ({
                        properties: [...prevState.properties, ...properties],
                        visScripts: [...prevState.visScripts, ...scripts],
                    }));
                });
            })
            .catch((e) => alert(e));
    }

    toggleModal = (key) => {
        const { currentModal } = this.state;
        if (currentModal) {
            this.setState({
                currentModal: null,
            });
            return;
        }

        this.setState({ currentModal: key });
    };

    selectRun = (v) => {
        this.setState({
            run: v,
            currentModal: RUN_MODAL,
        });
    };

    removeRun = (v) => {
        const { trajectories } = this.state;
        delete trajectories[v];
        this.setState({ trajectories });
    };

    /* loadMetadata = (run, newTraj) => {
        return api_load_metadata(run, newTraj);
    }; */

    /** Function called by the PCCA slider allocated for each run.
     *  Reruns the PCCA for however many clusters the user specifies
     *  @param {string} run - Run to recalculate the clustering for
     *  @param {number} clusters - Number of clusters to split the trajectory into.
     */
    recalculate_clustering = (run, clusters) =>
        // first check if the state has that clustering already calculated
        new Promise((resolve, reject) => {
            const { trajectories, colors } = this.state;
            const { chunkingThreshold } = trajectories[run];
            WebSocketManager.clear(run);

            const { enqueueSnackbar } = this.props;
            enqueueSnackbar(`Recalculating clustering for trajectory ${run}...`);

            apiModifyTrajectory(run, clusters, chunkingThreshold)
                .then((data) => {
                    const currentTraj = trajectories[run];
                    const newColors = colors.request_colors(
                        clusters - currentTraj.current_clustering
                    );
                    currentTraj.current_clustering = clusters;
                    currentTraj.idToCluster = data.idToCluster;
                    currentTraj.simplifySet(data.simplified);
                    currentTraj.add_colors(newColors);
                    this.setState(
                        { trajectories: { ...trajectories, [run]: currentTraj }, colors },
                        () => {
                            enqueueSnackbar(`Clustering recalculated for trajectory ${run}...`);
                            resolve();
                        }
                    );
                })
                .catch((e) => {
                    reject(e);
                });
        });

    /**
     *  Creates a new trajectory object and populates it with data from the database
     *
     * @param {String} run - Name of the trajectory to load
     * @param {Number} mMin - Minimum cluster size to try
     * @param {Number} mMax - Maximum cluster size to try
     * @param {Number} chunkingThreshold - Simplification threshold
     */
    loadTrajectory = (run, mMin, mMax, chunkingThreshold) => {
        const { enqueueSnackbar, dispatch } = this.props;
        enqueueSnackbar(`Loading trajectory ${run}...`);

        apiLoadTrajectory(run, mMin, mMax, chunkingThreshold)
            .then((data) => {
                const newTraj = new Trajectory();
                newTraj.uniqueStates = data.uniqueStates;
                newTraj.name = run;
                newTraj.id = createUUID();
                newTraj.idToCluster = data.idToCluster;
                newTraj.feasible_clusters = data.feasible_clusters;
                newTraj.chunkingThreshold = chunkingThreshold;
                newTraj.current_clustering = data.current_clustering;

                const { trajectories, colors } = this.state;

                dispatch(
                    calculateGlobalUniqueStates({
                        newUniqueStates: data.uniqueStates,
                        run,
                    })
                );
                newTraj.simplifySet(data.simplified);

                const trajColors = colors.request_colors(newTraj.current_clustering);
                newTraj.add_colors(trajColors);
                newTraj.position = Object.keys(trajectories).length;

                const newRuns = this.initFilters(run, newTraj);

                WebSocketManager.addKey(run);
                this.setState(
                    {
                        runs: newRuns,
                        trajectories: { ...trajectories, [run]: newTraj },
                        colors,
                    },
                    () => {
                        dispatch(wsConnect(`${WS_URL}/api/load_properties_for_subset`));
                        enqueueSnackbar(`Trajectory ${run} successfully loaded.`);
                    }
                );
            })
            .catch((e) => alert(`${e}`));
    };

    initFilters = (run, newTraj) => {
        const { runs } = this.state;

        runs[run] = {
            current_clustering: newTraj.current_clustering,
            chunkingThreshold: newTraj.chunkingThreshold,
            extents: [0, newTraj.length],
        };

        const filters = {};

        // const fb = new FilterBuilder();

        // filters.clustering_difference = fb.buildClusteringDifference();
        //    filters.chunks = fb.buildHideChunks();
        // filters.transitions = fb.buildTransitions();
        // filters.fuzzy_membership = fb.buildFuzzyMemberships();

        runs[run].filters = filters;

        return runs;
    };

    updateRun = (run, attribute, value) => {
        const { runs } = this.state;
        runs[run][attribute] = value;
        this.setState({ runs: { ...runs } });
    };

    simplifySet = (run, threshold) => {
        WebSocketManager.clear(run);
        const { trajectories } = this.state;
        const { [run]: newTraj } = trajectories;

        const { enqueueSnackbar, dispatch } = this.props;

        enqueueSnackbar(`Re-simplifying trajectory ${run}...`);
        apiModifyTrajectory(run, newTraj.current_clustering, threshold).then((data) => {
            newTraj.simplifySet(data.simplified);
            newTraj.chunkingThreshold = threshold;

            dispatch(
                calculateGlobalUniqueStates({
                    newUniqueStates: data.uniqueStates,
                    run,
                })
            );

            this.setState(
                (prevState) => ({
                    trajectories: { ...prevState.trajectories, [run]: newTraj },
                }),
                () => {
                    enqueueSnackbar(`Sequence re-simplified for trajectory ${run}.`);
                    dispatch(wsConnect(`${WS_URL}/api/load_properties_for_subset`));
                }
            );
        });
    };

    /**
     * Expands the given chunk by the sliceSize provided. The left / right neighbors of the chunk are shortened.
     *
     */
    expand = (id, sliceSize, trajectory) => {
        const { chunkList, chunks } = trajectory;
        const chunk = chunks.get(id);
        const chunkIndex = chunkList.indexOf(chunk);

        const neighbors = getNeighbors(chunkList, chunkIndex);
        const [left, right] = neighbors;

        const loadNeighbors = (l, r) => {
            return new Promise((resolve, reject) => {
                if (l) {
                    l.loadSequence().then(() => {
                        if (r) {
                            r.loadSequence().then(() => resolve());
                        } else {
                            resolve();
                        }
                    });
                } else if (r) {
                    r.loadSequence().then(() => resolve());
                } else {
                    reject();
                }
            });
        };

        loadNeighbors(left, right)
            .then(() => {
                if (left) {
                    const leftVals = left.takeFromSequence(sliceSize, 'back');
                    chunk.addToSequence(leftVals, 'front');
                    chunks.set(left.id, left);
                    if (!left.sequence.length) {
                        chunks.delete(left.id);
                    }
                }

                if (right) {
                    const rightVals = right.takeFromSequence(sliceSize, 'front');
                    chunk.addToSequence(rightVals, 'back');
                    chunks.set(right.id, right);
                    if (!right.sequence.length) {
                        chunks.delete(right.id);
                    }
                }

                chunks.set(chunk.id, chunk);

                // previous state gets pushed down, which is why it doesn't update immediately
                this.setState((prevState) => ({
                    trajectories: { ...prevState.trajectories, [trajectory.name]: trajectory },
                }));
            })
            .catch(() => alert('No neighbors to expand into!'));
    };

    toggleDrawer = () => {
        this.setState((prevState) => ({ drawerOpen: !prevState.drawerOpen }));
    };

    swapPositions = (a, b) => {
        // swap the position variables of the two trajectories
        const temp = a.position;
        a.position = b.position; // eslint-disable-line
        b.position = temp; //eslint-disable-line

        this.setState((prevState) => ({
            trajectories: {
                ...prevState.trajectories,
                [a.name]: a,
                [b.name]: b,
            },
        }));
    };

    /* addFilter = (state) => {
        const { runs, trajectories } = this.state;
        const run = runs[state.run];
        const { filters } = run;

        // get us the ids of all the states in our simplified sequence
        const stateIds = trajectories[state.run].uniqueStates;
        const sequence = stateIds.map((s) => GlobalStates.get(s));

        const fb = new FilterBuilder();
        const filter = fb.buildCustomFilter(state.filter_type, state.attribute, sequence);

        filters[filter.id] = filter;

        run.filters = filters;
        runs[state.run] = run;
        this.setState({ runs: { ...runs } });
    }; */
    setZoom(name, values) {
        this.updateRun(name, 'extents', values);
    }

    setZoomProp = this.setZoom.bind(this);

    propagateChange = (filter) => {
        const { runs } = this.state;
        const thisFilter = runs[filter.run].filters[filter.id];

        if (filter.options) {
            thisFilter.options = filter.options;
        }

        thisFilter.enabledFor = filter.enabledFor;

        thisFilter.enabled = filter.enabled;

        runs[filter.run].filters[filter.id] = thisFilter;
        this.setState({ runs: { ...runs } });
    };

    render() {
        const {
            trajectories,
            runs,
            properties,
            drawerOpen,
            showRunList,
            currentModal,
            run,
            visScripts,
        } = this.state;
        return (
            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                <Toolbar
                    variant="dense"
                    sx={{
                        background: '#f8f9f9',
                        fontColor: '#394043',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.4)',
                    }}
                >
                    <Typography sx={{ flexGrow: 1 }} color="primary" variant="h6">
                        NeoMDWeb
                    </Typography>
                    <Button
                        color="primary"
                        ref={this.runListButton}
                        onClick={() => {
                            this.setState((prevState) => ({
                                showRunList: !prevState.showRunList,
                            }));
                        }}
                    >
                        Manage trajectories
                    </Button>
                    {Object.keys(trajectories).length > 0 && (
                        <Button
                            color="primary"
                            onClick={() => {
                                this.toggleDrawer();
                            }}
                        >
                            <MenuIcon />
                        </Button>
                    )}
                </Toolbar>
                <VisArea
                    trajectories={trajectories}
                    runs={runs}
                    swapPositions={this.swapPositions}
                    expand={this.expand}
                    properties={properties}
                    visScripts={visScripts}
                    sx={{
                        width: drawerOpen ? `calc(100% - 300px)` : `100%`,
                    }}
                    setZoom={this.setZoomProp}
                />

                {Object.keys(trajectories).length > 0 && (
                    <ControlDrawer
                        sx={{ width: '300px', boxSizing: 'border-box' }}
                        trajectories={trajectories}
                        runs={runs}
                        updateRun={this.updateRun}
                        recalculateClustering={this.recalculate_clustering}
                        simplifySet={this.simplifySet}
                        drawerOpen={drawerOpen}
                        toggleDrawer={this.toggleDrawer}
                        addFilter={this.addFilter}
                        propagateChange={this.propagateChange}
                    />
                )}

                <AjaxMenu
                    anchorEl={this.runListButton.current}
                    api_call={`${API_URL}/api/get_run_list`}
                    open={showRunList}
                    clicked={Object.keys(trajectories)}
                    handleClose={() => {
                        this.setState({
                            showRunList: !showRunList,
                        });
                    }}
                    click={(e, v) => {
                        this.setState({ showRunList: !showRunList }, () => {
                            if (e.target.checked) {
                                this.selectRun(v);
                            } else {
                                this.removeRun(v);
                            }
                        });
                    }}
                />

                {currentModal === RUN_MODAL && (
                    <LoadRunModal
                        run={run}
                        runFunc={this.loadTrajectory}
                        isOpen={currentModal === RUN_MODAL}
                        closeFunc={() => this.toggleModal(RUN_MODAL)}
                        onRequestClose={() => this.toggleModal(RUN_MODAL)}
                    />
                )}
            </Box>
        );
    }
}

export default connect((state) => ({ states: state }))(withSnackbar(App));
