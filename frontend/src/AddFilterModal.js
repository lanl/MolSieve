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
	const properties = this.props.trajectory.properties;
	this.setState({run: this.props.run,
		       attribute: properties[0],
		       filter_type: "MIN",
		       properties: [...this.props.trajectory.properties]});        
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
		    <div style={{alignText: 'left', justifyContent: 'left'}}>
			<label htmlFor="select_new_filter">Attribute: </label>
			<select name="select_new_filter" defaultValue={this.props.trajectory.properties[0]}>{options}</select>
			<br/>
			<br/>			
			<label htmlFor="select_new_filter_type">Filter type: </label>
			<select name="select_new_filter_type" onChange={(e) => {this.setState({filter_type: e.target.value})}} defaultValue={this.state.filter_type}>
			    <option key="MIN" value="MIN">Show states with at least this quantity (min)</option>
			    <option key="MAX" value="MAX">Show states with at most this quantity (max)</option>
			    <option key="RANGE" value="RANGE">Show states with quantities between a range</option>
			</select>
		    </div>
		    <br/>
		    <div>
			<button onClick={this.addFilter} style={{margin: '5px'}}>Create filter</button>		    
			<button onClick={this.closeFunc} style={{margin: '5px'}}>Cancel</button>
		    </div>
		</Modal>);
    }
}

export default AddFilterModal;
