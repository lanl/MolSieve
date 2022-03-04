import React from "react";
import DialogTitle from "@mui/material/DialogTitle";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import Stack from "@mui/material/Stack";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import FormHelperText from "@mui/material/FormHelperText";
import FormControl from "@mui/material/FormControl";
import Scatterplot from "../vis/Scatterplot.js";
import CircularProgress from "@mui/material/CircularProgress";
import Grid from "@mui/material/Grid";
import { intersection } from "../api/myutils";
import { api_calculate_path_similarity } from "../api/ajax";
import CheckboxTable from "../components/CheckboxTable";

import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import {TabPanel} from "../api/myutils";
import KSTestTab from "./KSTestTab";

class MultiplePathSelectionModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = { cmn: null, x_attribute: null, y_attribute: null, tabIdx: 0, atomProperties: [], stateProperties: []};
    }
    
    addAtomProperty = (_, clicked) => {
        this.setState({atomProperties: [...clicked]});
    };

    addStateProperty = (_, clicked) => {
        this.setState({stateProperties: [...clicked]});
    };

    componentDidMount() {
        var propList = [];
        for (var i = 0; i < this.props.extents.length; i++) {
            propList.push(
                this.props.trajectories[this.props.extents[i]["name"]]
                    .properties
            );
        }

        var cmn = intersection(propList);

        if (this.state.x_attribute == null && this.state.y_attribute == null) {
            this.setState({
                cmn: cmn,
                x_attribute: cmn[0],
                y_attribute: cmn[0],
                extent1: JSON.stringify(this.props.extents[0]),
                extent2: JSON.stringify(this.props.extents[1]),
                rvs: JSON.stringify(this.props.extents[0]),
                cdf: JSON.stringify(this.props.extents[1]),
                similarity: null,
                isLoading: false,
            });
        }
    }

    setX = (e) => {
        this.setState({ x_attribute: e.target.value });
    };

    setY = (e) => {
        this.setState({ y_attribute: e.target.value });
    };

    calculatePathSimilarity = () => {
        this.setState({ isLoading: true });        
        if(this.state.stateProperties.length === 0 && this.state.atomProperties.length === 0) {
            alert("Please choose some properties to calculate the path similarity with!");
            this.setState({isLoading: false});
        } else {            
            api_calculate_path_similarity(
                this.state.extent1,
                this.state.extent2,
                this.state.stateProperties,
                this.state.atomProperties
            ).then((data) => {
                this.setState({ isLoading: false, similarity: data });
            }).catch((error) => {
                alert(error);
                this.setState({ isLoading: false});
            });
        }
    };


    closeFunc = () => {
        this.props.closeFunc();
    };

    render() {
        if (this.props.open && this.state.cmn) {
            let properties = this.state.cmn;
            var options = properties.map((property) => {
                return (
                    <MenuItem key={property} value={property}>
                        {property}
                    </MenuItem>
                );
            });

            var extent_options = this.props.extents.map((extent, i) => {
                return (
                    <MenuItem key={i} value={JSON.stringify(extent)}>
                        {`${extent.name} ${extent.begin.timestep} - ${extent.end.timestep}`}
                    </MenuItem>
                );
            });

            var scatterplots = this.props.extents.map((extent, i) => {
                return (
                    <Grid key={i} item xs={6}>
                        <Scatterplot
                            data={{
                                sequence: this.props.trajectories[
                                    extent.name
                                ].sequence.slice(
                                    extent.begin.timestep,
                                    extent.end.timestep + 1
                                ),
                                x_attribute: this.state.x_attribute,
                                y_attribute: this.state.y_attribute,
                                title: `${extent.name} ${extent.begin.timestep} - ${extent.end.timestep}`,
                            }}
                        />
                    </Grid>
                );
            });

            var similarityText = null;

            if (!this.state.similarity && !this.state.isLoading) {
                similarityText = (
                    <p></p>
                );
            } else if (this.state.isLoading) {
                similarityText = <CircularProgress color="grey" />;
            } else {
                let extent1 = JSON.parse(this.state.extent1);
                let extent2 = JSON.parse(this.state.extent2);
                similarityText = (
                    <p>
                        Similarity between{" "}
                        {`${extent1.name} ${extent1.begin.timestep} - ${extent1.end.timestep}`}{" "}
                        and{" "}
                        {`${extent2.name} ${extent2.begin.timestep} - ${extent2.end.timestep}`}{" "}
                        is {this.state.similarity}{" "}
                    </p>
                );
            }

            return (
                <Dialog
                    onClose={this.closeFunc}
                    onBackdropClick={() => this.closeFunc()}
                    open={this.props.open}
                    fullWidth={true}
                    maxWidth="lg"
                >
                    <DialogTitle>{this.props.title}
                        <Tabs value={this.state.tabIdx} onChange={(_, v) => { this.setState({ tabIdx: v }) }}>
                            <Tab label="X-Y Plots" disabled={this.state.isLoading} />
                            <Tab label="Path Similarity" disabled={this.state.isLoading} />
                            <Tab label="Kolmogorov-Smirnov Test" disabled={this.state.isLoading} />
                        </Tabs>
                    </DialogTitle>
                    <TabPanel value={this.state.tabIdx} index={0}>
                        <DialogContent>
                            <Stack spacing={2} direction="column">
                                <p>Select which attributes to render in the X-Y plots.</p>
                                <Stack
                                    spacing={2}
                                    direction="row"
                                >
                                    <FormControl>
                                        <Select
                                            name="select_x_attribute"
                                            value={this.state.x_attribute}
                                            onChange={(e) => {
                                                this.setX(e);
                                            }}
                                        >
                                            {options}
                                        </Select>
                                        <FormHelperText>X attribute</FormHelperText>
                                    </FormControl>
                                    <FormControl>
                                        <Select
                                            name="select_y_attribute"
                                            value={this.state.y_attribute}
                                            onChange={(e) => {
                                                this.setY(e);
                                            }}
                                        >
                                            {options}
                                        </Select>
                                        <FormHelperText>Y attribute</FormHelperText>
                                    </FormControl>
                                </Stack>

                                <Stack
                                    spacing={2}
                                    direction="column"
                                >
                                </Stack>
                                <Grid
                                    direction="row"
                                    justifyContent="space-evenly"
                                    container
                                    spacing={2}
                                >
                                    {scatterplots}
                                </Grid>
                            </Stack>
                        </DialogContent>
                        <DialogActions>
                            <Button onClick={this.closeFunc} disabled={this.state.isLoading}>Close</Button>
                        </DialogActions>
                    </TabPanel>
                    <TabPanel value={this.state.tabIdx} index={1}>
                        <DialogContent>
                            <Stack
                                spacing={2}>
                                <p>Select which two paths to compare.</p>
                                <Stack
                                    spacing={2}
                                    direction="row">
                                    <FormControl>
                                        <Select
                                            value={this.state.extent1}
                                            onChange={(e) => {
                                                this.setState({
                                                    extent1: e.target.value,
                                                });
                                            }}>
                                            {extent_options}
                                        </Select>
                                        <FormHelperText>Path 1</FormHelperText>
                                    </FormControl>
                                    <FormControl>
                                        <Select
                                            value={this.state.extent2}
                                            onChange={(e) => {
                                                this.setState({
                                                    extent2: e.target.value,
                                                });
                                            }}
                                        >
                                            {extent_options}
                                        </Select>
                                        <FormHelperText>Path 2</FormHelperText>
                                    </FormControl>
                                </Stack>
                                <CheckboxTable header="State properties" items={this.state.cmn} click={this.addStateProperty} />
                                <CheckboxTable header="Atom properties" api_call={`/get_atom_properties`} click={this.addAtomProperty} />
                                {similarityText}
                            </Stack>
                        </DialogContent>
                        <DialogActions>
                            <Button
                                variant="contained"
                                onClick={this.calculatePathSimilarity}
                                disabled={this.state.isLoading}
                            >
                                Calculate path similarity
                            </Button>
                            <Button onClick={this.closeFunc} disabled={this.state.isLoading}>Close</Button>
                        </DialogActions>
                    </TabPanel>
                    <TabPanel value={this.state.tabIdx} index={2}>
                        <KSTestTab closeFunc={this.closeFunc} cdf={extent_options} rvs={extent_options} rvsDefault={JSON.stringify(this.props.extents[0])} stateProperties={this.state.cmn} />
                    </TabPanel>
                </Dialog>
            );
        } else {
            return null;
        }
    }
}

export default MultiplePathSelectionModal;
