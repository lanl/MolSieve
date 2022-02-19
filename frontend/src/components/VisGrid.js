import React from "react";
import TrajectoryChart from "../vis/TrajectoryChart";
import XYPlotModal from "../modals/XYPlotModal";
import AddFilterModal from "../modals/AddFilterModal";
import { getMinProperty, getMaxProperty } from "../api/myutils.js";
import {
    filter_min_opacity,
    filter_max_opacity,
    filter_range_opacity,
    filter_clustering_difference,
    filter_fuzzy_membership,
    filter_transitions,
} from "../api/filters";
import FilterComponent from "../components/FilterComponent";
import Slider from "@mui/material/Slider";
import Button from "@mui/material/Button";
import MenuIcon from '@mui/icons-material/Menu';

import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";

import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Divider from '@mui/material/Divider';

import Drawer from "@mui/material/Drawer";
import Box from "@mui/material/Box";
import LoadingModal from "../modals/LoadingModal";

const XY_PLOT_MODAL = "xy-plot-modal";
const ADD_FILTER_MODAL = "add-filter-modal";
const METADATA_MODAL = "metadata-modal";

const RANGE_SLIDER = "range";
const SLIDER = "slider";
const TOGGLE = "toggle";

class VisGrid extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            currentModal: null,
            currentRun: null,
            runs: {},
            drawerOpen: false,
            isLoading: false
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

    chartFinishedLoading = () => {
        this.setState({ isLoading: false});
    }
    
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
                        children: (actions) => (
                            <select
                                onChange={(e) => {
                                    actions.setMode(e);
                                    actions.propagateChange();
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

                    this.setState({ runs: runs, isLoading: true });
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
        this.setState({ runs: runs, isLoading: true });
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
                <List key={run}>
                    <ListSubheader color="primary">{run}{" "}
                        <Button size="small" variant="outlined"
                            onClick={() => {
                                this.setState({ currentRun: run }, () => {
                                    this.toggleModal(METADATA_MODAL);   
                                });
                            }}>
                        Display metadata
                        </Button>
                    </ListSubheader>                    
                    <ListItem>
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
                        value={this.state.runs[run]["current_clustering"]}
                    />

                    </ListItem>
                    <ListItem>
                        <ListItemText secondary={this.state.runs[run]["current_clustering"] + " clusters"}>                            
                        </ListItemText>
                    </ListItem>
                    {Object.keys(this.state.runs[run]["filters"]).length > 0 &&
                        Object.keys(this.state.runs[run]["filters"]).map(
                            (key, idx) => {
                                let filter =
                                    this.state.runs[run]["filters"][key];

                                return (
                                    <ListItem key={idx}>
                                    <FilterComponent
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
                                                    if (
                                                        filter.options.property
                                                    ) {
                                                        slider_label = (
                                                            <label>
                                                                {
                                                                    filter.sliderLabel
                                                                }{" "}
                                                                {
                                                                    state
                                                                        .options
                                                                        .val
                                                                }{" "}
                                                                {
                                                                    filter
                                                                        .options
                                                                        .property
                                                                }
                                                            </label>
                                                        );
                                                    } else {
                                                        slider_label = (
                                                            <label>
                                                                {
                                                                    state
                                                                        .options
                                                                        .val
                                                                }
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
                                                             filter.children(actions)}
                                                        </label>
                                                    </div>
                                                );
                                            }
                                        }}
                                    /></ListItem>
                                );
                            }
                        )}
                    <ListItem>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                                this.setState({
                                    ...this.state,
                                    currentRun: run,
                                });
                                this.toggleModal(ADD_FILTER_MODAL);
                            }}
                        >
                            Add a new filter
                        </Button>
                    </ListItem>
                    <ListItem>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                                this.setState({
                                    ...this.state,
                                    currentRun: run,
                                });
                                this.toggleModal(XY_PLOT_MODAL);
                            }}
                        >
                            Generate x-y plot with attribute
                        </Button>
                    </ListItem>
                    <Divider />
                </List>
            );
        });
    };

    toggleDrawer() {
        this.setState({ drawerOpen: !this.state.drawerOpen});
    }

    render() {
        let runs = Object.keys(this.state.runs);
        let trajs = Object.keys(this.props.trajectories);
        let safe = (runs.length === trajs.length && runs.length > 0 && trajs.length > 0) ? true : false;                
        var controls = this.renderControls(runs);        
        
        return(
            <Box sx={{ height: '100%' }}>
                {safe && (
                <Button sx={{ float: 'right' }} onClick={() => {
                            this.toggleDrawer();
                        }}><MenuIcon /></Button>)}

                <Drawer anchor="right" variant="persistent" onClose={this.toggleDrawer} open={this.state.drawerOpen}>
                    {safe && controls}
                    <Button color="error" variant="contained" onClick={() => {
                                this.toggleDrawer();
                            }}>Close</Button>
                </Drawer>

                <LoadingModal
                    open={this.state.isLoading}
                    title="Rendering..."/>
            {safe && (
                <TrajectoryChart
                    trajectories={this.props.trajectories}
                    runs={this.state.runs}
                    loadingCallback={this.chartFinishedLoading}
                ></TrajectoryChart>
            )}

            {this.state.currentModal === METADATA_MODAL && (
                <Dialog
                    open={this.state.currentModal === METADATA_MODAL}
                    onClose={this.toggleModal}
                    onBackdropClick={() => {
                        this.toggleModal(null);
                    }}
                >
                    <DialogTitle>
                        Metadata for {this.state.currentRun}
                    </DialogTitle>
                    <DialogContent>
                        {
                            this.props.trajectories[this.state.currentRun]
                                .LAMMPSBootstrapScript
                        }
                    </DialogContent>
                    <DialogActions>
                        <Button
                            onClick={() => {
                                this.toggleModal(null);
                            }}
                        >
                            Close
                        </Button>
                    </DialogActions>
                </Dialog>
            )}

            {this.state.currentModal === ADD_FILTER_MODAL && (
                <AddFilterModal
                    title={`Add filter for ${this.state.currentRun}`}
                    open={this.state.currentModal === ADD_FILTER_MODAL}
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
        </Box>
        );
    }
}

export default VisGrid;
