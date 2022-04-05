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
    filter_relationship,
    filter_chunks,
} from "../api/filters";
import FilterComponent from "../components/FilterComponent";
import Slider from "@mui/material/Slider";
import Button from "@mui/material/Button";

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
import Paper from "@mui/material/Paper";

import SingleStateModal from "../modals/SingleStateModal";
import LoadingModal from "../modals/LoadingModal";
import GraphVis from "../vis/GraphVis";

const XY_PLOT_MODAL = "xy-plot-modal";
const ADD_FILTER_MODAL = "add-filter-modal";
const METADATA_MODAL = "metadata-modal";
const SINGLE_STATE_MODAL = 'single_state';


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
            isLoading: false,
            stateHovered: null,
            stateClicked: null,
            lastEventCaller: null           
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
        this.setState({ isLoading: false });
    }

    setStateHovered = (caller, id) => {
        this.setState({stateHovered: id, lastEventCaller: caller});
    }

    setStateClicked = (state) => {        
        this.setState({stateClicked: state}, () => {
            this.toggleModal(SINGLE_STATE_MODAL)});
    }
    
    componentDidUpdate() {
        let runs = Object.keys(this.props.trajectories);
        if (runs.length > 0) {
            for (var run of runs) {
                if (!Object.keys(this.state.runs).includes(run)) {
                    let runs = { ...this.state.runs };

                    
                    runs[run] = { current_clustering: this.props.trajectories[run].current_clustering,
                                  chunkingThreshold: this.props.trajectories[run].chunkingThreshold,
                                };
                    

                    const filters = {};

                    // group tells you what group in a visualization this filter affects
                    filters["clustering_difference"] = {
                        enabled: false,
                        func: filter_clustering_difference,
                        checkBoxLabel: "Show clustering difference",
                        id: `clustering_difference`,
                        type: TOGGLE,
                        group: 'g',
                        className: ["strongly_unstable", "moderately_unstable", "stable"]
                    };

                    filters["chunks"] = {
                        enabled: false,
                        func: filter_chunks,
                        checkBoxLabel: "Hide chunks",
                        id: 'chunks',
                        type: TOGGLE,
                        group: 'c',
                        className: ['chunks', 'invisible']
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
                        group: 'g',
                        className: 'transitions'                    
                    };

                    filters["fuzzy_membership"] = {
                        enabled: false,
                        func: filter_fuzzy_membership,
                        checkBoxLabel: "Filter fuzzy memberships",
                        id: `fuzzy_membership`,
                        type: TOGGLE,
                        group: 'g',
                        className: 'fuzzy_membership'                        
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
        try {
            await this.props.recalculate_clustering(
                run,
                this.state.runs[run]["current_clustering"]
            );            
        } catch(e) {
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
        const runs = this.state.runs;
        const run = runs[state.run];
        const filters = run["filters"];
        
        // get us the ids of all the states in our simplified sequence
        const stateIds = this.props.trajectories[state.run].simplifiedSequence.uniqueStates;        
        const sequence = stateIds.map((state) => this.props.globalUniqueStates.get(state.id));        
        
        let func = null;
        let filterLabel = null;
        let filterType = null;
        let val = null;
        switch (state.filter_type) {
            case "MIN":
                func = filter_min_opacity;
                filterLabel = "At least";
                filterType = SLIDER;
                val = getMinProperty(state.attribute,sequence);
                break;
            case "MAX":
                func = filter_max_opacity;
                filterLabel = "At most";
                filterType = SLIDER;
                val = getMinProperty(state.attribute,sequence);
                break;
            case "RANGE":
                func = filter_range_opacity;
                filterLabel = "Between";
            filterType = RANGE_SLIDER;
            val = [
                      getMinProperty(state.attribute, sequence),
                      getMaxProperty(state.attribute, sequence),
            ];
                break;
            case "RELATION":
                func = filter_relationship;
                filterType = TOGGLE;
                val = false;
            break;
            default:
                alert("Unsupported filter type");
                filterLabel = "Unknown filter";
                func = null;
                break;
        }

        let id = null;
        let checkBoxLabel = null;
        if (state.filter_type == "RELATION") {
            id = `${state.attribute}_${state.relation_attribute}`
            checkBoxLabel = `Find common ${state.relation_attribute} with ${state.attribute} `
        } else {
            id = `${state.attribute}_${state.filter_type}`;
            checkBoxLabel = `Filter ${state.attribute}`;
        }

        filters[id] = {
            enabled: false,
            func: func,
            checkBoxLabel: checkBoxLabel,
            sliderLabel: filterLabel,
            type: filterType,
            extents: [
                getMinProperty(state.attribute, sequence),
                getMaxProperty(state.attribute, sequence),
            ],
            options: {                
                val: val,
                property: state.attribute,
                relation_attribute: state.relation_attribute,
            },
            id: id,
            group: 'g',
            className: [state.filter_type, "invisible"]
        };

        run.filters = filters;
        runs[state.run] = run;
        this.setState({ runs: runs });
    };

    simplifySet = (run, threshold) => {
        this.props.simplifySet(run, threshold);
    }
    
    // the pcca / threshold sliders are more than filters - they directly affect the dataset
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
                    <ListItem>
                        <Slider step={0.05}
                                min={0}
                                max={1}
                                onChangeCommitted={() => {
                                    console.log(this.state.runs[run].chunkingThreshold);
                                    this.simplifySet(run,this.state.runs[run].chunkingThreshold);
                                }}
                                valueLabelDisplay="auto"
                                onChange={(e) => {
                                    console.log(e.target.value);
                                    this.updateRun(run, "chunkingThreshold", e.target.value);
                                }}
                                value={this.state.runs[run].chunkingThreshold}
                        />
                    </ListItem>
                    <ListItem>
                        <ListItemText secondary={`${this.state.runs[run]["chunkingThreshold"] * 100}% chunking threshold`}/>                            
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

    
  render() {
        const runs = Object.keys(this.state.runs);
        const trajs = Object.keys(this.props.trajectories);
        const safe = (runs.length === trajs.length && runs.length > 0 && trajs.length > 0) ? true : false;
        const controls = this.renderControls(runs);

        return (
            <Box sx={{flexGrow: 1}}>
                {safe && (
                    <Drawer anchor="right" variant="persistent" onClose={this.props.toggleDrawer} open={this.props.drawerOpen}>
                        {safe && controls}
                        <Button color="error" size="small" variant="contained" onClick={() => {
                                    this.props.toggleDrawer();
                                }}>
                        Close</Button>
                    </Drawer>
                )}
                {this.state.isLoading && <LoadingModal
                                             open={this.state.isLoading}
                                             title="Rendering..."/> }
                {safe && (<Paper sx={{position: 'absolute', bottom: 0, width: '25%', height: '25%', 'background-color': 'white'}}>                              
                              <TrajectoryChart
                                  trajectories={this.props.trajectories}
                                  globalUniqueStates={this.props.globalUniqueStates}
                                  runs={this.state.runs}
                                  loadingCallback={this.chartFinishedLoading}
                                  setStateHovered={this.setStateHovered}
                                  setStateClicked={this.setStateClicked}
                                  stateHovered={this.state.stateHovered}
                                  lastEventCaller={this.state.lastEventCaller}
                              ></TrajectoryChart>

                          </Paper>
            )}
                    
                {safe &&
                 <GraphVis
                     trajectories={this.props.trajectories}
                     runs={this.state.runs}
                     globalUniqueStates={this.props.globalUniqueStates}
                     setStateHovered={this.setStateHovered}
                     setStateClicked={this.setStateClicked}
                     loadingCallback={this.chartFinishedLoading}
                     stateHovered={this.state.stateHovered}
                     lastEventCaller={this.state.lastEventCaller}
                 />
                }
                                         
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

            {this.state.currentModal === SINGLE_STATE_MODAL && (
                    <SingleStateModal
                        open={this.state.currentModal === SINGLE_STATE_MODAL}
                        state={this.props.globalUniqueStates.get(this.state.stateClicked.id)}
                        closeFunc={() => {
                            this.toggleModal(SINGLE_STATE_MODAL);                                                        
                        }}
                    />
            )}
        </Box>
        );
    }
}

export default VisGrid;
