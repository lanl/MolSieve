import React from "react";
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from "@mui/material/DialogContent";
import Stack from "@mui/material/Stack"
import Select from "@mui/material/Select"
import MenuItem from "@mui/material/MenuItem"
import Button from "@mui/material/Button"
import FormHelperText from '@mui/material/FormHelperText';
import FormControl from '@mui/material/FormControl';
import Scatterplot from "../vis/Scatterplot.js";
import {intersection} from "../api/myutils";
import Grid from "@mui/material/Grid";

class MultiplePathSelectionModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = { cmn: null, x_attribute: null, y_attribute: null };
    }

    componentDidMount() {
	var propList = []
	for(var i = 0; i < this.props.extents.length; i++) {
	    propList.push(this.props.trajectories[this.props.extents[i]['name']].properties);
	}
	
	var cmn = intersection(propList);

        if (this.state.x_attribute == null && this.state.y_attribute == null) {
            this.setState({
		cmn: cmn,
                x_attribute: cmn[0],
                y_attribute: cmn[0],
            });
        }
    }

    setX = (e) => {
        this.setState({ x_attribute: e.target.value });
    };

    setY = (e) => {
        this.setState({ y_attribute: e.target.value });
    };

    closeFunc = () => {
        this.props.closeFunc();
    };

    render() {
	if(this.props.open && this.state.cmn) {	    
            let properties = this.state.cmn;
            var options_x = properties.map((property) => {
		return <MenuItem key={property + "x"} value={property}>{property}</MenuItem>;
            });
	    var options_y = properties.map((property, i) => {
		return <MenuItem key={property + "y"} value={property}>{property}</MenuItem>;
            });

	    var scatterplots = this.props.extents.map(extent => {
				    return (<Grid key={`${extent.name} ${extent.begin.timestep} - ${extent.end.timestep}`} item xs>
						<Scatterplot
						    data={{
							sequence: this.props.trajectories[extent.name].sequence.slice(extent.begin.timestep, extent.end.timestep + 1),
							x_attribute: this.state.x_attribute,
							y_attribute: this.state.y_attribute,
							title: `${extent.name} ${extent.begin.timestep} - ${extent.end.timestep}`
						    }}/>
					    </Grid>);
	    });            
	    
            return (
		<Dialog
		    onClose={this.closeFunc}
                    onBackdropClick={() => this.closeFunc()}
                    open={this.props.open}
		    fullWidth={true}
		    maxWidth="lg"
		>		
                    <DialogTitle>{this.props.title}</DialogTitle>
		    <DialogContent>
			<Stack spacing={2} direction="column">
			    <FormControl>
				<Select
				    name="select_x_attribute"
				    value={this.state.x_attribute}
				    onChange={(e) => {
					this.setX(e);
				    }}
				>
				    {options_x}
				</Select>
				<FormHelperText>X attribute</FormHelperText>
			    </FormControl>
			    <FormControl>				
				<Select
				    name="select_y_attribute"
				    value={this.state.y_attribute}
				    onChange={(e) => {
					this.setY(e);
				    }}
				>
				    {options_y}
				</Select>
				<FormHelperText>Y attribute</FormHelperText>
			    </FormControl>
			    <Grid direction="row" justifyContent="space-evenly" container spacing={2}>
				{scatterplots}			
			    </Grid>
			</Stack> 
			
		    </DialogContent>
		    <DialogActions>
			<Button onClick={this.closeFunc}>Close</Button>
		    </DialogActions>
		</Dialog>
            );
	} else {
	    return null;
	}
    }
}

export default MultiplePathSelectionModal;
