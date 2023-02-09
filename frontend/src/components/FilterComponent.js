import React from 'react';

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';
import SettingsIcon from '@mui/icons-material/Settings';
import AjaxMenu from './AjaxMenu';

const RANGE_SLIDER = 'range';
const SLIDER = 'slider';
const TOGGLE = 'toggle';

/* eslint-disable */
class FilterComponent extends React.Component {
    constructor(props) {
        super(props);
        const { filter, run } = this.props;
        this.openMenuButton = React.createRef();
        this.state = {
            options: filter.options,
            enabled: false,
            run,
            id: filter.id,
            extents: filter.extents,
            menuOpen: false,
            enabledFor: filter.enabledFor,
        };
    }

    checkAndPropagateChange = () => {
        this.setState(
            (prevState) => ({ enabled: !prevState.enabled }),
            () => {
                const { propagateChange } = this.props;
                propagateChange(this.state);
            }
        );
    };

    propagateChange = () => {
        const { propagateChange } = this.props;
        propagateChange(this.state);
    };

    toggleMenu = () => {
        this.setState((prevState) => ({ menuOpen: !prevState.menuOpen }));
    };

    /* setValue = (e) => {
        const { options } = this.state;
        options.val = e.target.value;
        this.setState({ options });
    }; */

    setValues = (_, v) => {
        const { options } = this.state;
        options.val = v;
        this.setState({ options });
    };

    setEnabledFor = (e, v) => {
        if (e.target.checked) {
            this.setState(
                (prevState) => ({ enabledFor: [...prevState.enabledFor, v] }),
                () => {
                    this.propagateChange();
                }
            );
        } else {
            const { enabledFor } = this.state;
            const idx = enabledFor.indexOf(v);
            this.setState(
                (prevState) => ({ enabledFor: prevState.enabledFor.filter((_, i) => i !== idx) }),
                () => {
                    this.propagateChange();
                }
            );
        }
    };

    /* setMode = (e) => {
        const { options } = this.state;
        let { extents } = this.state;
        if (e.target.value === 'abs') {
            // later make this 1 - trajectory size
            extents = [1, 500];
        } else {
            extents = [1, 100];
        }

        options.selectVal = e.target.value;

        this.setState({ options, extents });
    }; */

    /* getActions = () => {
        return {
            propagateChange: this.propagateChange,
            setValue: this.setValue,
            setMode: this.setMode,
            setValues: this.setValues,
        };
    }; */

    render_slider = (filter, sliderLabel) => {
        const domain = filter.extents;
        const { enabled, options } = this.state;
        return (
            <Box>
                <Slider
                    min={domain[0]}
                    max={domain[1]}
                    step={1}
                    onChangeCommitted={(e, v) => {
                        this.setValues(e, v);
                        if (enabled) {
                            this.propagateChange();
                        }
                    }}
                    onChange={(e, v) => {
                        this.setValues(e, v);
                    }}
                    value={options.val}
                    valueLabelDisplay="auto"
                />
                <br />
                <label>{sliderLabel}</label>
            </Box>
        );
    };

    render() {
        const { filter } = this.props;
        let sliderLabel = null;
        let slider = null;

        switch (filter.type) {
            case TOGGLE:
                break;
            case SLIDER:
                if (filter.options.property) {
                    sliderLabel = (
                        <label>
                            {filter.sliderLabel} {this.state.options.val} {filter.options.property}
                        </label>
                    );
                } else {
                    sliderLabel = <label>{this.state.options.val}</label>;
                }
                slider = this.render_slider(filter, sliderLabel);
                break;
            case RANGE_SLIDER:
                sliderLabel = (
                    <label>
                        {filter.sliderLabel} {this.state.options.val[0]}
                        {' and '}
                        {this.state.options.val[1]} {this.state.options.property}
                    </label>
                );
                slider = this.render_slider(filter, sliderLabel);
                break;
            default:
                break;
        }

        // width 100 - dirty, but it'll have to do for now
        return (
            <>
                <Box sx={{ width: '100%' }}>
                    <Button
                        sx={{ float: 'right' }}
                        ref={this.openMenuButton}
                        onClick={this.toggleMenu}
                    >
                        <SettingsIcon />
                    </Button>
                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={this.state.enabled}
                                onChange={() => {
                                    this.checkAndPropagateChange();
                                }}
                            />
                        }
                        label={filter.checkBoxLabel}
                    />
                    {slider && slider}
                    {filter.children && filter.children(this.actions)}
                </Box>
                <AjaxMenu
                    itemFunction={() => {
                        const elements = document.getElementsByClassName('vis');
                        const ids = [];

                        for (const el of elements) {
                            ids.push(el.getAttribute('id'));
                        }

                        return ids;
                    }}
                    open={this.state.menuOpen}
                    anchorEl={this.openMenuButton.current}
                    click={this.setEnabledFor}
                    handleClose={() => {
                        this.setState({ menuOpen: !this.state.menuOpen, anchorEl: null });
                    }}
                    clicked={this.props.filter.enabledFor}
                />
            </>
        );
    }
}

// {this.props.render(this.state, this.getActions())}

export default FilterComponent;
