import React from "react";
import TrajectoryChart from "./TrajectoryChart";
import XYPlotModal from "./XYPlotModal";


const largeModalStyle = {
    content: {
	justifyContent: 'center',
	textAlign: "center",
	margin: 'auto',
        width: "40%",
        height: "80%",
    },
}

const XY_PLOT_MODAL = "xy-plot-modal";

class D3RenderDiv extends React.Component {
    constructor(props) {
        super(props);
        this.state = { currentModal: null, currentRun: null, clusterings: {} };
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

    componentDidUpdate() {
	let runs = Object.keys(this.props.trajectories);        
        if (runs.length > 0) {
	    for(var run of runs) {		
		if(!Object.keys(this.state.clusterings).includes(run)) {                    
		    let clusterings = {...this.state.clusterings}
		    clusterings[run] = this.props.trajectories[run].current_clustering;
		    this.setState({clusterings});                    
		}
	    }
	}
    }

    recalculate_clustering = async (run) => {        
	var result = await this.props.recalculate_clustering({name: run, optimal: -1, clusters: this.state.clusterings[run], values: null});        
	if(!result) {
	    let clusterings = {...this.state.clusterings}
	    clusterings[run] = this.props.trajectories[run].current_clustering;
	    this.setState({clusterings});
	}
    }        
    
    renderControls = (runs) => {
	return (
	    runs.map((run) => {
                return (
                    <div
                        key={run}
                        style={{ display: "flex", flexDirection: "column" }}
                    >
                        <p>
                            <b>{run}</b>
                        </p>
                        <input
                            type="range"
                            min="2"
                            max="20"
                            name="pcca_slider"
			    onMouseUp={() => { this.recalculate_clustering(run)}}			    
                            onChange={(e) => {
				let clusterings = {...this.state.clusterings}
				clusterings[run] = e.target.value;
                                this.setState({clusterings});
			    }}				      
                            defaultValue={this.state.clusterings[run]}
                        />
                        <label htmlFor="pcca_slider">
                            {this.state.clusterings[run]} clusters
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
        let runs = Object.keys(this.props.trajectories);        
        if (runs.length > 0) {
            var controls = this.renderControls(runs);
            return (
                <div style={{ display: "flex" }}>
                    <TrajectoryChart
                        trajectories={this.props.trajectories}
                    ></TrajectoryChart>
                    <XYPlotModal
			title={`Scatter plot for ${this.state.currentRun}`}
			style={largeModalStyle}
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
} 
export default D3RenderDiv;
