import React from "react";
import TrajectoryChart from "./TrajectoryChart";
import XYPlotModal from "./XYPlotModal";

const XY_PLOT_MODAL = "xy-plot-modal";

class D3RenderDiv extends React.Component {
    constructor(props) {
        super(props);
        this.state = { currentModal: null, currentRun: null };
    }

    toggleModal = (key) => {
        if (this.state.currentModal) {
            this.setState({
                currentModal: null,                
            });
            return;
        }        
        this.setState({ currentModal: key });
    };

    
    renderControls = (trajectories,runs) => {
	return (
	    runs.map((run, idx) => {
                return (
                    <div
                        key={idx}
                        style={{ display: "flex", flexDirection: "column" }}
                    >
                        <p>
                            <b>{run}</b>
                        </p>
                        <input
                            type="range"
                            min="1"
                            max="20"
                            name="pcca_slider"
                            defaultValue={trajectories[run].current_clustering}
                        />
                        <label htmlFor="pcca_slider">
                            {trajectories[run].current_clustering} clusters
                        </label>

                        <label htmlFor="chkbx_clustering_diff">
                            Show clustering difference
                        </label>
                        <input type="checkbox" name="chkbx_clustering_diff" />

                        <label hmtlFor="chkbx_transition_filter">
                            Filter transitions from dominant state?
                        </label>

                        <input type="checkbox" name="chkbx_transition_filter" />

                        <input
                            type="range"
                            min="1"
                            max="100"
                            name="slider_transition_filter"
                            defaultValue="10"
                        />
                        <label htmlFor="slider_transition_filter">
                            Size of window: 10%
                        </label>

                        <input type="checkbox" name="chkbx_fuzzy_membership" />
                        <label htmlFor="chkbx_fuzzy_membership">
                            Filter fuzzy memberships?
                        </label>
                        <button>+ Add a new filter</button>
                        <button data-run={run}
				onClick={() => {                                   
				    this.setState({ ...this.state, currentRun: run });  
				    this.toggleModal(XY_PLOT_MODAL);				    
                            }}
                        >
                            Generate x-y plot with attribute
                        </button>
                    </div>
                );
	    }));
    }

    render() {
        let trajectories = this.props.trajectories;
        let runs = Object.keys(trajectories);        
        if (runs.length > 0) {
            var controls = this.renderControls(trajectories, runs);
            return (
                <div style={{ display: "flex" }}>
                    <TrajectoryChart
                        trajectories={this.props.trajectories}
                    ></TrajectoryChart>
                    <XYPlotModal
                        closeFunc={() => this.toggleModal(null)}
                        isOpen={this.state.currentModal === XY_PLOT_MODAL}
                        trajectory={this.props.trajectories[this.state.currentRun]}
			onRequestClose={() => this.toggleModal(null)}
                    ></XYPlotModal>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                        {controls}
                    </div>
                </div>
            );
        } else {
            return null;
        }
    }
} //trajectory={this.props.trajectories[this.state.currentRun]}
//this.setState({currentRun: run})
export default D3RenderDiv;
