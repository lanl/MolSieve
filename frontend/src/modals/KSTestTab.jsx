import React from "react";
import Box from '@mui/material/Box';
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import CircularProgress from "@mui/material/CircularProgress";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import Select from "@mui/material/Select";

import { withSnackbar } from 'notistack';

import {api_performKSTest, onMessageHandler} from "../api/ajax";

import AjaxSelect from "../components/AjaxSelect";
import CheckboxTable from "../components/CheckboxTable";

class KSTestTab extends React.Component {
    constructor(props) {
        super(props);
        
        this.state = {
            ksProperty: "",
            rvs: this.props.rvsDefault,
            cdf: 'norm'
        }
    }

    setKSProperty = (clicked) => {
        this.setState({ksProperty: clicked[0]});
    }

    setCDF = (v) => {
        this.setState({
            cdf: v
        });
    }

    closeFunc = () => {
        this.props.closeFunc();
    };

    performKSTest = () => {        
        if(this.state.ksProperty !== "") {            
            api_performKSTest(this.state.rvs, this.state.cdf, this.state.ksProperty).then((id) => {
                const client = new WebSocket(`ws://localhost:8000/api/ws/${id}`);                
                client.onmessage = onMessageHandler(
                    () => {
                        this.props.enqueueSnackbar(`Task ${id} started.`);                        
                    },
                    (data) => {
                        this.props.enqueueSnackbar(`Task ${id}: ${data.message}`);
                    },
                    (data) => {
                        console.log(data.data);
                        this.props.enqueueSnackbar(`Task ${id} complete.`);
                        client.close();
                    });                            
            }).catch((error) => {
                alert(error);
            });
        } else {
            alert("Please select a property to perform the KS test with.")
        }
       
    };

    render() {
        var ksTestText = null;

        if (!this.state.ksTest && !this.state.isLoading) {
            ksTestText = (<p></p>);
        } else if (this.state.isLoading) {
            ksTestText = (<Box style={{alignItems: 'center', justifyContent:'center'}}><CircularProgress color="grey" /></Box>);
        } else {
            ksTestText = (<p>Statistic: {`${this.state.ksTest['statistic']}`}; <br />
                          P-value: {`${this.state.ksTest['pvalue']}`}</p>);
        }
        
        return (<>
                    <DialogContent>
                        <p>Please choose how the test should be performed.</p>
                        <Stack
                            spacing={2}
                            direction="row">
                            <FormControl>
                                <Select
                                    value={this.state.rvs}
                                    onChange={(e) => {
                                        this.setState({
                                            rvs: e.target.value,
                                        });
                                    }}>
                                    {this.props.rvs !== undefined && this.props.rvs}                                   
                                </Select>
                                <FormHelperText>rvs</FormHelperText>
                            </FormControl>
                            <FormControl>
                                <AjaxSelect change={this.setCDF}
                                            defaultValue={this.state.cdf}
                                            api_call='/api/get_scipy_distributions'>
                                    {this.props.cdf !== undefined && this.props.cdf}
                                </AjaxSelect>                       
                                <FormHelperText>cdf</FormHelperText>                                    
                            </FormControl>
                        </Stack>
                        
                        {this.props.stateProperties !== undefined &&
                         <CheckboxTable header="State properties" itemProps={this.props.stateProperties} allowOnlyOneSelected click={this.setKSProperty} /> }

                        {this.props.stateProperties === undefined &&
                         <CheckboxTable header="State properties" api_call={`/api/get_property_list?run=${this.props.currentRun}`} allowOnlyOneSelected click={this.setKSProperty} /> }
                  
                        {ksTestText}
                        </DialogContent>
                        <DialogActions>
                            <Button
                                size="small"
                                onClick={this.performKSTest}

                            >
                                Perform KS Test
                            </Button>
                            <Button onClick={this.closeFunc} size="small" color="secondary">Close</Button>
                        </DialogActions>
                    </>
               );
    }
}

export default withSnackbar(KSTestTab);
