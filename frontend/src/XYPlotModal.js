import React from "react";
import Modal from "react-modal";
import Scatterplot from "./Scatterplot.js"

class XYPlotModal extends React.Component {

    constructor(props) {
	super(props);
	this.state = {x_attribute: null,
		      y_attribute: null};
    }

    componentDidUpdate() {
	// will only happen the first time
	if(this.props.trajectory) {
	    const properties = this.props.trajectory.properties;
	    if(this.state.x_attribute == null && this.state.y_attribute == null) {
		this.setState({x_attribute: properties[0],
			       y_attribute: properties[0]})
	    }
	}
    }

    setX = (e) => {        
	this.setState({x_attribute: e.target.value});        
    }

    setY = (e) => {        
	this.setState({y_attribute: e.target.value});        
    }
    
    closeFunc = () => {
	this.setState({x_attribute:null,
		       y_attribute:null});
	this.props.closeFunc();
    }
    
    render() {        
	if (this.props.isOpen) {	   	    
	    let properties = this.props.trajectory.properties;            
	    
	    var options = properties.map((property) => {
		return (<option value={property}>{property}</option>);
	    });            
            return (<Modal style={this.props.style} onRequestClose={this.closeFunc} isOpen={this.props.isOpen}>
		       <h1>{this.props.title}</h1>
		       <label htmlFor="select_x_attribute">X attribute: </label>
			<select name="select_x_attribute" id="select_x_attribute" defaultValue={this.state.x_attribute} onChange={(e) => { this.setX(e) }}>{options}</select><p></p>
		       <label htmlFor="select_y_attribute">Y attribute: </label>
			<select name="select_y_attribute" id="select_y_attribute" defaultValue={this.state.y_attribute} onChange={(e) => { this.setY(e) }}>{options}</select>
		    <br/>
			
                       <Scatterplot data={{sequence: this.props.trajectory.sequence,
					   x_attribute: this.state.x_attribute, 
					   y_attribute: this.state.y_attribute}}></Scatterplot>
			<br/>
		       <button onClick={this.closeFunc}>Close</button>
		    </Modal>);
           } else {
	    return null;
        }
    }
}


export default XYPlotModal;
