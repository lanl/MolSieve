import React from 'react';
const axios = require('axios').default;

class CheckboxTable extends React.Component {
    constructor(props) {
	super(props);
	this.state = {
	    error: null,
	    isLoaded: false,
	    items: []
	};
    }

    click = (e) => {
        console.log(e.target);
	this.props.click(e);
    }

    componentDidMount() {        
	axios.get(this.props.api_call).then(response => {            
	    this.setState({isLoaded: true,
			   items: response.data});            
	}).catch(e => {            
	    alert(e);
	});
    }
    
    render() {
	const { error, isLoaded, items } = this.state;
	if (error) {
	    return <div>Error: { error.message }</div>;
	} else if (!isLoaded) {
	    return <div>Loading...</div>
	} else {           
	    return(<table><thead><tr><th>{this.props.header}</th><th>Load?</th></tr></thead>
			      <tbody>
				  {items.map((i) => <tr key={i}><td>{i}</td><td><input onClick={this.click} type="checkbox" value={i}></input></td></tr>)}
			      </tbody>
		   </table>);	    
	}	
    }
}

export default CheckboxTable;
