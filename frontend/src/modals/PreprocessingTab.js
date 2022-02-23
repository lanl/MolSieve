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

import axios from 'axios';

const OVITO = 'ovito_modifier';
const PYTHON = 'python_script';

class PreprocessingTab extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            run: this.props.run,
            steps: [],
            newStep: OVITO
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
                                          this.setState(steps, console.log(this.state));  
                                      }}>{options}</Select>)
                let newStep = {'type': OVITO, 'value': 'AcklandJonesModifier', 'render': select};
                this.setState({steps: [...this.state.steps, newStep]});                
            });            
            break;
        case PYTHON:
            break;
        default:
            alert("Unknown preprocessing step!");
            return;
        }
    }

    render() {
        var steps = (this.state.steps.length > 0) ? this.state.steps.map((step, idx) => {
            return (<ListItem key={idx}><h2>{`${idx + 1}. `}</h2>{step.render}</ListItem>);
        }): null;
        
        return (<Box><DialogContent>
                        <List>
                            {steps}
                            <ListItem key={this.state.steps.length + 1}>
                                <FormControl>
                                    <RadioGroup row value={this.state.newStep} onChange={(e) => {this.setState({newStep: e.target.value})}}>
                                        <FormControlLabel value={OVITO} control={<Radio />} label="Ovito Modifier" />
                                        <FormControlLabel value={PYTHON} control={<Radio />} label="Python Script" />                                    
                                    </RadioGroup>
                                </FormControl>
                                <Button variant="contained" size="small" onClick={() => {this.addStep()}}>Add new preprocessing step</Button>
                            </ListItem>
                        </List>
                    </DialogContent>
            <DialogActions>
                <Button size="small" variant="contained" color="secondary">Run preprocessing steps</Button>
                <Button size="small" variant="contained">Cancel</Button>
            </DialogActions></Box>);
    }
    
}

export default PreprocessingTab;
