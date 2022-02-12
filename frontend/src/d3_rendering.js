import React from "react";
import TrajectoryChart from "./TrajectoryChart";
import XYPlotModal from "./XYPlotModal";
import AddFilterModal from "./AddFilterModal"
import {getMinProperty, getMaxProperty} from "./myutils.js"
import {filter_min_opacity, filter_max_opacity, filter_range_opacity} from './Filters'
import FilterComponent from "./FilterComponent";

const XY_PLOT_MODAL = "xy-plot-modal";
const ADD_FILTER_MODAL = "add-filter-modal";

class D3RenderDiv extends React.Component {
    
    constructor(props) {
        super(props);
        this.state = {
            currentModal: null,
            currentRun: null,
            runs: {},
            goRender: 0,
        };
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
            for (var run of runs) {
                if (!Object.keys(this.state.runs).includes(run)) {
                    let runs = { ...this.state.runs };
                    runs[run] = {};
                    runs[run]["current_clustering"] =
                        this.props.trajectories[run].current_clustering;
                    runs[run]["show_clustering_difference"] = false;
                    runs[run]["show_transition_filter"] = false;
                    runs[run]["show_fuzzy_membership_filter"] = false;
                    runs[run]["transition_filter_slider_value"] = 10;
                    runs[run]["transition_filter_mode"] = "per";
		    runs[run]["filters"] = {};
                    this.setState((prevState) => {
                        return { goRender: prevState.goRender + 1, runs: runs };
                    });
                }
            }
        }
    }

    updateRun = (run, attribute, value) => {
        let runs = { ...this.state.runs };
        runs[run][attribute] = value;
        this.setState(runs);
    };

    recalculate_clustering = async (run) => {
        var result = await this.props.recalculate_clustering(
            run,
            this.state.runs[run]["current_clustering"]
        );
        if (!result) {
            this.updateRun(
                run,
                "current_clustering",
                this.props.trajectories[run].current_clustering
            );
        } else {
            this.setState((prevState) => {
                return { goRender: prevState.goRender + 1 };
            });
        }
    };

    propagateChange = (filter) => {
        let runs = {...this.state.runs};                
	let this_filter = runs[filter.run]['filters'][filter.id];	
        
	this_filter.value = filter.value;
	this_filter.enabled = filter.enabled;
	runs[filter.run]['filters'][filter.id] = this_filter;	
	this.setState((prevState) => {
	    return {goRender: prevState.goRender + 1, runs}
	});
    }

    addFilter = (state) => {        
	let runs = this.state.runs;
	let run = runs[state.run];
	let filters = run['filters'];
	
	const sequence = this.props.trajectories[state.run].sequence;

	let func = null;
	let filter_label = null;
        
	switch(state.filter_type) {
	case "MIN":
	    func = filter_min_opacity;
	    filter_label = "At least";
	    break;
	case "MAX":
	    func = filter_max_opacity;
	    filter_label = "At most";
	    break;
	case "RANGE":
	    func = filter_range_opacity;
	    filter_label = "between";
	    break;
	default:
	    alert("Unsupported filter type");
	    filter_label = "Unknown filter";
	    func = null;
	    break;
	}
	
	filters[`${state.attribute}_${state.filter_type}`] = {attribute: state.attribute, enabled: false, func: func, label: filter_label,
		      extents: [getMinProperty(state.attribute, sequence),getMaxProperty(state.attribute, sequence)],
		      value: getMinProperty(state.attribute, sequence), id: `${state.attribute}_${state.filter_type}`,
		      isRange: state.filter_type === "RANGE"};
	run.filters = filters;
	runs[state.run] = run;        
        this.setState({runs: runs});
    }

    renderControls = (runs) => {
        return runs.map((run) => {
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
                        onMouseUp={() => {
                            this.recalculate_clustering(run);
                        }}
                        onChange={(e) => {
                            this.updateRun(
                                run,
                                "current_clustering",
                                e.target.value
                            );
                        }}
                        defaultValue={
                            this.state.runs[run]["current_clustering"]
                        }
                    />
                    <label htmlFor="pcca_slider">
                        {this.state.runs[run]["current_clustering"]} clusters
                    </label>
                    <div>
                        <label htmlFor="chkbx_clustering_diff">
                            Show clustering difference
                        </label>
                        <input
                            type="checkbox"
                            name="chkbx_clustering_diff"
                            onChange={(e) => {
                                this.updateRun(
                                    run,
                                    "show_clustering_difference",
                                    e.target.checked
                                );
                                this.setState((prevState) => {
                                    return { goRender: prevState.goRender + 1 };
                                });
                            }}
                        />
                    </div>
                    <div>
                        <label hmtlFor="chkbx_transition_filter">
                            Filter transitions from dominant state?
                        </label>
                        <input
                            type="checkbox"
                            name="chkbx_transition_filter"
                            onChange={(e) => {
                                this.updateRun(
                                    run,
                                    "show_transition_filter",
                                    e.target.checked
                                );
                                this.setState((prevState) => {
                                    return { goRender: prevState.goRender + 1 };
                                });
                            }}
                        />
                        <br />
                        <input
                            type="range"
                            min="1"
                            max={
                                this.state.runs[run][
                                    "transition_filter_mode"
                                ] === "per"
                                    ? 100
                                    : this.props.trajectories[run].sequence
                                          .length
                            }
                            name="slider_transition_filter"
                            onMouseUp={() => {
                                if (
                                    this.state.runs[run][
                                        "show_transition_filter"
                                    ]
                                ) {
                                    this.setState((prevState) => {
                                        return {
                                            goRender: prevState.goRender + 1,
                                        };
                                    });
                                }
                            }}
                            onChange={(e) =>
                                this.updateRun(
                                    run,
                                    "transition_filter_slider_value",
                                    e.target.value
                                )
                            }
                            defaultValue={
                                this.state.runs[run][
                                    "transition_filter_slider_value"
                                ]
                            }
                        />
                        <br />
                        <label htmlFor="slider_transition_filter">
                            Size of window:{" "}
                            {
                                this.state.runs[run][
                                    "transition_filter_slider_value"
                                ]
                            }
                            <select
                                onChange={(e) => {
                                    this.updateRun(
                                        run,
                                        "transition_filter_mode",
                                        e.target.value
                                    );
                                    if (
                                        this.state.runs[run][
                                            "show_transition_filter"
                                        ]
                                    ) {
                                        this.setState((prevState) => {
                                            return {
                                                goRender:
                                                    prevState.goRender + 1,
                                            };
                                        });
                                    }
                                }}
                                defaultValue={
                                    this.state.runs[run][
                                        "transition_filter_mode"
                                    ]
                                }
                            >
                                <option value="per">
                                    % of smallest cluster
                                </option>
                                <option value="abs">Number of timesteps</option>
                            </select>
                        </label>
                    </div>
                    <div>
                        <label htmlFor="chkbx_fuzzy_membership">
                            Filter fuzzy memberships?
                        </label>
                        <input
                            type="checkbox"
                            name="chkbx_fuzzy_membership"
                            onChange={(e) => {
                                this.updateRun(
                                    run,
                                    "show_fuzzy_membership_filter",
                                    e.target.checked
                                );
                                this.setState((prevState) => {
                                    return { goRender: prevState.goRender + 1 };
                                });
                            }}
                        />
                    </div>
                    <button onClick={() => {
			this.setState({...this.state, currentRun: run});
			this.toggleModal(ADD_FILTER_MODAL);
		    }}>+ Add a new filter</button>
                    <button                        
                        onClick={() => {
                            this.setState({ ...this.state, currentRun: run });
                            this.toggleModal(XY_PLOT_MODAL);
                        }}
                    >
                        Generate x-y plot with attribute
                    </button>
		    {Object.keys(this.state.runs[run]['filters']).length > 0 && Object.keys(this.state.runs[run]['filters']).map((key,idx) => {                        
			return (<FilterComponent key={idx} filter={this.state.runs[run]['filters'][key]} run={run} propagateChange={this.propagateChange}>
				</FilterComponent>);
		    })}
                </div>
            );
        });
    };
    
    render() {
        let runs = Object.keys(this.state.runs);
        if (runs.length > 0) {
            var controls = this.renderControls(runs);            
            return (
                <div style={{ display: "flex" }}>
                    <TrajectoryChart
                        trajectories={this.props.trajectories}
                        runs={this.state.runs}
                        goRender={this.state.goRender}
                    ></TrajectoryChart>
		    {this.state.currentModal === ADD_FILTER_MODAL &&
		     <AddFilterModal
			 title={`Add filter for ${this.state.currentRun}`}
			 isOpen={this.state.currentModal === ADD_FILTER_MODAL}
			 trajectory={this.props.trajectories[this.state.currentRun]}
			 closeFunc={() => { this.toggleModal(null)}}
			 onRequestClose={() => this.toggleModal(null)}
			 addFilter={this.addFilter}
			 run={this.state.currentRun}
		     />		     
		    }
		    {this.state.currentModal === XY_PLOT_MODAL &&
                     <XYPlotModal
                         title={`Scatter plot for ${this.state.currentRun}`}       
                         closeFunc={() => this.toggleModal(null)}
                         isOpen={this.state.currentModal === XY_PLOT_MODAL}
                         trajectory={
                             this.props.trajectories[this.state.currentRun]
                         }
                         onRequestClose={() => this.toggleModal(null)}
                     />}
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
