import React from "react";
import CircularProgress from "@mui/material/CircularProgress";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import axios from 'axios';

class AjaxSelect extends React.Component {
    constructor(props) {
        super(props);

        let value = null;

        if(this.props.defaultValue !== undefined) {
            value = this.props.defaultValue;
        }

        this.state = {
            isLoaded: false,
            value: value,
            data: [],
        }
    }

    componentDidMount() {
        if(!this.state.isLoaded) {

            let params = null;

            if(this.props.params !== undefined) {
                params = this.props.params;
            }
            
            axios.get(this.props.api_call, {params: params}).then((response)=> {                
                this.setState({data: response.data.map((r) => {
                    return r;
                }), isLoaded: true}, () => {
                    if(this.state.value === null) {
                        this.setValue(response.data[0]);
                    }
                });
            }).catch((e) => { alert(e);})
        }
    }

    setValue = (v) => {
        this.setState({value: v}, this.props.change(v));
    }

    render() {

        if(!this.state.isLoaded) {
            return (<CircularProgress color="grey" />);
        } else {
            var options = this.state.data.map((d)=> {
                return (<MenuItem key={d} value={d}>{d}</MenuItem>)
            });
            
            return (<Select value={this.state.value}
                            onChange={(e)=>{
                                this.setValue(e.target.value);
                            }}>{this.props.children}{options}</Select>);
        }
    }

}

export default AjaxSelect;
