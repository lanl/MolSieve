import React from 'react';
import './css/App.css';
import Box from '@mui/material/Box';
import Toolbar from '@mui/material/Toolbar';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import MenuIcon from '@mui/icons-material/Menu';

import * as d3 from 'd3';
import { withSnackbar } from 'notistack';
import AjaxMenu from './components/AjaxMenu';
import LoadRunModal from './modals/LoadRunModal';
import LoadingModal from './modals/LoadingModal';
import Trajectory from './api/trajectory';
import FilterBuilder from './api/FilterBuilder';
import VisArea from './components/VisArea';
import {
    api_load_metadata,
    api_load_property,
    apiLoadTrajectory,
    apiModifyTrajectory,
} from './api/ajax';
import ControlDrawer from './components/ControlDrawer';
import GlobalStates from './api/globalStates';
import { createUUID } from './api/random';

import WebSocketManager from './api/websocketmanager';
import ColorManager from './api/colormanager';

const RUN_MODAL = 'run_modal';

class App extends React.Component {
    constructor() {
        super();
        this.runListButton = React.createRef();
        this.state = {
            isLoading: false,
            currentModal: null,
            showRunList: false,
            drawerOpen: false,
            run: null,
            trajectories: {},
            runs: {},
            loadingMessage: 'Loading...',
            colors: new ColorManager(),
            properties: ['timestep', 'id'],
        };
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

    load_metadata = (run, newTraj) => {
        this.setState({
            isLoading: true,
            loadingMessage: `Loading metadata for ${run}...`,
        });
        return api_load_metadata(run, newTraj);
    };

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
            WebSocketManager.clear();

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
                        () => resolve()
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

                GlobalStates.calculateGlobalUniqueStates(data.uniqueStates, run);
                newTraj.simplifySet(data.simplified);

                const { trajectories, colors } = this.state;

                const trajColors = colors.request_colors(newTraj.current_clustering);
                newTraj.add_colors(trajColors);
                newTraj.position = Object.keys(trajectories).length;

                const newRuns = this.initFilters(run, newTraj);

                this.setState({
                    isLoading: false,
                    runs: newRuns,
                    trajectories: { ...trajectories, [run]: newTraj },
                    colors,
                    // properties: [...new Set([...this.state.properties, ...properties])],
                });
            })
            .catch((e) => alert(e));
    };

    initFilters = (run, newTraj) => {
        const { runs } = this.state;

        runs[run] = {
            current_clustering: newTraj.current_clustering,
            chunkingThreshold: newTraj.chunkingThreshold,
            extents: [0, newTraj.length],
        };

        const filters = {};

        const fb = new FilterBuilder();

        // filters.clustering_difference = fb.buildClusteringDifference();
        //    filters.chunks = fb.buildHideChunks();
        // filters.transitions = fb.buildTransitions();
        filters.fuzzy_membership = fb.buildFuzzyMemberships();

        runs[run].filters = filters;

        return runs;
    };

    setProperties = (newProperties) => {
        const { properties } = this.state;
        // if old has something that new doesn't, there was a removal
        const removed = properties.filter((x) => !newProperties.includes(x));

        // if new has something that old doesn't, there was an addition
        const added = newProperties.filter((x) => !properties.includes(x));

        if (added.length > 0) {
            api_load_property(added[0]).then((data) => {
                GlobalStates.addPropToStates(data);
                this.setState((prevState) => ({
                    properties: [...prevState.properties, added[0]],
                }));
                this.props.enqueueSnackbar(`Property ${added[0]} loaded.`);
            });
        } else {
            const propertiesCopy = [...this.state.properties];
            for (const r of removed) {
                GlobalStates.removePropFromStates(r);
                const idx = propertiesCopy.indexOf(r);
                propertiesCopy.splice(idx, 1);
            }

            this.setState({
                properties: propertiesCopy,
            });
        }
    };

    updateRun = (run, attribute, value) => {
        const { runs } = this.state;
        runs[run][attribute] = value;
        this.setState({ runs: { ...runs } });
    };

    simplifySet = (run, threshold) => {
        WebSocketManager.clear();
        const { trajectories } = this.state;
        const { [run]: newTraj } = trajectories;

        apiModifyTrajectory(run, newTraj.current_clustering, threshold).then((data) => {
            newTraj.simplifySet(data.simplified);
            newTraj.chunkingThreshold = threshold;
            this.setState((prevState) => ({
                trajectories: { ...prevState.trajectories, [run]: newTraj },
            }));
        });
    };

    toggleDrawer = () => {
        this.setState((prevState) => ({ drawerOpen: !prevState.drawerOpen }));
    };

    swapPositions = (a, b) => {
        // swap the position variables of the two trajectories
        const temp = a.position;
        a.position = b.position;
        b.position = temp;

        this.setState((prevState) => ({
            trajectories: { ...prevState.trajectories, [a.name]: a, [b.name]: b },
        }));
    };

    addFilter = (state) => {
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
    };

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
            isLoading,
            loadingMessage,
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

                {Object.keys(trajectories).length > 0 && (
                    <ControlDrawer
                        trajectories={trajectories}
                        runs={runs}
                        updateRun={this.updateRun}
                        recalculateClustering={this.recalculate_clustering}
                        simplifySet={this.simplifySet}
                        drawerOpen={drawerOpen}
                        toggleDrawer={this.toggleDrawer}
                        addFilter={this.addFilter}
                        propagateChange={this.propagateChange}
                        properties={properties}
                        setProperties={this.setProperties}
                        setExtent={this.setExtent}
                    />
                )}

                <VisArea
                    trajectories={trajectories}
                    runs={runs}
                    properties={properties}
                    swapPositions={this.swapPositions}
                />

                <AjaxMenu
                    anchorEl={this.runListButton.current}
                    api_call="/api/get_run_list"
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

                {isLoading && <LoadingModal open={isLoading} title={loadingMessage} />}
            </Box>
        );
    }
}
export default withSnackbar(App);
