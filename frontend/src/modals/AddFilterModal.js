import React from "react";
import DialogTitle from "@mui/material/DialogTitle";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";

class AddFilterModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            attribute: null,
            filter_type: null,
            properties: null,
        };
    }

    componentDidMount() {
        const properties = this.props.trajectory.properties;
        this.setState({
            run: this.props.run,
            attribute: properties[0],
            filter_type: "MIN",
            properties: [...this.props.trajectory.properties],
        });
    }

    addFilter = () => {
        this.props.closeFunc();
        this.props.addFilter(this.state);
    };

    closeFunc = () => {
        this.props.closeFunc();
    };

    render() {
        var options = this.props.trajectory.properties.map((property) => {
            return (
                <MenuItem key={property} value={property}>
                    {property}
                </MenuItem>
            );
        });

        return (
            <Dialog
                onClose={this.closeFunc}
                open={this.props.open}
                onBackdropClick={() => this.closeFunc(true)}
            >
                <DialogTitle>{this.props.title}</DialogTitle>
                <DialogContent>
                    <Stack spacing={1}>
                        <label htmlFor="select_new_filter">Attribute: </label>
                        <Select
                            name="select_new_filter"
                            onChange={(e) => {
                                this.setState({ attribute: e.target.value });
                            }}
                            value={this.state.attribute}
                        >
                            {options}
                        </Select>
                        <label htmlFor="select_new_filter_type">
                            Filter type:{" "}
                        </label>
                        <Select
                            name="select_new_filter_type"
                            onChange={(e) => {
                                this.setState({ filter_type: e.target.value });
                            }}
                            value={this.state.filter_type}
                        >
                            <MenuItem key="MIN" value="MIN">
                                Show states with at least this quantity (min)
                            </MenuItem>
                            <MenuItem key="MAX" value="MAX">
                                Show states with at most this quantity (max)
                            </MenuItem>
                            <MenuItem key="RANGE" value="RANGE">
                                Show states with quantities between a range
                            </MenuItem>
                        </Select>
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button
                        size="small"
                        variant="contained"
                        onClick={this.addFilter}
                        style={{ margin: "5px" }}
                    >
                        Create filter
                    </Button>
                    <Button
                        size="small"
                        variant="contained"
                        color="error"
                        onClick={this.closeFunc}
                        style={{ margin: "5px" }}
                    >
                        Cancel
                    </Button>
                </DialogActions>
            </Dialog>
        );
    }
}

export default AddFilterModal;
