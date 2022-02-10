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
        this.state = { currentModal: null, currentRun: null, runs: {} };
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
		if(!Object.keys(this.state.runs).includes(run)) {                    
		    let runs = {...this.state.runs}
		    runs[run] = {};
		    runs[run]['current_clustering'] = this.props.trajectories[run].current_clustering;
		    runs[run]['show_clustering_difference'] = false;
		    this.setState({runs});                    
		}
	    }
	}
    }

    updateRun = (run, attribute, value) => {        
	let runs = {...this.state.runs};
	runs[run][attribute] = value;
	this.setState(runs);
    }

    recalculate_clustering = async (run) => {        
	var result = await this.props.recalculate_clustering({name: run, optimal: -1, clusters: this.state.runs[run]['current_clustering'], values: null});        
	if(!result) {
	    this.updateRun(run, 'current_clustering', this.props.trajectories[run].current_clustering);            
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
				this.updateRun(run, 'current_clustering', e.target.value);                                
			    }}				      
                            defaultValue={this.state.runs[run]['current_clustering']}
                        />
                        <label htmlFor="pcca_slider">
                            {this.state.runs[run]['current_clustering']} clusters
                        </label>
			<div>
                        <label htmlFor="chkbx_clustering_diff">
                            Show clustering difference
                        </label>
                            <input type="checkbox" name="chkbx_clustering_diff" onChange={(e) => {
				       this.updateRun(run, 'show_clustering_difference', e.target.checked) }} />
			</div>
			<div>
                        <label hmtlFor="chkbx_transition_filter">
                            Filter transitions from dominant state?
                        </label>
			
                        <input type="checkbox" name="chkbx_transition_filter" />
			</div>
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
			<div>
                        <label htmlFor="chkbx_fuzzy_membership">
                            Filter fuzzy memberships?
                        </label>
			<input type="checkbox" name="chkbx_fuzzy_membership" />
			</div>
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
	let runs = Object.keys(this.state.runs);
        if (runs.length > 0) {
            var controls = this.renderControls(runs);
            return (
                <div style={{ display: "flex" }}>
                    <TrajectoryChart
                        trajectories={this.props.trajectories}
			runs={this.state.runs}
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
                         {controls}</div>
                </div>
            );
        } else {
            return null;
        }
    }
} 
export default D3RenderDiv;
