import React from 'react';
import './App.css';
import CheckboxTable from './CheckboxTable'

class App extends React.Component {

    showInitModal = () => {
	alert("function passed successfully; called by ");
    }

    render() {
	return (<div className="App">
	    <CheckboxTable header="Runs" api_call="/get_run_list" click={this.showInitModal} ></CheckboxTable>                
		</div>
	);
    }
}


export default App;
