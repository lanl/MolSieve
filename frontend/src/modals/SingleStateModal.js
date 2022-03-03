import React from "react";
import DialogTitle from "@mui/material/DialogTitle";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import Button from "@mui/material/Button";
import {api_generate_ovito_image} from "../api/ajax";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";

class SingleStateModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = { trajectoryState : this.props.state, imgSrc: "" };
        this.imgRef = React.createRef();
    }

    componentDidMount = () => {
        api_generate_ovito_image(this.state.trajectoryState.number)
            .then((response) => {                
                const imageData = 'data:image/png;base64,' + response.image;                
                this.imgRef.current.setAttribute("src", imageData);
                console.log(this.state);
            })
            .catch((e) => { alert(e);})        
    }
    
    closeFunc = () => {
        this.props.closeFunc();
    };

    render() {

        var tableRows = Object.keys(this.state.trajectoryState).map((attr) => {
            return(
            <TableRow key={attr}>
                <TableCell>{attr}</TableCell>
                <TableCell>{this.state.trajectoryState[attr]}</TableCell>
            </TableRow>);
        });        
        
        return (<Dialog
                    onClose={this.closeFunc}
                    open={this.props.open}
                    fullWidth={true}
                    width="lg"
                    onBackdropClick={() => this.closeFunc()}                    
                >
                <DialogTitle>State {this.state.trajectoryState.number}</DialogTitle>
                    <DialogContent>
                        <img ref={this.imgRef} />
                        <br/>
                        <TableContainer component={Paper}>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell>Attribute name</TableCell>
                                        <TableCell>Attribute value</TableCell>
                                    </TableRow>                                
                                </TableHead>
                            <TableBody>
                                {tableRows}
                            </TableBody>
                            </Table>
                        </TableContainer>
                    </DialogContent>
                    <DialogActions>
                        <Button size="small" onClick={this.closeFunc}>Close</Button>
                    </DialogActions>
                </Dialog>);
    }
}

export default SingleStateModal;
