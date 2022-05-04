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
import AjaxSelect from "../components/AjaxSelect";
import {api_performKSTest} from "../api/ajax";
import CheckboxTable from "../components/CheckboxTable";

class KSTestTab extends React.Component {
    constructor(props) {
        super(props);
        
        this.state = {
            ksProperty: "",
            isLoading: false,
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
        this.setState({ isLoading: true });
        if(this.state.ksProperty !== "") {            
            api_performKSTest(this.state.rvs, this.state.cdf, this.state.ksProperty).then((data) => {
                this.setState({ isLoading: false, ksTest: data});
            }).catch((error) => {
                alert(error);
                this.setState({isLoading: false});
            });

        } else {
            alert("Please select a property to perform the KS test with.")
            this.setState({isLoading : false});
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
                                            api_call='get_scipy_distributions'>
                                    {this.props.cdf !== undefined && this.props.cdf}
                                </AjaxSelect>                       
                                <FormHelperText>cdf</FormHelperText>                                    
                            </FormControl>
                        </Stack>
                        
                        {this.props.stateProperties !== undefined &&
                         <CheckboxTable header="State properties" itemProps={this.props.stateProperties} allowOnlyOneSelected click={this.setKSProperty} /> }

                        {this.props.stateProperties === undefined &&
                         <CheckboxTable header="State properties" api_call={`/get_property_list?run=${this.props.currentRun}`} allowOnlyOneSelected click={this.setKSProperty} /> }
                  
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

export default KSTestTab;
