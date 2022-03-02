import React from "react";
import "../css/App.css";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CircularProgress from "@mui/material/CircularProgress";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import axios from "axios";

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
        // build list of clicked checkboxes
        if (e.target.checked) {
            this.setState({clicked: [...this.state.clicked, e.target.value]}, () => {
                if (this.props.click) {
                    this.props.click(e, this.state.clicked);
                }
            });            
        } else {
            let newClicked = [...this.state.clicked];
            newClicked.splice(newClicked.indexOf(e.target.value), 1);
            this.setState({clicked: newClicked}, () => {
                if (this.props.click) {
                    this.props.click(e, this.state.clicked);
                }
            });            
        }        
    };

    componentDidMount() {
        console.log(this.props.api_call);
        if(this.props.api_call !== undefined && this.props.api_call !== '') {
            axios
                .get(this.props.api_call)
                .then((response) => {
                    this.setState({ isLoaded: true, items: response.data });
                })
                .catch((e) => {
                    alert(e);
                });
        } else {
            this.setState({isLoaded: true, items: this.props.items});
        }

        if (this.props.defaults !== undefined) {
            this.setState({ ...this.state, clicked: this.props.defaults });
        }
    }

    render() {
        const { isLoaded, items } = this.state;
        if (!isLoaded) {
            return (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                    }}>
                    <CircularProgress color="grey" />
                </Box>
            );
        } else {
            let defaults = this.props.defaults;
            if(this.props.defaults === undefined) {
                defaults = [];
            }
            
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
                                            readOnly={defaults.includes(
                                                i
                                            )}
                                            disabled={defaults.includes(
                                                i
                                            )}
                                            defaultChecked={defaults.includes(
                                                i
                                            )}></input>
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
