import React from "react";
import DialogTitle from "@mui/material/DialogTitle";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import Button from "@mui/material/Button";
import {api_generate_ovito_image} from "../api/ajax";


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
            })
            .catch((e) => { alert(e);})        
    }
    
    closeFunc = () => {
        this.props.closeFunc();
    };

    render() {
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
                    </DialogContent>
                    <DialogActions>
                        <Button size="small" onClick={this.closeFunc}>Close</Button>
                    </DialogActions>
                </Dialog>);
    }
}

export default SingleStateModal;
