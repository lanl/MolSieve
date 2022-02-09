import React from "react";
import Modal from "react-modal";

class SelectionModal extends React.Component {

    closeFunc = () => {
	this.props.closeFunc();
    }
    
    render() {        
        if (this.props.isOpen) {
            return <Modal isOpen={this.props.isOpen} onRequestClose={this.closeFunc}>
		       <h1>{this.props.title}</h1>
		       <label htmlFor="txt_path_neb">Number of images interpolated between points on NEB</label>
		       <input type="number" min="0" name="txt_path_neb" defaultValue="0"/>
		       <button>Calculate NEB on Path</button>
		       <button onClick={this.closeFunc}>Cancel</button>
		   </Modal>;
        } else {
	    return null;
        }
    }
}

export default SelectionModal;
