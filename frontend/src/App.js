import React from 'react';
import './css/App.css';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import AjaxMenu from './components/AjaxMenu';
import LoadRunModal from './modals/LoadRunModal';
import LoadingModal from './modals/LoadingModal';
import Trajectory from './api/trajectory';
import FilterBuilder from './api/FilterBuilder';
import VisArea from './components/VisArea';
import MenuIcon from '@mui/icons-material/Menu';
import { api_loadPCCA, api_loadSequence, api_load_metadata, api_load_property, api_calculate_idToTimestep } from './api/ajax';
import ControlDrawer from './components/ControlDrawer';
import { withSnackbar } from 'notistack';

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
            colors: ['#4e79a7','#f28e2c','#e15759','#76b7b2','#59a14f','#edc949','#af7aa1','#ff9da7','#9c755f','#bab0ab'],
            globalUniqueStates: new Map(),
            commonList: new Map(),
            properties: []
        };
    }
    
    toggleModal = (key) => {
        if (this.state.currentModal) {
            this.setState({
                ...this.state,
                currentModal: null,
            });
            return;
        }

        this.setState({ ...this.state, currentModal: key });
    };

    selectRun = (v) => {
        this.setState({
            run: v,
            currentModal: RUN_MODAL,
        });
    };

    removeRun = (v) => {
        const trajectories = this.state.trajectories;
        delete this.state.trajectories[v];
        this.setState({ trajectories: trajectories });
    }

    /** Wrapper for the backend call in api.js */
    load_PCCA = (run, clusters, optimal, m_min, m_max, trajectory) => {
        this.setState({
            isLoading: true,
            loadingMessage: `Calculating PCCA for ${run}...`,
        });

        if (m_min === undefined) m_min = 0;
        if (m_max === undefined) m_max = 0;

        return api_loadPCCA(run, clusters, optimal, m_min, m_max, trajectory);
    };

    /** Wrapper for the backend call in api.js */
    load_sequence = (run, properties, new_traj) => {
        this.setState({
            isLoading: true,
            loadingMessage: `Loading sequence for ${run}...`,
        });
        return api_loadSequence(run, properties, new_traj);
    };

    load_metadata = (run, new_traj) => {
        this.setState({
            isLoading: true,
            loadingMessage: `Loading metadata for ${run}...`,
        });
        return api_load_metadata(run, new_traj);
    };

    /** Function called by the PCCA slider allocated for each run. Reruns the PCCA for however many clusters the user specifies
     *  @param {string} run - Run to recalculate the clustering for
     *  @param {number} clusters - Number of clusters to split the trajectory into.
     */
    recalculate_clustering = (run, clusters) =>
        // first check if the state has that clustering already calculated
        new Promise((resolve, reject) => {
            const current_traj = this.state.trajectories[run];

            if (current_traj.feasible_clusters.includes(clusters)) {
                const new_trajectories = {
                    ...this.state.trajectories,
                };
                new_trajectories[run].current_clustering = clusters;
                new_trajectories[run].set_cluster_info();

                new_trajectories[run].simplifySet(new_trajectories[run].chunkingThreshold);
                this.setState({ trajectories: new_trajectories });
                resolve(true);
            } else {
                // if not, recalculate
                this.load_PCCA(
                    run,
                    clusters,
                    -1,
                    0,
                    0,
                    this.state.trajectories[run],
                )
                    .then((traj) => {
                        const new_trajectories = {
                            ...this.state.trajectories,
                        };
                        traj.add_colors(this.state.colors, clusters);
                        traj.simplifySet(new_trajectories[run].chunkingThreshold);
                        new_trajectories[run] = traj;
                        this.setState({
                            isLoading: false,
                            trajectories: new_trajectories,
                        });
                        resolve(true);
                    })
                    .catch((e) => {
                        this.setState({ isLoading: false });
                        alert(e);
                        reject(false);
                    });
            }
        })
        ;

    /** Creates a new trajectory object and populates it with data from the database
     * @param {string} run - Which run this trajectory object will correspond to
     * @param {number} clusters - Number of clusters to cluster the trajectory into. Ignored if optimal = 1
     * @param {number} optimal - Whether or not PCCA should try and find the optimal clustering between m_min and m_max
     * @param {number} m_min - When running optimal clustering, minimal cluster size to try; ignored if optimal = -1
     * @param {number} m_max - When running optimal clustering, maximum cluster size to try; ignored if optimal = -1
     * @param {Array<String>} properties - Properties of the trajectory to retrieve
     */
    load_trajectory = (run, clusters, optimal, m_min, m_max, properties, chunkingThreshold) => {
        this.load_sequence(run, properties)
            .then((data) => {
                const newTraj = new Trajectory();
                newTraj.sequence = Uint32Array.from(data.sequence);
                newTraj.uniqueStates = data.uniqueStates.map((state) => {
                    return state.id;
                });
                
                const newUniqueStates = this.calculateGlobalUniqueStates(data.uniqueStates, run);

                this.load_PCCA(run, clusters, optimal, m_min, m_max, newTraj)
                    .then((newTraj) => {
                        this.load_metadata(run, newTraj).then((newTraj) => {
                            api_calculate_idToTimestep(run, newTraj).then((newTraj) => {                                
                                newTraj.set_cluster_info();
                                // could be an option
                                newTraj.chunkingThreshold = chunkingThreshold;
                                newTraj.simplifySet(chunkingThreshold);
                                const removed = newTraj.set_colors(this.state.colors);
                                const newTrajectories = {
                                    ...this.state.trajectories,
                                };

                                newTrajectories[run] = newTraj;
                                const newColors = [...this.state.colors];
                                newColors.splice(0, removed);
                                
                                const newRuns = this.initFilters(run, newTraj);
                                this.setState({
                                    isLoading: false,
                                    runs: newRuns,
                                    trajectories: newTrajectories,
                                    colors: newColors,
                                    globalUniqueStates: newUniqueStates,
                                    properties: [...new Set([...this.state.properties, ...properties])]
                                });
                            });
                        });
                    });
            })
            .catch((e) => {
                alert(e);
            });
    };

    initFilters = (run, newTraj) => {
        let runs = { ...this.state.runs };

        runs[run] = {
            current_clustering: newTraj.current_clustering,
            chunkingThreshold: newTraj.chunkingThreshold,
        };

        const filters = {};

        const fb = new FilterBuilder();

        filters["clustering_difference"] = fb.buildClusteringDifference();
        filters["chunks"] = fb.buildHideChunks();
        filters["transitions"] = fb.buildTransitions();
        filters["fuzzy_membership"] = fb.buildFuzzyMemberships();


        runs[run]["filters"] = filters;

        return runs;
    }

    setProperties = (properties) => {
        // if old has something that new doesn't, there was a removal
        const removed = this.state.properties.filter(x => !properties.includes(x));       
        
        // if new has something that old doesn't, there was an addition
        const added = properties.filter(x => !this.state.properties.includes(x));

        let globalUniqueStates = this.state.globalUniqueStates;
        
        if(added.length > 0) {
            api_load_property(added[0])
                .then((data) => {                    
                    globalUniqueStates = this.addPropToStates(data, globalUniqueStates);
                    this.setState({properties: [...this.state.properties, added[0]],
                                   globalUniqueStates: globalUniqueStates});
                    this.props.enqueueSnackbar(`Property ${added[0]} loaded.`);

                });
        } else {
            let propertiesCopy = [...this.state.properties];
            for(const r of removed) {
                globalUniqueStates = this.removePropFromStates(r, globalUniqueStates);
                const idx = propertiesCopy.indexOf(r);
                propertiesCopy.splice(idx,1);
            }

            this.setState({properties: propertiesCopy,
                           globalUniqueStates: globalUniqueStates});            
        }        
    }

    addPropToStates = (propertyList, globalUniqueStates) => {
        for (const prop of propertyList) {
            if (globalUniqueStates.has(prop.id)) {
                const previous = globalUniqueStates.get(prop.id);
                globalUniqueStates.set(prop.id, Object.assign(previous, prop));                
            } else {
                globalUniqueStates.set(prop.id, prop);
            }
        }
        return globalUniqueStates;
    }

    removePropFromStates = (prop, globalUniqueStates) => {
        for(let s of globalUniqueStates.values()) {
            if(s[prop] !== undefined && s[prop] !== null) {
                delete s[prop];
                globalUniqueStates.set(s.id, s);
            }
        }

        return globalUniqueStates;
    }
    
    calculateGlobalUniqueStates = (newUniqueStates, run) => {
        const globalUniqueStates = this.state.globalUniqueStates;
        for (const s of newUniqueStates) {
            if (globalUniqueStates.has(s.id)) {
                const previous = globalUniqueStates.get(s.id);
                previous.seenIn = [...previous.seenIn, run];
                globalUniqueStates.set(s.id, Object.assign(previous, s));
            }
            else {
                s.seenIn = [run];
                globalUniqueStates.set(s.id, s);
            }
        }
        return globalUniqueStates;
    }

    updateRun = (run, attribute, value) => {
        let runs = { ...this.state.runs };
        runs[run][attribute] = value;
        this.setState(runs);
    };

    simplifySet = (run, threshold) => {
        const new_traj = this.state.trajectories[run];
        new_traj.simplifySet(threshold);
        this.setState({ trajectories: {...this.state.trajectories, [run]: new_traj }});
    };

    toggleDrawer = () => {
        this.setState({ drawerOpen: !this.state.drawerOpen });
    }

    addFilter = (state) => {
        const runs = this.state.runs;
        const run = runs[state.run];
        const filters = run["filters"];

        // get us the ids of all the states in our simplified sequence
        const stateIds = this.state.trajectories[state.run].uniqueStates;
        const sequence = stateIds.map((state) => this.state.globalUniqueStates.get(state));

        const fb = new FilterBuilder();
        const filter = fb.buildCustomFilter(state.filter_type, state.attribute, sequence);

        filters[filter.id] = filter;

        run.filters = filters;
        runs[state.run] = run;
        this.setState({ runs: runs });
    };

    propagateChange = (filter) => {
        let runs = { ...this.state.runs };
        let this_filter = runs[filter.run]["filters"][filter.id];

        if (filter.options) {
            this_filter.options = filter.options;
        }

        this_filter.enabledFor = filter.enabledFor;

        this_filter.enabled = filter.enabled;

        runs[filter.run]["filters"][filter.id] = this_filter;
        this.setState({ runs: runs });
    };


    render() {
        return (
            <Box sx={{display:'flex', flexDirection: 'column'}}>
                <AppBar position="static">
                    <Toolbar>
                        <Typography
                            sx={{ flexGrow: 1 }}
                            variant="h6">Trajectory Visualization</Typography>
                        <Button
                            color="inherit"
                            ref={this.runListButton}
                            onClick={
                                () => {
                                    this.setState({ showRunList: !this.state.showRunList });
                                }
                            }
                        >Manage trajectories</Button>
                        {Object.keys(this.state.trajectories).length > 0 &&
                            <Button
                                color="inherit"
                                onClick={() => {
                                    this.toggleDrawer();
                                }}>
                                <MenuIcon />
                            </Button>}
                    </Toolbar>
                </AppBar>

                <VisArea
                    sx={{display:'flex', alignItems:'stretch', flex: 1}}
                    trajectories={this.state.trajectories}
                    globalUniqueStates={this.state.globalUniqueStates}
                    runs={this.state.runs}
                    properties={this.state.properties}
                />

               {Object.keys(this.state.trajectories).length > 0 && <ControlDrawer
                    trajectories={this.state.trajectories}
                    runs={this.state.runs}
                    updateRun={this.updateRun}
                    recalculate_clustering={this.recalculate_clustering}
                    simplifySet={this.simplifySet}
                    drawerOpen={this.state.drawerOpen}
                    toggleDrawer={this.toggleDrawer}
                    addFilter={this.addFilter}
                    propagateChange={this.propagateChange}
                    properties={this.state.properties}
                    setProperties={this.setProperties}
                                                                   />}

                 <AjaxMenu
                    anchorEl={this.runListButton.current}
                    api_call="/api/get_run_list"
                    open={this.state.showRunList}                    
                    clicked={Object.keys(this.state.trajectories)}
                    handleClose={() => { this.setState({ showRunList: !this.state.showRunList, anchorEl: null }) }}
                    click={(e, v) => {
                        this.setState({ showRunList: !this.state.showRunList },
                            () => {
                                if (e.target.checked) {
                                    this.selectRun(v);
                                } else {
                                    this.removeRun(v);
                                }
                            });
                    }}
                 />

                {this.state.currentModal === RUN_MODAL
                    && (
                        <LoadRunModal
                            run={this.state.run}
                            runFunc={this.load_trajectory}
                            isOpen={this.state.currentModal === RUN_MODAL}
                            closeFunc={() => this.toggleModal(RUN_MODAL)}
                            onRequestClose={() => this.toggleModal(RUN_MODAL)}
                        />
                    )}

                {this.state.isLoading && (
                    <LoadingModal
                        open={this.state.isLoading}
                        title={this.state.loadingMessage}
                    />
                )}
            </Box>
        );
    }
}
/*                  <h1>Trajectory Visualization</h1>
                  <h2>powered by React.js</h2>
                  <p>
                    Press CTRL to toggle the path selection brush.
                    Press Z to toggle the zoom brush. Double click
                    to reset zoom. Press and hold SHIFT to select
                    multiple paths. Right click to open a context menu.
                  </p>*/

export default withSnackbar(App);
