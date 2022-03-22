import React from "react";
import "./css/App.css";
import CheckboxTable from "./components/CheckboxTable";
import LoadRunModal from "./modals/LoadRunModal";
import LoadingModal from "./modals/LoadingModal";
import Trajectory from "./api/trajectory";
import VisGrid from "./components/VisGrid";
import { api_loadPCCA, api_loadSequence, api_load_metadata } from "./api/ajax";
import Container from "@mui/material/Container";
import Stack from "@mui/material/Stack";

const RUN_MODAL = "run_modal";

class App extends React.Component {
    constructor() {
        super();
        this.state = {
            isLoading: false,
            currentModal: null,
            run: null,
            trajectories: {},
            loadingMessage: "Loading...",
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
            loadingMessage: `Loading sequence for ${run}...`,
        });
        return api_loadSequence(run, properties, new_traj);
    };

    load_metadata = (run, new_traj) => {
        this.setState({
            loadingMessage: `Loading metadata for ${run}...`,
        });
        return api_load_metadata(run, new_traj);
    };

    /** Function called by the PCCA slider allocated for each run. Reruns the PCCA for however many clusters the user specifies
     *  @param {string} run - Run to recalculate the clustering for
     *  @param {number} clusters - Number of clusters to split the trajectory into.
     */
    recalculate_clustering = (run, clusters) => {
        // first check if the state has that clustering already calculated
        return new Promise((resolve, reject) => {
            let current_traj = this.state.trajectories[run];
            
            if (current_traj.feasible_clusters.includes(clusters)) {
                const new_trajectories = {
                    ...this.state.trajectories,
                };
                new_trajectories[run].current_clustering = clusters;
                new_trajectories[run].set_cluster_info();
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
                    this.state.trajectories[run]
                )
                    .then((traj) => {
                        const new_trajectories = {
                            ...this.state.trajectories,
                        };
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
        });
    };

    /** Creates a new trajectory object and populates it with data from the database
     * @param {string} run - Which run this trajectory object will correspond to
     * @param {number} clusters - Number of clusters to cluster the trajectory into. Ignored if optimal = 1
     * @param {number} optimal - Whether or not PCCA should try and find the optimal clustering between m_min and m_max
     * @param {number} m_min - When running optimal clustering, minimal cluster size to try; ignored if optimal = -1
     * @param {number} m_max - When running optimal clustering, maximum cluster size to try; ignored if optimal = -1
     * @param {Array<String>} properties - Properties of the trajectory to retrieve
     */
    load_trajectory = (run, clusters, optimal, m_min, m_max, properties) => {
        var new_traj = new Trajectory();
        new_traj.properties = [...properties];

        this.load_PCCA(run, clusters, optimal, m_min, m_max, new_traj)
            .then((new_traj) => {
                this.load_sequence(run, new_traj.properties, new_traj).then(
                    (new_traj) => {
                        this.load_metadata(run, new_traj).then((new_traj) => {
                            // some final processing on trajectory
                            new_traj.properties.push("timestep");
                            new_traj.calculate_unique_states();
                            new_traj.set_cluster_info();
                            const new_trajectories = {
                                ...this.state.trajectories,
                            };
                            new_trajectories[run] = new_traj;
                            this.setState({
                                isLoading: false,
                                trajectories: new_trajectories,
                            });
                        });
                    }
                );
            })
            .catch((e) => {
                alert(e);
            });
    };

    render() {
        return (
            <div className="App">
                <Container maxWidth={false} sx={{height: '100%'}}>
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
                            defaults={[""]}
                            header="Run"
                            api_call="/get_run_list"
                            click={(e) => {
                                this.selectRun(e);
                            }}
                        ></CheckboxTable>
                        <br/>
                    </Stack>
                    <VisGrid
                        trajectories={this.state.trajectories}
                        recalculate_clustering={this.recalculate_clustering}
                        />
                </Container>

                {this.state.currentModal === RUN_MODAL &&
                 (<LoadRunModal
                    run={this.state.run}
                    runFunc={this.load_trajectory}
                    isOpen={this.state.currentModal === RUN_MODAL}
                    lastEvent={this.state.lastEvent}
                    closeFunc={() => this.toggleModal(RUN_MODAL)}
                    onRequestClose={() => this.toggleModal(RUN_MODAL)}
                  />)
                }
                
                {this.state.isLoading && <LoadingModal
                    open={this.state.isLoading}
                    title={this.state.loadingMessage}
                                        />}
            </div>
        );
    }
}

export default App;
