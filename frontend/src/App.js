import React from "react";
import "./App.css";
import CheckboxTable from "./CheckboxTable";
import LoadRunModal from "./LoadRunModal";
import Modal from "react-modal";
import ReactLoading from "react-loading";
import Trajectory from "./trajectory";
import D3RenderDiv from "./d3_rendering";
import { api_loadPCCA, api_loadSequence } from "./api";
//TODO use context to push down modalStyle
const RUN_MODAL = "run_modal";

const smallModalStyle = {
    content: {
        textAlign: "center",
        margin: "auto",
        width: "25%",
        height: "30%",
    },
};

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
        Modal.setAppElement("#root");
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

    /** Function called by the PCCA slider allocated for each run. Reruns the PCCA for however many clusters the user specifies
     *  @param {string} run - Run to recalculate the clustering for
     *  @param {number} clusters - Number of clusters to split the trajectory into.
     */
    recalculate_clustering = (run, clusters) => {
        // first check if the state has that clustering already calculated
        return new Promise((resolve, reject) => {
            let current_traj = this.state.trajectories[run];
            if (Object.keys(current_traj.clusterings).includes(clusters)) {
                const new_trajectories = {
                    ...this.state.trajectories,
                };
                new_trajectories[run].current_clustering = parseInt(clusters);
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
                        alert(e.response.data.Error);
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
                <div style={{ margin: "1%" }}>
                    <h1>Trajectory Visualization</h1>
                    <h2>powered by React.js</h2>
                    <p>
                        Press CTRL to toggle path selection brush. Press Z to
                        toggle zoom brush. Double click to reset zoom. Press
                        SHIFT to toggle multiple path selection. When you are
                        finished with your selection, press S to open the
                        comparison dialog.
                    </p>
                    <CheckboxTable
                        defaults={[""]}
                        header="Runs"
                        api_call="/get_run_list"
                        click={(e) => {
                            this.selectRun(e);
                        }}
                    ></CheckboxTable>
                    <D3RenderDiv
                        trajectories={this.state.trajectories}
                        recalculate_clustering={this.recalculate_clustering}
                    ></D3RenderDiv>
                </div>
                {this.state.currentModal === RUN_MODAL && (
                    <LoadRunModal
                        run={this.state.run}
                        runFunc={this.load_trajectory}
                        isOpen={this.state.currentModal === RUN_MODAL}
                        lastEvent={this.state.lastEvent}
                        closeFunc={() => this.toggleModal(RUN_MODAL)}
                        onRequestClose={() => this.toggleModal(RUN_MODAL)}
                    />
                )}
                <Modal isOpen={this.state.isLoading} style={smallModalStyle}>
                    <h1>{this.state.loadingMessage}</h1>
                    <ReactLoading
                        className="CenteredSpinner"
                        type="spin"
                        color="black"
                        height="25%"
                        width="25%"
                    />
                </Modal>
            </div>
        );
    }
}

export default App;
