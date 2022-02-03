import React from 'react';
import {Slider, Rail, Handles} from 'react-compound-slider';
import {SliderRail, Handle} from './slider-components'
import CheckboxTable from './CheckboxTable';
import Modal from 'react-modal';

const domain = [2,20];
const defaultValues = [2,4];

const sliderStyle = {    
    position: "relative",
    width: "75%",
};


class LoadRunModal extends React.Component {

    constructor(props) {
	super(props);        
	this.state = {
	    values: defaultValues.slice(),
	    clicked: ['occurrences', 'number']            
	};
    }

    pullClicked = (event) => {
        this.state.clicked.push(event.target.value);
        console.log(this.state);
    }
    
    onChange = (values) => {
	this.setState({ values });        
    }
    
    render() {
        if(this.props.lastEvent) {
	    const {
		state: { values },
	    } = this;
	    
	    let name = this.props.lastEvent.target.value;
	    let defaults = ['occurrences', 'number'];	    
	    return (<Modal isOpen={this.props.isOpen}>
			<br/>
			<br/>
			<Slider rootStyle={sliderStyle} mode={1} step={1} domain={domain} onChange={this.onChange} values={values}>
			    <Rail>
				{({ getRailProps }) => <SliderRail getRailProps={getRailProps} />}
			    </Rail>
			    <Handles>
				{({ handles, activeHandleID, getHandleProps }) => (
				    <div className="slider-handles">
					{handles.map(handle => (
					    <Handle
						key={handle.id}
						handle={handle}
						domain={domain}
						isActive={handle.id === activeHandleID}
						getHandleProps={getHandleProps}
					    />
					))}
				    </div>
				)}
			    </Handles>
			</Slider>
			<br/>
			<CheckboxTable click={this.pullClicked} defaults={defaults} header="Properties" api_call={`/get_property_list?run=${name}`}></CheckboxTable>
		    <button onClick={this.props.closeFunc}>Calculate</button> <button onClick={this.props.closeFunc}>Cancel</button></Modal>);
	} else {
	    return null;
	}
    }
}

export default LoadRunModal;
