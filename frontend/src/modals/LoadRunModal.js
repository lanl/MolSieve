import React from "react";
import Slider from "@mui/material/Slider";
import Button from "@mui/material/Button";
import DialogTitle from "@mui/material/DialogTitle";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContentText from "@mui/material/DialogContentText";
import DialogContent from "@mui/material/DialogContent";
import Stack from "@mui/material/Stack";
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import TextField from "@mui/material/TextField";

import CheckboxTable from "../components/CheckboxTable";
import {TabPanel} from "../api/myutils";
import AnalysisTab from './AnalysisTab';

const domain = [2, 20];
const defaultValues = [2, 4];

class LoadRunModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            values: defaultValues.slice(),
            clicked: ["occurrences", "number"],
            run: null,
            clusters: -1,
            optimal: 1,
            tabIdx: 0,
            chunkingThreshold: 0.75,
            simplifySequence: true,
        };
    }

    pullClicked = (_, clicked) => {
        this.setState({clicked: [...clicked]});
    };

    closeFunc = (uncheck) => {
        if (uncheck) {
            this.props.lastEvent.target.checked = false;
        }
        this.props.closeFunc();
    };

    componentDidMount() {
        this.setState({ run: this.props.run });
    }

    runFunc = () => {
        this.closeFunc(false);

        const chunkingThreshold = (this.state.simplifySequence) ? this.state.chunkingThreshold : 1;

        this.props.runFunc(
            this.state.run,
            -1,
            1,
            this.state.values[0],
            this.state.values[1],
            this.state.clicked,
            chunkingThreshold
        );
    };

    onChange = (_, v) => {
        this.setState({ values: v });
    };

    render() {
        if (this.props.isOpen) {
            let defaults = ["occurrences", "number"];

            return (
                <Dialog
                    onBackdropClick={() => this.closeFunc(true)}
                    open={this.props.isOpen}
                    fullWidth={true}
                    maxWidth="lg"                    
                >
                    <DialogTitle>
                        {this.props.run}                        
                        <Tabs value={this.state.tabIdx} onChange={(_,v) => { this.setState({tabIdx: v})}}>
                            <Tab label="Optimal Clustering" />
                            <Tab label="Analysis" />
                        </Tabs>
                    </DialogTitle>
                    <TabPanel value={this.state.tabIdx} index={0}>
                    <DialogContent>
                        <DialogContentText>
                            Select the cluster sizes that PCCA will try to
                            cluster the data into.
                        </DialogContentText>
                        <Stack
                            spacing={2}
                            direction="row"
                            alignItems="center"
                            justifyContent="center"
                        >
                            <Slider
                                step={1}
                                min={domain[0]}
                                max={domain[1]}
                                onChange={(e, v) => {
                                    this.onChange(e, v);
                                }}
                                valueLabelDisplay="auto"
                                value={this.state.values}
                            />
                            <b>
                                {this.state.values
                                    .toString()
                                    .replace(",", " - ")}{" "}
                                clusters
                            </b>
                        </Stack>
                        <Stack spacing={2} direction="row" alignItems="center" justifyContent="center">
                            <FormControlLabel
                                label="Simplify sequence?"
                                control={<Checkbox
                                             onChange={(e) => {this.setState({
                                                 simplifySequence: e.target.checked
                                             })}}
                                             checked={this.state.simplifySequence}/>}/>
                            
                            <TextField
                                fullWidth
                                disabled={!this.state.simplifySequence}
                                label="Chunk Threshold"
                                type="number"
                                inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', min: 1e-10, step:0.05 }}
                                defaultValue={ this.state.chunkingThreshold }
                                onChange={(e) => {this.setState({chunkingThreshold: e.target.value})}}
                             />
                        </Stack>
                        <p>Select which properties you wish to analyze.</p>
                        <CheckboxTable
                            click={this.pullClicked}
                            defaults={defaults}
                            header="Properties"
                            api_call={`/get_property_list?run=${this.props.run}`}
                        />
                    </DialogContent>
                    <DialogActions>
                        <Button
                            size="small"
                            variant="contained"
                            onClick={this.runFunc}
                        >
                            Calculate
                        </Button>
                        <Button
                            size="small"
                            variant="contained"
                            color="error"
                            onClick={() => {
                                this.closeFunc(true);
                            }}
                        >
                            Cancel
                        </Button>
                    </DialogActions>
                    </TabPanel>
                    <TabPanel value={this.state.tabIdx} index={1}>
                        <AnalysisTab run={this.props.run} closeFunc={() => {
                                         this.closeFunc(true);
                                     }}/>
                    </TabPanel>
                </Dialog>
            );
        } else {
            return null;
        }
    }
}

export default LoadRunModal;
