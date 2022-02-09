import React from "react";
import TrajectoryChart from './TrajectoryChart';
import * as d3 from "d3";

class D3RenderDiv extends React.Component {    

    componentDidMount() {
	document.addEventListener('keydown', this.handleKeyPress);
    }
    
    
    render() {
	let trajectories = this.props.trajectories;        
	//console.log(trajectories);
        let runs = Object.keys(trajectories);
        
        if (runs.length > 0) {
            var controls = runs.map(function (run, idx) {
                return (
                    <div key={idx} style={{display:'flex', flexDirection:'column'}}>
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
                        <label htmlFor="pcca_slider">{trajectories[run].current_clustering} clusters</label>
			
                        <input type="checkbox" name="chkbx_clustering_diff" />
                        <label htmlFor="chkbx_clustering_diff">
                            Show clustering difference
                        </label>

                        <input type="checkbox" name="chkbx_transition_filter" />
                        <label hmtlFor="chkbx_transition_filter">
                            Filter transitions from dominant state?
                        </label>

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
			{trajectories[run].properties.length > 0 &&
                         (<button>+ Add a new filter</button> &&
			  <button>Generate x-y plot with attribute</button>)}
                    </div>
                );
            });
            return (
                <div style={{ display: "flex" }}>
                    <TrajectoryChart trajectories={this.props.trajectories}></TrajectoryChart>
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
