import React from "react";
import { Slider, Rail, Handles } from "react-compound-slider";
import { SliderRail, Handle } from "./slider-components";
import CheckboxTable from "./CheckboxTable";
import Modal from "react-modal";

const domain = [2, 20];
const defaultValues = [2, 4];

const modalStyle = {
    content: {
        textAlign: "center",
        margin: "auto",
        width: "40%",
        height: "75%",
    },
};

const sliderStyle = {
    position: "relative",
    width: "75%",
    margin: "auto",
};

class LoadRunModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            values: defaultValues.slice(),
            clicked: ["occurrences", "number"],
            name: null,
        };
    }

    pullClicked = (event) => {
        this.state.clicked.push(event.target.value);
    };

    closeFunc = (uncheck) => {
	if(uncheck) {
	    this.props.lastEvent.target.checked = false;	
	}	
	this.props.closeFunc();
    };

    runFunc = () => {
        this.props.closeFunc(false);
        this.state.name = this.props.lastEvent.target.value;        
        this.props.runFunc(this.state);
    };

    onChange = (values) => {
        this.setState({ values });
    };

    render() {
        if (this.props.lastEvent) {
            const {
                state: { values },
            } = this;

            let name = this.props.lastEvent.target.value;
            let defaults = ["occurrences", "number"];

            return (
                <Modal style={modalStyle} isOpen={this.props.isOpen} onRequestClose={this.closeFunc}>
                    <h1>Clustering options for {name}</h1>
                    <p>
                        Select the cluster sizes that PCCA will try to cluster
                        the data into.
                    </p>
                    <b>
                        {this.state.values.toString().replace(",", " - ")}{" "}
                        clusters
                    </b>
                    <br />
                    <br />
                    <Slider
                        rootStyle={sliderStyle}
                        mode={1}
                        step={1}
                        domain={domain}
                        onChange={this.onChange}
                        values={values}
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
                    <br />
                    <p>Select which properties you wish to analyze.</p>
                    <CheckboxTable
                        click={this.pullClicked}
                        defaults={defaults}
                        header="Properties"
                        api_call={`/get_property_list?run=${name}`}
                    ></CheckboxTable>
                    <button onClick={this.runFunc}>Calculate</button>
                    <button onClick={this.closeFunc}>Cancel</button>
                </Modal>
            );
        } else {
            return null;
        }
    }
}

export default LoadRunModal;
