import React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import {api_calculate_NEB} from "../api/ajax";
import MenuItem from "@mui/material/MenuItem";
import TextField from "@mui/material/TextField";
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import Checkbox from '@mui/material/Checkbox';
import Select from '@mui/material/Select';

import "../css/App.css";
import {isPath} from "../api/myutils";
import { onMessageHandler } from '../api/ajax';

import { withSnackbar } from "notistack";

class NEBModal extends React.Component {

    constructor(props) {
        super(props);       

        this.state = {
            interpolate: 1,
            energies: [],
            currentExtent: this.props.extents[0],
            drawSequence: [],
            maxSteps: 2500,
            fmax: 0.01,
            saveResults: true,
        }
    }

    calculateNEB = () => {        
        const extents = this.props.extents[0];
        const run = extents["name"];
        const start = extents["begin"];
        const end = extents["end"];
        
        api_calculate_NEB(run, start, end, this.state.interpolate, this.state.maxSteps, this.state.fmax, this.state.saveResults).then((id) => {
            const client = new WebSocket(`ws://localhost:8000/api/ws/${id}`);                
            client.onmessage = onMessageHandler(() => {
                this.props.enqueueSnackbar(`Task ${id} started.`);
            }, (data) => {
                this.props.enqueueSnackbar(`Task ${id}: ${data.message}`);
            }, (response) => {
                const data = response.data;
                let drawSequence = [];
                let gap = 1 / this.state.interpolate;

                const path = this.props.trajectories[this.state.currentExtent.name].sequence.slice(start, end + 1);
        
                const pathVals = path.map((id) => {
                    return this.props.globalUniqueStates.get(id);
                });
            
                for(let i = 0; i < pathVals.length - 1; i++) {
                    const state = {...pathVals[i]};
                    state.timestep = start + i;
                    drawSequence.push(state);
                
                    for(let j = 0; j < this.state.interpolate; j++) {
                        let stateCopy = { ...state };
                        stateCopy.timestep += gap * (j + 1);                    
                        drawSequence.push(stateCopy);
                    }
                }

                let unpackedEnergies = [];
                data.energies.map((energyList) => {               
                    for (const e of energyList) {
                        unpackedEnergies.push(e);
                    }
                })
                this.props.enqueueSnackbar(`Task ${id} complete.`);
                this.props.addNEBPlot(unpackedEnergies, drawSequence);                
            });    
        }).catch((e) => {            
            alert(e);
        });        
        
    }
    
    closeFunc = () => {
        this.props.closeFunc();
    };

    render() {        
        if (this.props.open) {            
            const extent_options = this.props.extents.map((extent, i) => {
                if(isPath(extent)) {
                    return (
                        <MenuItem key={i} value={JSON.stringify(extent)}>
                            {`${extent.name} ${extent.begin} - ${extent.end}`}
                        </MenuItem>
                    );
                }                
                return null;
            });
            
            return (
                <Dialog
                    open={this.props.open}
                    onBackdropClick={() => this.closeFunc()}
                    maxWidth="xs"
                    fullWidth={true}>
                    <DialogTitle>
                        NEB
                    </DialogTitle>                    
                        <DialogContent>
                            <Stack spacing={2}>
                                <Select value={JSON.stringify(this.state.currentExtent)} onChange={(e) => {JSON.parse(this.setState(e.target.value))}}>
                                    {extent_options}
                                </Select>
                                <h4>{`${this.state.currentExtent.end - this.state.currentExtent.begin} steps`}</h4>
                                <TextField
                                    label="Number of images interpolated between points on NEB:"
                                    fullWidth
                                    type="number"
                                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', min: 1 }}
                                    defaultValue={this.state.interpolate}
                                    onChange={(e) => {this.setState({interpolate: e.target.value})}}
                                />
                                <TextField
                                    fullWidth
                                    label="Maximum number of optimization steps"
                                    type="number"
                                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', min: 1 }}
                                    defaultValue={this.state.maxSteps}
                                    onChange={(e) => {this.setState({maxSteps: e.target.value})}}
                               />                        
                            <TextField
                                    fullWidth
                                    label="fmax"
                                    type="number"
                                    inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', min: 1e-10, step:0.01 }}
                                    defaultValue={this.state.fmax}
                                    onChange={(e) => {this.setState({fmax: e.target.value})}}
                               />                        
                                <FormControl>                                     
                                    <FormControlLabel control={<Checkbox
                                                                   size="small"
                                                                   checked={this.state.saveResults}
                                                                   onChange={(e) => {this.setState({
                                                                       saveResults: e.target.checked
                                                                   })}}
                                                               />}
                                                      label="Save results to database"/>
                                </FormControl>                                
                        </Stack>
                    </DialogContent>
                        <DialogActions>
                            <Button onClick={() => {
                                        this.calculateNEB()
                                    }} size="small">
                                Calculate NEB on Path
                            </Button>
                            <Button
                                size="small"
                                color="secondary"
                                onClick={this.closeFunc}
                            >
                                Close
                            </Button>
                        </DialogActions>
                </Dialog>
            );
        } else {
            return null;
        }
    }
}

export default withSnackbar(NEBModal);
