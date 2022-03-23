import React from 'react';
import './css/App.css';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import CheckboxTable from './components/CheckboxTable';
import LoadRunModal from './modals/LoadRunModal';
import LoadingModal from './modals/LoadingModal';
import Trajectory from './api/trajectory';
import VisGrid from './components/VisGrid';
import { api_loadPCCA, api_loadSequence, api_load_metadata } from './api/ajax';

const RUN_MODAL = 'run_modal';

class App extends React.Component {
    constructor() {
        super();
        this.state = {
            isLoading: false,
            currentModal: null,
            run: null,
            trajectories: {},
            loadingMessage: 'Loading...',
            colors: ['ff0029', '377eb8', '66a61e', '984ea3', '00d2d5', 'ff7f00', 'af8d00',
                     '7f80cd', 'b3e900', 'c42e60', 'a65628', 'f781bf', '8dd3c7', 'bebada',
                     'fb8072', '80b1d3', 'fdb462', 'fccde5', 'bc80bd', 'ffed6f', 'c4eaff',
                     'cf8c00', '1b9e77', 'd95f02', 'e7298a', 'e6ab02', 'a6761d', '0097ff',
                     '00d067', '000000', '252525', '525252', '737373', '969696', 'bdbdbd',
                     'f43600', '4ba93b', '5779bb', '927acc', '97ee3f', 'bf3947', '9f5b00',
                     'f48758', '8caed6', 'f2b94f', 'eff26e', 'e43872', 'd9b100', '9d7a00',
                     '698cff', 'd9d9d9', '00d27e', 'd06800', '009f82', 'c49200', 'cbe8ff',
                     'fecddf', 'c27eb6', '8cd2ce', 'c4b8d9', 'f883b0', 'a49100', 'f48800',
                     '27d0df', 'a04a9b'],
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

    selectRun = (e) => {
        this.setState({
            run: e.target.value,
            currentModal: RUN_MODAL,
            lastEvent: e,
        });
    };

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
                new_trajectories[run].simplifySet();
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
                        traj.simplifySet();
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
        const newTraj = new Trajectory();
        newTraj.properties = [...properties];

        this.load_sequence(run, newTraj.properties, newTraj)
            .then((newTraj) => {
                this.load_PCCA(run, clusters, optimal, m_min, m_max, newTraj)
                    .then((newTraj) => {
                        this.load_metadata(run, newTraj).then((newTraj) => {
                            // some final processing on trajectory
                            newTraj.properties.push('timestep');
                            newTraj.calculate_unique_states();
                            newTraj.set_cluster_info(); // for each state
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

                            this.setState({
                                isLoading: false,
                                trajectories: newTrajectories,
                                colors: newColors,
                            });
                        });
                    });
            })
            .catch((e) => {
                alert(e);
            });
    };

    simplifySet = (run, threshold) => {
        const new_trajectories = {
            ...this.state.trajectories,
        };
        new_trajectories[run].simplifySet(threshold);
        this.setState({ trajectories: new_trajectories });
    };

    render() {
        return (
          <div className="App">
            <Container maxWidth={false} sx={{ height: '100%' }}>
              <Stack spacing={1}>
                <div>
                  <h1>Trajectory Visualization</h1>
                  <h2>powered by React.js</h2>
                  <p>
                    Press CTRL to toggle the path selection brush.
                    Press Z to toggle the zoom brush. Double click
                    to reset zoom. Press and hold SHIFT to select
                    multiple paths. Right click to open a context menu.
                  </p>
                </div>
                <CheckboxTable
                  defaults={['']}
                  header="Run"
                  api_call="/get_run_list"
                  click={(e) => {
                                this.selectRun(e);
                            }}
                />
                <br />
              </Stack>
              <VisGrid
                trajectories={this.state.trajectories}
                recalculate_clustering={this.recalculate_clustering}
                simplifySet={this.simplifySet}
              />
            </Container>

            {this.state.currentModal === RUN_MODAL
                 && (
                 <LoadRunModal
                   run={this.state.run}
                   runFunc={this.load_trajectory}
                   isOpen={this.state.currentModal === RUN_MODAL}
                   lastEvent={this.state.lastEvent}
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
          </div>
        );
    }
}

export default App;
