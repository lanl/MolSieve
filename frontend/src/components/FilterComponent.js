import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';

import React from "react";

class FilterComponent extends React.Component {
    constructor(props) {
        super(props);
        const filter = this.props.filter;

        this.state = {
            options: filter.options,
            enabled: false,
            run: this.props.run,
            id: filter.id,
            extents: filter.extents,
        };
    }

    checkAndPropagateChange = () => {
        this.setState({ enabled: !this.state.enabled }, () => {
            this.props.propagateChange(this.state);
        });
    };

    propagateChange = () => {
        this.props.propagateChange(this.state);
    };

    setValue = (e) => {
        let options = this.state.options;
        options.val = e.target.value;
        this.setState({ options });
    };

    setValues = (_, v) => {
        let options = this.state.options;
        options.val = v;
        this.setState({ options });
    };

    setMode = (e) => {
        let options = this.state.options;
        let extents = this.state.extents;
        if (e.target.value === "abs") {
            // later make this 1 - trajectory size
            extents = [1, 500];
        } else {
            extents = [1, 100];
        }

        options.selectVal = e.target.value;

        this.setState({ options, extents });
    };

    getActions = () => {
        return {
            propagateChange: this.propagateChange,
            setValue: this.setValue,
            setMode: this.setMode,
            setValues: this.setValues,
        };
    };

    render() {
        const filter = this.props.filter;
        return (
            <Box>
                <FormControlLabel control={<Checkbox checked={this.state.enabled} onChange={() => { this.checkAndPropagateChange(); }}/>} label={filter.checkBoxLabel}/>
                {this.props.render(this.state, this.getActions())}
            </Box>
        );
    }
}

export default FilterComponent;
