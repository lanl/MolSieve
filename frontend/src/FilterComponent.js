import React from "react";
import { Slider, Rail, Handles } from "react-compound-slider";
import { SliderRail, Handle } from "./slider-components";

const sliderStyle = {
    position: "relative",
    width: "75%",
    margin: "auto",
};

class FilterComponent extends React.Component {
    constructor(props) {
        super(props);	
	const filter = this.props.filter;
        
	let value = null;
	if(filter.isRange) {
	    value = filter.extents;
	} else {
	    value = filter.extents[0];
	}	
        this.state = {
	    value: value,
            enabled: false,
	    run: this.props.run,
	    id: this.props.filter.id
        };
        
    }

    propagateChange = (e) => {
	this.setState({enabled: e.target.checked}, () => {
	    this.props.propagateChange(this.state);
	});        
    }
    
    render() {        
        const filter = this.props.filter;        
	const domain = filter.extents;        

	const {
            state: { value },
        } = this;	

                
        if (filter.isRange) {
            return (
                <div>
                    <div>
                        <input type="checkbox" name={filter.attribute} onChange={(e) => {                                   
				   this.propagateChange(e);
			       }} />
			<label name={filter.attribute}>Enable filter on {filter.attribute}</label>
                    </div>
		    <br/>
                    <div>
                        <Slider
                            rootStyle={sliderStyle}
                            mode={1}
                            step={1}
                            domain={domain}
                            onChange={(e) => { this.setState({value: e})}}
                            values={value}
			    name="slider"
                    >
                            <Rail>
				{({ getRailProps }) => (
                                    <SliderRail getRailProps={getRailProps} />
				)}
                            </Rail>
                            <Handles>
				{({ handles, activeHandleID, getHandleProps }) => (
                                    <div className="slider-handles">
					{handles.map((handle) => (
                                            <Handle
						key={handle.id}
						handle={handle}
						domain={domain}
						isActive={
                                                    handle.id === activeHandleID
						}
						getHandleProps={getHandleProps}
                                            />
					))}
                                    </div>
				)}
                            </Handles>
			</Slider>
			<br/>
                        <label htmlFor="slider">{`Between ${this.state.value.toString().replace(',', ' and ')} occurences` }</label>
                    </div>
                </div>
            );
        } else {
            return (
                <div>
		    <div>
			<input type="checkbox" name={filter.attribute} onChange={(e) => {
				   this.propagateChange(e);
			       }} />
			<label name={filter.attribute}>Enable filter on {filter.attribute}</label>
		    </div>
                    {filter.extents && (
                        <div>
                            <input
                                type="range"
                                min={filter.extents[0]}
                                max={filter.extents[1]}
                                defaultValue={this.state.value}
				onChange={(e) => {
				    this.setState({value: e.target.value});
				}}
				onMouseUp={(e) => {
				    this.setState({value: e.target.value});
				    if(this.state.enabled) {
					this.propagateChange(e);
				    }
				}}
                            />
			    <br/>
                            <label>{filter.label} {this.state.value} {filter.attribute}</label>
                        </div>
                    )}
                </div>				
            );
        }
    }
}

export default FilterComponent;
