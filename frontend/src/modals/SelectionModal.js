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

class SelectionModal extends React.Component {

    constructor(props) {
        super(props);        
        const extents = this.props.extents[0];

        const currentRun = extents["name"];
        const start = extents["begin"]["timestep"];
        const end = extents["end"]["timestep"];
        
        this.state = {
            interpolate: 1,
            energies: [],
            run: currentRun,
            start: start,
            end: end,
            sequence: this.props.trajectories[currentRun].sequence.slice(start, end + 1),
            drawSequence: [],
            isLoading: false,
            tabIdx: 0
        }
    }

    calculateNEB = () => {        
        const extents = this.props.extents[0];
        const run = extents["name"];
        const start = parseInt(extents["begin"]["timestep"]);
        const end = parseInt(extents["end"]["timestep"]);
        
        api_calculate_NEB(run, start, end, this.state.interpolate).then((data) => {
            let drawSequence = [];
            let gap = 1 / this.state.interpolate;
            
            for(var i = 0; i < this.state.sequence.length - 1; i++) {
                drawSequence.push(this.state.sequence[i]);
                for(var j = 0; j < this.state.interpolate; j++) {
                    let stateCopy = { ...this.state.sequence[i] };
                    stateCopy["timestep"] += gap * (j + 1);                    
                    drawSequence.push(stateCopy);
                }
            }

            let unpackedEnergies = [];
            data.energies.map((energyList) => {
                for (var e of energyList) {
                    unpackedEnergies.push(e);
                }
            })
            
            this.setState({energies: unpackedEnergies, drawSequence: drawSequence, isLoading: false}, () => {console.log(this.state)});
        }).catch((e) => {            
            alert(e);
            this.setState({isLoading: false});
        });        
        
    }
    
    closeFunc = () => {
        this.props.closeFunc();
    };

    render() {

        var extent_options = this.props.extents.map((extent, i) => {
            return (
                <MenuItem key={i} value={JSON.stringify(extent)}>
                    {`${extent.name} ${extent.begin.timestep} - ${extent.end.timestep}`}
                </MenuItem>
            );
        });        
        
        if (this.props.open) {
            return (
                <Dialog
                    open={this.props.open}
                    onBackdropClick={() => this.closeFunc()}
                    maxWidth="lg"
                    fullWidth={true}>
                    <DialogTitle>{this.props.title}
                        <Tabs value={this.state.tabIdx} onChange={(_,v) => {this.setState({tabIdx: v})}}>
                            <Tab label="NEB"/>
                            <Tab label="Analysis"/>
                            <Tab label="Kolmogorov-Smirnov Test"/>
                        </Tabs>
                    </DialogTitle>
                    <TabPanel value={this.state.tabIdx} index={0}>
                        <DialogContent style={{height: '400px'}}>
                        <Stack spacing={2} alignItems="center" justifyContent="center">
                            <Stack direction="row">
                                <label htmlFor="txt_path_neb">
                                    Number of images interpolated between points on NEB:
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    name="txt_path_neb"
                                    defaultValue={this.state.interpolate}
                                    onChange={(e) => {                                
                                        this.setState({interpolate: e.target.value});
                                    }}
                                />
                            </Stack>
                        
                        {!this.state.isLoading &&
                         <Scatterplot
                             data={{
                                 sequence: this.state.drawSequence,
                                 x_attribute: 'timestep',
                                 y_attribute: 'energies',
                                 y_attributeList: this.state.energies,
                                 path: true
                             }} />}
                            {this.state.isLoading && <CircularProgress color="grey" style={{alignContent: 'center', justifyContent: 'center'}}/>}
                        </Stack>
                    </DialogContent>
                    <DialogActions>
                        <Button onClick={() => {
                                           this.setState({isLoading: true});
                                           this.calculateNEB()}} size="small" variant="contained">
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
                    <TabPanel value={this.state.tabIdx} index={1}>
                        <AnalysisTab run={this.state.run}                                    
                                     pathStart={this.state.start}
                                     pathEnd={this.state.end}
                                     closeFunc={() => {
                                         this.closeFunc(true);
                                     }} />
                    </TabPanel>
                    <TabPanel value={this.state.tabIdx} index={2}>
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
