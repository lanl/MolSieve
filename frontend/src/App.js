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

import VisArea from './components/VisArea';
import { apiLoadTrajectory, apiGetScriptProperties, apiGetVisScripts } from './api/ajax';
import ControlDrawer from './components/ControlDrawer';
import { createUUID } from './api/math/random';

import { calculateGlobalUniqueStates, addProperties } from './api/states';
import { addTrajectory, simplifySet, recluster } from './api/trajectories';

import { wsConnect } from './api/websocketmiddleware';

import WebSocketManager from './api/websocketmanager';

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
    recalculate_clustering = (name, clusters) => {
        return new Promise((_, reject) => {
            const { enqueueSnackbar, dispatch } = this.props;
            enqueueSnackbar(`Recalculating clustering for trajectory ${name}...`);
            dispatch(recluster({ name, clusters }))
                .unwrap()
                .catch((e) => {
                    enqueueSnackbar(`Reclustering trajectory ${name} failed: ${e.message}`, {
                        variant: 'error',
                    });
                    reject(e);
                });
        });
    };

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
                const { properties } = this.state;
                const { current_clustering: currentClustering, simplified, uniqueStates } = data;

                dispatch(
                    calculateGlobalUniqueStates({
                        newUniqueStates: uniqueStates,
                        run,
                    })
                );

                dispatch(
                    addTrajectory({
                        name: run,
                        id: createUUID(),
                        chunkingThreshold,
                        currentClustering,
                        newChunks: simplified,
                        properties,
                    })
                );

                dispatch(wsConnect(`${WS_URL}/api/load_properties_for_subset`));
                enqueueSnackbar(`Trajectory ${run} successfully loaded.`);
            })
            .catch((e) => alert(`${e}`));
    };

    simplifySet = (run, threshold) => {
        const { enqueueSnackbar, dispatch } = this.props;

        enqueueSnackbar(`Re-simplifying trajectory ${run}...`);
        dispatch(simplifySet({ name: run, threshold }));
        enqueueSnackbar(`Sequence re-simplified for trajectory ${run}.`);
    };

    toggleDrawer = () => {
        this.setState((prevState) => ({ drawerOpen: !prevState.drawerOpen }));
    };

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
        const { trajectoryNames } = this.props;
        const { properties, drawerOpen, showRunList, currentModal, run, visScripts } = this.state;
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
                        MolSieve
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
                    {trajectoryNames.length > 0 && (
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
                    trajectories={trajectoryNames}
                    properties={properties}
                    visScripts={visScripts}
                    sx={{
                        width: drawerOpen ? `calc(100% - 300px)` : `100%`,
                    }}
                />

                {trajectoryNames.length > 0 && (
                    <ControlDrawer
                        sx={{ width: '300px', boxSizing: 'border-box' }}
                        trajectoryNames={trajectoryNames}
                        recalculateClustering={this.recalculate_clustering}
                        simplifySet={this.simplifySet}
                        drawerOpen={drawerOpen}
                        setZoom={this.setZoomProp}
                        toggleDrawer={this.toggleDrawer}
                        addFilter={this.addFilter}
                        propagateChange={this.propagateChange}
                    />
                )}

                <AjaxMenu
                    anchorEl={this.runListButton.current}
                    api_call={`${API_URL}/api/get_run_list`}
                    open={showRunList}
                    clicked={trajectoryNames}
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

export default connect((state) => ({
    trajectoryNames: state.trajectories.names,
}))(withSnackbar(App));
