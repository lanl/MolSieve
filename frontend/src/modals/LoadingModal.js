import React from "react"
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from "@mui/material/DialogContent";
import CircularProgress from '@mui/material/CircularProgress';
import Box  from "@mui/material/Box";

class LoadingModal extends React.Component {
    render() {
	return (<Dialog open={this.props.open}>
			<DialogTitle>{this.props.title}</DialogTitle>
		    <DialogContent>
			 <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
			     <CircularProgress color="grey"/>
			     </Box>
			</DialogContent>
		 </Dialog>);
    }
}

export default LoadingModal;
