import React from "react";
import CheckboxTable from "../components/CheckboxTable";
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
import {TabPanel} from "../api/myutils";
import PreprocessingTab from './PreprocessingTab';

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
            tabIdx: 0
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
        
        this.props.runFunc(
            this.state.run,
            -1,
            1,
            this.state.values[0],
            this.state.values[1],
            this.state.clicked
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
                            <Tab label="Preprocessing" />
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
                        <PreprocessingTab run={this.props.run}/>
                    </TabPanel>
                </Dialog>
            );
        } else {
            return null;
        }
    }
}

export default LoadRunModal;
