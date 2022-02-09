import React from "react";
import "./App.css";
import CheckboxTable from "./CheckboxTable";
import LoadRunModal from "./LoadRunModal";
import Modal from "react-modal";
import ReactLoading from "react-loading";
import Trajectory from "./trajectory";
import D3RenderDiv from "./d3_rendering";

//TODO use context to push down modalStyle

const axios = require("axios").default;
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
            lastEvent: null,
            trajectories: {},
            loadingMessage: "Loading...",
        };
        Modal.setAppElement("#root");
    }

    toggleModal = (key) => (event) => {
        if (this.state.currentModal) {
            // unchecks the checkbox that toggled the modal, if applicable            
            this.setState({
                ...this.state,
                currentModal: null,
                lastEvent: null,
            });
            return;
        }
	
        this.setState({ ...this.state, currentModal: key, lastEvent: event });
    };

    load_trajectory = (state) => {
        this.setState({
            isLoading: true,
            loadingMessage: `Calculating PCCA for ${state.name}...`,
        });
        axios
            .get("/pcca", {
                params: {
                    run: state.name,
                    clusters: -1,
                    optimal: 1,
                    m_min: state.values[0],
                    m_max: state.values[1],
                },
            })
            .then((response) => {
                var new_traj = new Trajectory();
                var clustered_data = response.data;
                new_traj.optimal_cluster_value = clustered_data.optimal_value;
                new_traj.current_clustering = clustered_data.optimal_value;
                new_traj.feasible_clusters = clustered_data.feasible_clusters;
                for (var idx of new_traj.feasible_clusters) {
                    new_traj.clusterings[idx] = clustered_data.sets[idx];
                    new_traj.fuzzy_memberships[idx] =
                        clustered_data.fuzzy_memberships[idx];
                }
                this.setState({
                    loadingMessage: `Loading sequence for ${state.name}...`,
                });
                axios
                    .get("/load_sequence", {
                        params: {
                            run: state.name,
                            properties: state.clicked.toString(),
                        },
                    })
                    .then((response) => {
                        new_traj.sequence = response.data;
                        new_traj.properties = state.clicked;
                        new_traj.calculate_unique_states();
                        new_traj.set_cluster_info();
                        const new_trajectories = {
                            ...this.state.trajectories,
                        };
                        new_trajectories[state.name] = new_traj;
                        this.setState({
                            isLoading: false,
                            trajectories: new_trajectories,
                        });
                    });
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
                        click={this.toggleModal(RUN_MODAL)}
                    ></CheckboxTable>
                    <D3RenderDiv
                        trajectories={this.state.trajectories}
                    ></D3RenderDiv>
                </div>
                <LoadRunModal
                    runFunc={this.load_trajectory}
                    isOpen={this.state.currentModal === RUN_MODAL}
                    lastEvent={this.state.lastEvent}
                    closeFunc={this.toggleModal(RUN_MODAL)}
		    onRequestClose={this.toggleModal(RUN_MODAL)}
                />
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
