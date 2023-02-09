import React from 'react';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import Select from '@mui/material/Select';

import { withSnackbar } from 'notistack';

import { apiPerformKSTest, onMessageHandler } from '../api/ajax';

import AjaxSelect from '../components/AjaxSelect';
import CheckboxTable from '../components/CheckboxTable';
/* eslint-disable */
class KSTestTab extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            ksProperty: '',
            rvs: this.props.rvsDefault,
            cdf: { value: 'norm', name: 'norm' },
        };
    }

    setKSProperty = (clicked) => {
        this.setState({ ksProperty: clicked[0] });
    };

    setCDF = (v, obj) => {
        console.log(v);
        console.log(obj.props.name);
        this.setState({
            cdf: { value: v, name: obj.props.name },
        });
    };

    closeFunc = () => {
        this.props.closeFunc();
    };

    performKSTest = () => {
        if (this.state.ksProperty !== '') {
            console.log(this.state.rvs);
            apiPerformKSTest(this.state.rvs.value, this.state.cdf.value, this.state.ksProperty)
                .then((id) => {
                    const client = new WebSocket(`ws://localhost:8000/api/ws/${id}`);
                    client.onmessage = onMessageHandler(
                        () => {
                            this.props.enqueueSnackbar(`Task ${id} started.`);
                        },
                        (data) => {
                            this.props.enqueueSnackbar(`Task ${id}: ${data.message}`);
                        },
                        (data) => {
                            this.props.enqueueSnackbar(`Task ${id} complete.`);
                            this.props.addKSTestResult(
                                this.state.rvs.name,
                                this.state.cdf.name,
                                this.state.ksProperty,
                                data.data.statistic,
                                data.data.pvalue,
                                this.props.extentsID
                            );
                            client.close();
                        }
                    );
                })
                .catch((error) => {
                    alert(error);
                });
        } else {
            alert('Please select a property to perform the KS test with.');
        }
    };

    render() {
        return (
            <>
                <DialogContent>
                    <p>Please choose how the test should be performed.</p>
                    <Stack spacing={2} direction="row">
                        <FormControl>
                            <Select
                                value={this.state.rvs.value}
                                onChange={(e, obj) => {
                                    this.setState({
                                        rvs: { value: e.target.value, name: obj.props.name },
                                    });
                                }}
                            >
                                {this.props.rvs !== undefined && this.props.rvs}
                            </Select>
                            <FormHelperText>rvs</FormHelperText>
                        </FormControl>
                        <FormControl>
                            <AjaxSelect
                                change={this.setCDF}
                                defaultValue={this.state.cdf.value}
                                api_call="/api/get_scipy_distributions"
                            >
                                {this.props.cdf !== undefined && this.props.cdf}
                            </AjaxSelect>
                            <FormHelperText>cdf</FormHelperText>
                        </FormControl>
                    </Stack>

                    {this.props.stateProperties !== undefined && (
                        <CheckboxTable
                            header="State properties"
                            itemProps={this.props.stateProperties}
                            selectOnlyOne
                            clickedProps={[this.state.ksProperty]}
                            click={this.setKSProperty}
                        />
                    )}

                    {this.props.stateProperties === undefined && (
                        <CheckboxTable
                            header="State properties"
                            api_call={`/api/get_property_list?run=${this.props.currentRun}`}
                            selectOnlyOne
                            click={this.setKSProperty}
                            clickedProps={[this.state.ksProperty]}
                        />
                    )}
                </DialogContent>
                <DialogActions>
                    <Button size="small" onClick={this.performKSTest}>
                        Perform KS Test
                    </Button>
                    <Button onClick={this.closeFunc} size="small" color="secondary">
                        Close
                    </Button>
                </DialogActions>
            </>
        );
    }
}

export default withSnackbar(KSTestTab);
