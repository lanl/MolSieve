import React from "react";
import TrajectoryChart from "./TrajectoryChart";
import XYPlotModal from "./XYPlotModal";
import AddFilterModal from "./AddFilterModal";
import { getMinProperty, getMaxProperty } from "./myutils.js";
import {
    filter_min_opacity,
    filter_max_opacity,
    filter_range_opacity,
    filter_clustering_difference,
    filter_fuzzy_membership,
    filter_transitions,
} from "./Filters";
import FilterComponent from "./FilterComponent";
import Slider from "@mui/material/Slider";

import Grid from "@mui/material/Grid";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";

const XY_PLOT_MODAL = "xy-plot-modal";
const ADD_FILTER_MODAL = "add-filter-modal";

const RANGE_SLIDER = "range";
const SLIDER = "slider";
const TOGGLE = "toggle";

class D3RenderDiv extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            currentModal: null,
            currentRun: null,
            runs: {},
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

                    const filters = {};

                    filters["clustering_difference"] = {
                        enabled: false,
                        func: filter_clustering_difference,
                        checkBoxLabel: "Show clustering difference",
                        id: `clustering_difference`,
                        type: TOGGLE,
                    };
                    filters["transitions"] = {
                        enabled: false,
                        func: filter_transitions,
                        checkBoxLabel: "Filter transitions from dominant state",
                        extents: [1, 100],
                        options: { val: 10, selectVal: "per" },
                        id: `transitions`,
                        children: (action) => (
                            <select
                                onChange={(e) => {
                                    action(e);
                                }}
                            >
                                <option value="per">% of window</option>
                                <option value="abs">timesteps</option>
                            </select>
                        ),
                        type: SLIDER,
                    };
                    filters["fuzzy_membership"] = {
                        enabled: false,
                        func: filter_fuzzy_membership,
                        checkBoxLabel: "Filter fuzzy memberships",
                        id: `fuzzy_membership`,
                        type: TOGGLE,
                    };

                    runs[run]["filters"] = filters;

                    this.setState({ runs: runs });
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
        }
    };

    propagateChange = (filter) => {
        let runs = { ...this.state.runs };
        let this_filter = runs[filter.run]["filters"][filter.id];

        if (filter.options) {
            this_filter.options = filter.options;
        }
        this_filter.enabled = filter.enabled;

        runs[filter.run]["filters"][filter.id] = this_filter;
        this.setState({ runs });
    };

    addFilter = (state) => {
        let runs = this.state.runs;
        let run = runs[state.run];
        let filters = run["filters"];

        const sequence = this.props.trajectories[state.run].sequence;

        let func = null;
        let filter_label = null;

        switch (state.filter_type) {
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
                filter_label = "Between";
                break;
            default:
                alert("Unsupported filter type");
                filter_label = "Unknown filter";
                func = null;
                break;
        }

        let val =
            state.filter_type === "MIN" || state.filter_type === "MAX"
                ? getMinProperty(state.attribute, sequence)
                : [
                      getMinProperty(state.attribute, sequence),
                      getMaxProperty(state.attribute, sequence),
                  ];

        let filter_type =
            state.filter_type === "MIN" || state.filter_type === "MAX"
                ? SLIDER
                : RANGE_SLIDER;

        filters[`${state.attribute}_${state.filter_type}`] = {
            enabled: false,
            func: func,
            checkBoxLabel: `Filter ${state.attribute}`,
            sliderLabel: filter_label,
            type: filter_type,
            extents: [
                getMinProperty(state.attribute, sequence),
                getMaxProperty(state.attribute, sequence),
            ],
            options: {
                val: val,
                property: state.attribute,
            },
            id: `${state.attribute}_${state.filter_type}`,
        };
        run.filters = filters;
        runs[state.run] = run;
        this.setState({ runs: runs });
    };

    renderControls = (runs) => {
        return runs.map((run) => {
            return (
                <Stack spacing={1} key={run}>
                    <b>{run}</b>

                    <Slider
                        step={1}
                        min={2}
                        max={20}
                        name="pcca_slider"
                        onChangeCommitted={() => {
                            this.recalculate_clustering(run);
                        }}
			valueLabelDisplay="auto"
                        onChange={(e) => {
                            this.updateRun(
                                run,
                                "current_clustering",
                                e.target.value
                            );
                        }}
                        value={
                            this.state.runs[run]["current_clustering"]
                        }
                    />
                    <label htmlFor="pcca_slider">
                        {this.state.runs[run]["current_clustering"]} clusters
                    </label>

                    {Object.keys(this.state.runs[run]["filters"]).length > 0 &&
                        Object.keys(this.state.runs[run]["filters"]).map(
                            (key, idx) => {
                                let filter =
                                    this.state.runs[run]["filters"][key];

                                return (
                                    <FilterComponent
                                        key={idx}
                                        filter={filter}
                                        run={run}
                                        propagateChange={this.propagateChange}
                                        render={(state, actions) => {
                                            if (filter.type === TOGGLE) {
                                                return (
                                                    <div>
                                                        {filter.children &&
                                                            filter.children}
                                                    </div>
                                                );
                                            } else {
                                                let slider_label = null;

                                                if (filter.type === SLIDER) {
						    if(filter.options.property) {
							slider_label = (
                                                            <label>
								{filter.sliderLabel}{" "}
								{state.options.val}{" "}
								{
                                                                    filter.options
									.property
								}
                                                            </label>);
						    } else {                                                        
							    slider_label = (
								<label>
								    {state.options.val}
								</label>
							    );
							}                                                   
                                                } else {
                                                    slider_label = (
                                                        <label>
                                                            {filter.sliderLabel}{" "}
                                                            {
                                                                state.options
                                                                    .val[0]
                                                            }{" "}
                                                            and{" "}
                                                            {
                                                                state.options
                                                                    .val[1]
                                                            }{" "}
                                                            {
                                                                state.options
                                                                    .property
                                                            }
                                                        </label>
                                                    );
						} 
                                                const domain = filter.extents;
                                                return (
                                                    <div>
                                                        <Slider
                                                            min={domain[0]}
                                                            max={domain[1]}
                                                            step={1}
                                                            onChangeCommitted={(
                                                                e,
                                                                v
                                                            ) => {
                                                                actions.setValues(
                                                                    e,
                                                                    v
                                                                );
                                                                if (
                                                                    state.enabled
                                                                ) {
                                                                    actions.propagateChange();
                                                                }
                                                            }}
                                                            onChange={(
                                                                e,
                                                                v
                                                            ) => {
                                                                actions.setValues(
                                                                    e,
                                                                    v
                                                                );
                                                            }}
                                                            value={
                                                                state.options
                                                                    .val
                                                            }
                                                            valueLabelDisplay="auto"
                                                            name="slider"
                                                        />
                                                        <br />
                                                        <label>
                                                            {slider_label}{" "}
                                                            {filter.children &&
                                                                filter.children(
                                                                    actions.setMode
                                                                )}
                                                        </label>
                                                    </div>
                                                );
                                            }
                                        }}
                                    />
                                );
                            }
                        )}
		    <Stack spacing={1}>
			<Button variant="outlined"
                            onClick={() => {
				this.setState({ ...this.state, currentRun: run });
				this.toggleModal(ADD_FILTER_MODAL);
                            }}
			>
                            + Add a new filter
			</Button>
			<Button variant="outlined"
                            onClick={() => {
				this.setState({ ...this.state, currentRun: run });
				this.toggleModal(XY_PLOT_MODAL);
                            }}
			>
                            Generate x-y plot with attribute
			</Button>
		    </Stack>
                </Stack>
            );
        });
    };

    render() {
        let runs = Object.keys(this.state.runs);
        if (runs.length > 0) {
            var controls = this.renderControls(runs);
            return (
                <Grid container spacing={1}>
                    <Grid item xs={10}>
                        <TrajectoryChart
                            trajectories={this.props.trajectories}
                            runs={this.state.runs}
                        ></TrajectoryChart>
                    </Grid>
                    {this.state.currentModal === ADD_FILTER_MODAL && (
                        <AddFilterModal
                            title={`Add filter for ${this.state.currentRun}`}
                            open={
                                this.state.currentModal === ADD_FILTER_MODAL
                            }
                            trajectory={
                                this.props.trajectories[this.state.currentRun]
                            }
                            closeFunc={() => {
                                this.toggleModal(null);
                            }}
                            addFilter={this.addFilter}
                            run={this.state.currentRun}
                        />
                    )}
                    {this.state.currentModal === XY_PLOT_MODAL && (
                        <XYPlotModal
                            title={`Scatter plot for ${this.state.currentRun}`}
                            closeFunc={() => this.toggleModal(null)}
                            open={this.state.currentModal === XY_PLOT_MODAL}
                            trajectory={
                                this.props.trajectories[this.state.currentRun]
                            }
                            onRequestClose={() => this.toggleModal(null)}
                        />
                    )}
                    <Grid item xs={2}>
                        {controls}
                    </Grid>
                </Grid>
            );
        } else {
            return null;
        }
    }
}
export default D3RenderDiv;
