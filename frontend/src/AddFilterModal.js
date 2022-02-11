import React from "react";
import Modal from "react-modal";
import './Modal.css'

class AddFilterModal extends React.Component {

    constructor(props) {
	super(props);
	this.state = {
	    attribute: null,
	    filter_type: null,
	    properties: null
	};
    }

    componentDidMount() {
	console.log("add filter modal mounted");        
    }

    addFilter = () => {
	this.props.closeFunc();
	this.props.addFilter(this.state);
    }
    
    closeFunc = () => {        
	this.props.closeFunc();
    }
    
    render() {

	var options = this.props.trajectory.properties.map((property) => {
	    return (<option key={property} value={property}>{property}</option>);
	});
	
	return (<Modal className="DefaultModal SmallModal" onRequestClose={this.closeFunc} isOpen={this.props.isOpen}>
		    <h1>{this.props.title}</h1>
		    <label for="select_new_filter">Attribute </label>
		    <select name="select_new_filter" defaultValue={this.props.trajectory.properties[0]}>{options}</select>
		    <label for="select_new_filter_type">Filter type: </label>
		    <select name="select_new_filter_type">
			<option key="MIN" value="MIN">Show states with at least this quantity (min)</option>
			<option key="MAX" value="MAX">Show states with at most this quantity (max)</option>
			<option key="RANGE" value="RANGE">Show states with quantities between a range</option>
		    </select>
		    <button onClick={this.addFilter}>Create filter</button>
		    <button onClick={this.closeFunc}>Cancel</button>
		</Modal>);
    }
}

export default AddFilterModal;
