import React from "react";
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from "@mui/material/DialogContent";
import Button from '@mui/material/Button';

class SelectionModal extends React.Component {

    closeFunc = () => {
	this.props.closeFunc();
    }
    
    render() {        
        if (this.props.isOpen) {
            return <Dialog open={this.props.open}
		    onBackdropClick={() => this.closeFunc()}
		   >
		       <DialogTitle>{this.props.title}</DialogTitle>
		       <DialogContent>
		       <label htmlFor="txt_path_neb">Number of images interpolated between points on NEB</label>
			   <input type="number" min="0" name="txt_path_neb" defaultValue="0"/>
		       </DialogContent>
		       <DialogActions>
			   <Button size="small" variant="contained">Calculate NEB on Path</Button>
			   <Button size="small" variant="contained" color="error" onClick={this.closeFunc}>Cancel</Button>
		       </DialogActions>
		   </Dialog>;
        } else {
	    return null;
        }
    }
}

export default SelectionModal;
