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
import {api_calculate_path_similarity} from "../api/ajax"
import Grid from "@mui/material/Grid";
import { CircularProgress } from "@mui/material";

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
		extent1: JSON.stringify(this.props.extents[0]),
		extent2: JSON.stringify(this.props.extents[1]),
		similarity: null,
		isLoading: false
            });
        }
    }

    setX = (e) => {
        this.setState({ x_attribute: e.target.value });
    };

    setY = (e) => {
        this.setState({ y_attribute: e.target.value });
    };

    calculatePathSimilarity = () => {
	this.setState({isLoading: true});

	//TODO: set up options for state and atom attributes
	//will it be another modal? hard to tell what's best
	api_calculate_path_similarity(this.state.extent1, this.state.extent2, ['occurrences'], "").then((data) => {
	    this.setState({isLoading: false,
			   similarity: data});
	});
	
    }
    
    closeFunc = () => {
        this.props.closeFunc();
    };

    render() {
	if(this.props.open && this.state.cmn) {	    
            let properties = this.state.cmn;
            var options = properties.map((property) => {
		return <MenuItem key={property} value={property}>{property}</MenuItem>;
            });

	    var extent_options = this.props.extents.map((extent,i) => {
		return <MenuItem key={i} value={JSON.stringify(extent)}>
		       {`${extent.name} ${extent.begin.timestep} - ${extent.end.timestep}`}</MenuItem>
	    });

	    var scatterplots = this.props.extents.map((extent,i) => {
				    return (<Grid key={i} item xs>
						<Scatterplot
						    data={{
							sequence: this.props.trajectories[extent.name].sequence.slice(extent.begin.timestep, extent.end.timestep + 1),
							x_attribute: this.state.x_attribute,
							y_attribute: this.state.y_attribute,
							title: `${extent.name} ${extent.begin.timestep} - ${extent.end.timestep}`
						    }}/>
					    </Grid>);
	    });

	    var similarityText = null;
	    
	    if(!this.state.similarity && !this.state.isLoading) {
		similarityText = (<p>Select which two paths to compare and press "calculate path similarity."</p>);
	    } else if (this.state.isLoading) {
		similarityText = (<CircularProgress color="grey" />)
	    } else {
		let extent1 = JSON.parse(this.state.extent1);
		let extent2 = JSON.parse(this.state.extent2);
		similarityText = (<p>Similarity between {`${extent1.name} ${extent1.begin.timestep} - ${extent1.end.timestep}`}
				  {" "} and {`${extent2.name} ${extent2.begin.timestep} - ${extent2.end.timestep}`} is {this.state.similarity} </p>);
	    }
	    
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
				    {options}
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
				    {options}
				</Select>
				<FormHelperText>Y attribute</FormHelperText>
			    </FormControl>
			    <Stack spacing={2} direction="column" alignItems="center" justifyContent="center" >
				<Stack spacing={2} direction="row" alignItems="center" justifyContent="center">
				    <FormControl>
					<Select value={this.state.extent1}
						onChange={(e) => {
						    this.setState({extent1: e.target.value});
						}}
					>
					    {extent_options}
					</Select>
					<FormHelperText>Path 1</FormHelperText>
				    </FormControl>
				    <FormControl>
					<Select value={this.state.extent2}
						onChange={(e) => {
						    this.setState({extent2: e.target.value});
						}}
					>
					    {extent_options}
					</Select>
					<FormHelperText>Path 2</FormHelperText>
				    </FormControl>
				</Stack>
				{similarityText}
			</Stack>
			    <Grid direction="row" justifyContent="space-evenly" container spacing={2}>
				{scatterplots}			
			    </Grid>
			</Stack> 
			
		    </DialogContent>
		    <DialogActions>
			<Button variant="contained" onClick={this.calculatePathSimilarity}>Calculate path similarity</Button>
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
