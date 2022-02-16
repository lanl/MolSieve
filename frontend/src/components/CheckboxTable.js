import React from "react";
import "../css/App.css";
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Box  from "@mui/material/Box";

const axios = require("axios").default;

class CheckboxTable extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isLoaded: false,
      items: [],
      click: () => void 0,
      clicked: [],
    };
  }

  click = (e) => {
    if (this.props.click) {
      this.props.click(e);
    }
    // build list of clicked checkboxes
    this.state.clicked.push(e.target.value);
  };

  componentDidMount() {
    axios
      .get(this.props.api_call)
      .then((response) => {
        this.setState({ isLoaded: true, items: response.data });
      })
      .catch((e) => {
        alert(e);
      });

    if (this.props.defaults) {
      this.setState({ ...this.state, clicked: this.props.defaults });
    }
  }

  render() {
    const { isLoaded, items } = this.state;
    if (!isLoaded) {
	return (
	    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
		<CircularProgress color="grey" />
	    </Box>
      );
    } else {
	return (
	    <TableContainer component={Paper}>
		<Table size="small">
		    <TableHead>
			<TableRow>
			    <TableCell>{this.props.header}</TableCell>
			    <TableCell>Load?</TableCell>
			</TableRow>
		    </TableHead>
		    <TableBody>
			{items.map((i) => (
			    <TableRow key={i}>
				<TableCell>{i}</TableCell>
				<TableCell>
				    <input
					onClick={this.click}
					type="checkbox"
					value={i}
					readOnly={this.props.defaults.includes(i)}
					disabled={this.props.defaults.includes(i)}
					defaultChecked={this.props.defaults.includes(i)}
				    ></input>
				</TableCell>
			    </TableRow>
            ))}
		    </TableBody>
		</Table>
	    </TableContainer>
      );
    }
  }
}

export default CheckboxTable;
