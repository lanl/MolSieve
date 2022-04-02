import React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import CircularProgress from "@mui/material/CircularProgress";
import {api_calculate_NEB} from "../api/ajax";
import Scatterplot from "../vis/Scatterplot";
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import {TabPanel} from "../api/myutils";
import AnalysisTab from './AnalysisTab';
import KSTestTab from "./KSTestTab";
import MenuItem from "@mui/material/MenuItem";
import AjaxVideo from "../components/AjaxVideo";
import SelectionVis from "../vis/SelectionVis";
import TextField from "@mui/material/TextField";
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import Checkbox from '@mui/material/Checkbox';

import "../css/App.css";


class SelectionModal extends React.Component {

    constructor(props) {
        super(props);

        if(Object.keys(this.props.extents.length) > 0) {
            alert("Too many extents selected...");
            this.props.closeFunc();
        }
        
        const extents = this.props.extents[0];

        const currentRun = extents["name"];
        const start = extents["begin"];
        const end = extents["end"];

        const path = this.props.trajectories[currentRun].sequence.slice(start, end + 1);
        
        const pathVals = path.map((id) => {
            return this.props.globalUniqueStates.get(id);
        });

        this.state = {
            interpolate: 1,
            energies: [],
            run: currentRun,
            start: start,
            end: end,
            sequence: pathVals,     
            drawSequence: [],
            isLoading: false,
            tabIdx: 0,
            maxSteps: 2500,
            fmax: 0.01,
            saveResults: true,
            sse: ''
        }
    }

    parseSSE = (data) => {        
        this.setState({sse: data})
    }

    calculateNEB = () => {        
        const extents = this.props.extents[0];
        const run = extents["name"];
        const start = parseInt(extents["begin"]);
        const end = parseInt(extents["end"]);

        //const ss = new EventSource('/stream');

        //ss.onmessage = (e) => this.parseSSE(e.data);
        
        api_calculate_NEB(run, start, end, this.state.interpolate, this.state.maxSteps, this.state.fmax, this.state.saveResults).then((data) => {
            let drawSequence = [];
            let gap = 1 / this.state.interpolate;
            
            for(var i = 0; i < this.state.sequence.length - 1; i++) {
                drawSequence.push(this.state.sequence[i]);
                for(var j = 0; j < this.state.interpolate; j++) {
                    let stateCopy = { ...this.state.sequence[i] };
                    stateCopy.timestep += gap * (j + 1);                    
                    drawSequence.push(stateCopy);
                }
            }

            let unpackedEnergies = [];
            data.energies.map((energyList) => {
                for (var e of energyList) {
                    unpackedEnergies.push(e);
                }
            })
            
            this.setState({energies: unpackedEnergies, drawSequence: drawSequence, isLoading: false});
            //ss.close();
        }).catch((e) => {            
            alert(e);
            //ss.close();
            this.setState({isLoading: false});
        });        
        
    }
    
    closeFunc = () => {
        this.props.closeFunc();
    };

    render() {


        
        if (this.props.open) {

            
        var extent_options = this.props.extents.map((extent, i) => {
            return (
                <MenuItem key={i} value={JSON.stringify(extent)}>
                    {`${extent.name} ${extent.begin} - ${extent.end}`}
                </MenuItem>
            );
        });        

            let extent = this.props.extents[0];
            return (
                <Dialog
                    open={this.props.open}
                    onBackdropClick={() => this.closeFunc()}
                    maxWidth="lg"
                    fullWidth={true}>
                    <DialogTitle sx={{'height': 125}}>Single Path Selection: {`${extent.name} ${extent.begin} - ${extent.end}`}                        
                        <Tabs value={this.state.tabIdx} onChange={(_,v) => {this.setState({tabIdx: v})}}>
                            <Tab label="Info"/>
                            <Tab label="NEB"/>
                            <Tab label="Analysis"/>
                            <Tab label="Kolmogorov-Smirnov Test"/>
                        </Tabs>
                        
                        <SelectionVis
                            data={{
                                extents: this.props.extents,
                                sequence: this.props.trajectories[this.state.run].sequence,
                                run: this.state.run,
                                colors: this.props.trajectories[this.state.run].colors,
                                currentClustering: this.props.trajectories[this.state.run].idToCluster
                            }}
                        />
                        
                    </DialogTitle>
                    <TabPanel value={this.state.tabIdx} index={0}>
                        <DialogContent sx={{display:'flex', alignItems:'center', justifyContent:'center'}}>
                            <AjaxVideo run={this.state.run} start={this.state.start} end={this.state.end} />
                        </DialogContent>
                        <DialogActions>
                            <Button
                            size="small"
                            variant="contained"
                            color="error"
                            onClick={this.closeFunc}
                        >
                            Cancel
                        </Button>
                        </DialogActions>
                    </TabPanel>
                    <TabPanel value={this.state.tabIdx} index={1}>
                        <DialogContent style={{height: '400px'}}>
                            <Stack spacing={2} alignItems="center" justifyContent="center">                               
                                <h2>{parseInt(this.state.end) - parseInt(this.state.start) + " steps"}</h2>
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
                                    <FormControlLabel control={<Checkbox checked={this.state.saveResults}
                                                                         onChange={(e) => {this.setState({
                                                                             saveResults: e.target.checked
                                                                         })}}
                                                               />}
                                                      label="Save results to database"/>
                                </FormControl>                                
                        {!this.state.isLoading &&
                         <Scatterplot
                             data={{
                                 sequence: this.state.drawSequence,
                                 x_attribute: 'timestep',
                                 y_attribute: 'energies',
                                 y_attributeList: this.state.energies,
                                 path: true,
                                 colors: this.props.trajectories[this.state.run].colors,                                 
                             }} />}
                            {this.state.isLoading && <CircularProgress color="grey" style={{alignContent: 'center', justifyContent: 'center'}}/>}
                        </Stack>
                    </DialogContent>
                        <DialogActions>
                            <p>{this.state.sse}</p>
                        <Button onClick={() => {
                                    this.setState({isLoading: true});
                                    this.calculateNEB()
                                }} size="small" variant="contained">
                            Calculate NEB on Path
                        </Button>
                        <Button
                            size="small"
                            variant="contained"
                            color="error"
                            onClick={this.closeFunc}
                        >
                            Cancel
                        </Button>
                    </DialogActions>
                    </TabPanel>
                    <TabPanel value={this.state.tabIdx} index={2}>
                        <AnalysisTab run={this.state.run}                                    
                                     pathStart={this.state.start}
                                     pathEnd={this.state.end}
                                     closeFunc={() => {
                                         this.closeFunc(true);
                                     }} />
                    </TabPanel>
                    <TabPanel value={this.state.tabIdx} index={3}>
                        <KSTestTab closeFunc={this.closeFunc} rvs={extent_options} currentRun={this.state.run} rvsDefault={JSON.stringify(this.props.extents[0])} />
                    </TabPanel>
                </Dialog>
            );
        } else {
            return null;
        }
    }
}

export default SelectionModal;
