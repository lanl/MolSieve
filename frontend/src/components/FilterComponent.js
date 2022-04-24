import React from "react";

import Box from '@mui/material/Box';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import Slider from '@mui/material/Slider';
import Button from '@mui/material/Button';
import SettingsIcon from '@mui/icons-material/Settings';
import AjaxMenu from './AjaxMenu';

const RANGE_SLIDER = "range";
const SLIDER = "slider";
const TOGGLE = "toggle";

class FilterComponent extends React.Component {
    constructor(props) {
        super(props);
        const filter = this.props.filter;
        this.openMenuButton = React.createRef();
        this.state = {
            options: filter.options,
            enabled: false,
            run: this.props.run,
            id: filter.id,
            extents: filter.extents,
            menuOpen: false,
            enabledFor: filter.enabledFor
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

    toggleMenu = () => {
        this.setState({menuOpen: !this.state.menuOpen});
    }

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

    setEnabledFor = (e,v) => {
        if (e.target.checked) {
            this.setState({enabledFor: [...this.state.enabledFor, v]}, () => {this.propagateChange()});
        } else {
            const idx = this.state.enabledFor.indexOf(v);                                   
            this.setState({enabledFor: this.state.enabledFor.filter((_,i) => i !== idx)}, () => {this.propagateChange()});
        }

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
        
        // width 100 - dirty, but it'll have to do for now
        return (
            <>
                <Box sx={{width:'100%'}}>
                    <Button sx={{float: 'right'}} ref={this.openMenuButton} onClick={this.toggleMenu}><SettingsIcon/></Button>
                    <FormControlLabel control={<Checkbox checked={this.state.enabled} onChange={() => { this.checkAndPropagateChange(); }}/>} label={filter.checkBoxLabel}/>
                    {slider && slider}
                    {filter.children && filter.children(this.actions)}
                </Box>
                <AjaxMenu itemFunction={() => {
                              const elements = document.getElementsByClassName("vis")
                              let ids = [];

                              for(const el of elements) {
                                  ids.push(el.getAttribute('id'));
                              }
                              
                              return ids;
                          }}
                          open={this.state.menuOpen}
                          anchorEl={this.openMenuButton.current}
                          click={this.setEnabledFor}
                          handleClose={() => { this.setState({ menuOpen: !this.state.menuOpen, anchorEl: null }) }}
                          clicked={this.props.filter.enabledFor}
                />
            </>
        );
    }
}

//{this.props.render(this.state, this.getActions())}

export default FilterComponent;
