import React from 'react';
import './App.css';
import CheckboxTable from './CheckboxTable';
import LoadRunModal from './LoadRunModal'

const RUN_MODAL = 'run_modal';

class App extends React.Component {
    constructor () {
	super();
	this.state = {
	    currentModal: null,
	    lastEvent: null
	};
    }

    toggleModal = key => event => {        
	if (this.state.currentModal) {

	    // unchecks the checkbox that toggled the modal, if applicable
	    
	    let lastTarget = this.state.lastEvent.target; 
	    if(lastTarget.type === 'checkbox') {
		lastTarget.checked = !lastTarget.checked;
	    }
	    	    
            this.setState({...this.state,
			   currentModal: null,
			   lastEvent: null});
	    return;
	}

	this.setState({...this.state, currentModal: key, lastEvent: event});
    }

    render() {
	return (<div className="App">
		    <h1>Trajectory Visualization</h1>
		    <h2>powered by React.js</h2>
		    <p>Press CTRL to toggle path selection brush. Press Z to toggle zoom brush. Double click to reset zoom. Press SHIFT to toggle multiple path selection. When you are finished with your selection, press S to open the comparison dialog.</p>
		    <CheckboxTable defaults={['']} header="Runs" api_call="/get_run_list" click={this.toggleModal(RUN_MODAL)}></CheckboxTable>
		    <LoadRunModal isOpen={this.state.currentModal === RUN_MODAL} lastEvent={this.state.lastEvent} closeFunc={this.toggleModal(RUN_MODAL)}/>
	</div>
	);
    }
}


export default App;
