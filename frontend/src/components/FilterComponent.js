import React from "react";

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Slider from '@mui/material/Slider';

const RANGE_SLIDER = "range";
const SLIDER = "slider";
const TOGGLE = "toggle";

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

    render_slider = (filter, slider_label) => {
        const domain = filter.extents;
        return (
            <Box>
                <Slider
                    min={domain[0]}
                    max={domain[1]}
                    step={1}
                    onChangeCommitted={(e,v) => {
                        this.setValues(e,v);
                        if (this.state.enabled) {
                            this.propagateChange();
                        }
                    }}
                    onChange={(e,v) => {
                        this.setValues(e,v);
                    }}
                    value={this.state.options.val}
                    valueLabelDisplay="auto"                    
                />
                <br />
                <label>
                    {slider_label}
                </label>
            </Box>
        );
    }

    render() {
        const filter = this.props.filter;
        let slider_label = null;
        let slider = null;

        switch(filter.type) {
        case TOGGLE:
            break;
        case SLIDER:
            if (filter.options.property) {
                slider_label =
                    (<label>
                         {filter.sliderLabel}{" "}
                         {this.state.options.val}{" "}
                         {filter.options.property}
                     </label>);
            } else {
                slider_label =
                    (<label>
                         {this.state.options.val}
                     </label>);
            }
            slider = this.render_slider(filter, slider_label);
            break;
        case RANGE_SLIDER:
            slider_label =
                (<label>
                     {filter.sliderLabel}{" "}
                     {this.state.options.val[0]}{" and "}
                     {this.state.options.val[1]}{" "}
                     {this.state.options.property}
                 </label>);
            slider = this.render_slider(filter, slider_label);
            break;
        }
        return (
            <Box>
                <FormControlLabel control={<Checkbox checked={this.state.enabled} onChange={() => { this.checkAndPropagateChange(); }}/>} label={filter.checkBoxLabel}/>
                {slider && slider}
                {filter.children && filter.children(this.actions)}
            </Box>
        );
    }
}

//{this.props.render(this.state, this.getActions())}

export default FilterComponent;
