import React from "react";
import Box from '@mui/material/Box';
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Button from "@mui/material/Button";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from '@mui/material/FormControlLabel';
import FormControl from '@mui/material/FormControl';
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import CircularProgress from "@mui/material/CircularProgress";
import Checkbox from '@mui/material/Checkbox';
import axios from 'axios';
import {DataGrid} from '@mui/x-data-grid';
import Stack from "@mui/material/Stack";

const OVITO = 'ovito_modifier';
const PYTHON = 'python_script';

class AnalysisTab extends React.Component {
    constructor(props) {
        super(props);

        let pathStart = null;
        let pathEnd = null;

        if(this.props.pathStart !== undefined) {
            pathStart = this.props.pathStart;
        }

        if(this.props.pathEnd !== undefined) {
            pathEnd = this.props.pathEnd;
        }
        
        this.state = {
            run: this.props.run,
            steps: [],
            newStep: OVITO,
            isLoading: false,
            response: null,
            pathStart: pathStart,
            pathEnd: pathEnd,
            displayResults: true,
            saveResults: true
        }
    }

    runSteps = () => {        
        if (this.state.steps.length > 0) {
            this.setState({isLoading: true});
            
            let steps = this.state.steps.map(step => {
                return {'analysisType': step['type'], 'value': step['value']};
            });
            
            axios.post('/run_analysis', steps, {params: {
                run: this.state.run, pathStart: this.state.pathStart,
                pathEnd: this.state.pathEnd, displayResults: this.state.displayResults,
                saveResults: this.state.saveResults
            }}).then((response) => {
                this.setState({isLoading: false, response: response.data});
            }).catch((e) => {
                alert(e);
                this.setState({isLoading: false});
            });
        } else {
            alert("Need to have at least one analysis step to run!");
        }
    }
    
    addStep = () => {
        switch(this.state.newStep) {
        case OVITO:
            axios.get('/get_ovito_modifiers').then((response) => {                
                let index = this.state.steps.length;
                let options = response.data.map((val, idx) => (<MenuItem key={idx} value={val}>{val}</MenuItem>));
                let select = (<Select defaultValue='AcklandJonesModifier' onChange={(e) => {
                                          let steps = this.state.steps;
                                          let step = steps[index];
                                          step['value'] = e.target.value;
                                          steps[index] = step;
                                          this.setState(steps);  
                                      }}>{options}</Select>)
                let newStep = {'type': OVITO, 'value': 'AcklandJonesModifier', 'render': select};
                this.setState({steps: [...this.state.steps, newStep]});                
            });            
            break;
        case PYTHON:
            break;
        default:
            alert("Unknown analysis step!");
            return;
        }
    }

    render() {
        var steps = (this.state.steps.length > 0) ? this.state.steps.map((step, idx) => {
            return (<ListItem key={idx}><h2>{`${idx + 1}. `}</h2>{step.render}</ListItem>);
        }): null;        
        
        var dataGrids = (this.state.response !== null ? Object.keys(this.state.response).map((response, idx) => {
            
            const data = Object.values(this.state.response[response]);
                       
            let rows =  [];
            let columns = [];
            let rowCount = 0;

            for(let key of Object.keys(data[0])) {
                columns.push({'field': key, 'headerName': key, 'flex': 1});
            }
            
            for(let state of data) {
                let row = Object.assign({}, state);                
                row['id'] = rowCount;
                rows.push(row);
                rowCount++;
            }
            
            if(response === 'info') {
                return null;
            }
            return (<Stack key={idx} sx={{'height': 350}}><h1>Step {idx + 1}</h1><DataGrid rows={rows} columns={columns}/></Stack>)
        }) : null);        
        
        return (<Box>
                    <DialogContent>
                        <List>
                            <ListItem key={-1}>
                                <FormControl>
                                    <FormControlLabel control={<Checkbox checked={this.state.displayResults}
                                                                 onChange={(e) => {this.setState({
                                                                     displayResults: e.target.checked
                                                                 })}}/>} label="Display results"/>
                                    <FormControlLabel control={<Checkbox checked={this.state.saveResults}
                                                                 onChange={(e) => {this.setState({
                                                                     saveResults: e.target.checked
                                                                 })}}
                                                       />} label="Save results to database"/>
                                </FormControl>
                                </ListItem>
                            <ListItem key={this.state.steps.length + 1}>
                                <FormControl>
                                    <RadioGroup row value={this.state.newStep} onChange={(e) => {this.setState({newStep: e.target.value})}}>
                                        <FormControlLabel value={OVITO} control={<Radio />} label="Ovito Modifier" />
                                        <FormControlLabel value={PYTHON} control={<Radio />} label="Python Script" />                                    
                                    </RadioGroup>
                                </FormControl>
                                <Button variant="contained" size="small" onClick={() => {this.addStep()}}>Add new analysis step</Button>
                            </ListItem>
                            {steps}
                        </List>
                        {this.state.isLoading && <CircularProgress/>}
                        {(!this.state.isLoading && dataGrids !== null && this.state.displayResults) && <Box>{dataGrids}</Box>}
                        {(!this.state.isLoading && this.state.response !== null) && <p>{this.state.response['info']}</p>}
                    </DialogContent>                                       
                    <DialogActions>
                        <Button size="small" disabled={this.state.isLoading} variant="contained" onClick={() => {this.runSteps()}} color="secondary">Run analysis steps</Button>
                        <Button size="small" disabled={this.state.isLoading} variant="contained" onClick={() => {this.props.closeFunc()}}>Cancel</Button>
                    </DialogActions>
                </Box>);
    }
    
}

export default AnalysisTab;
