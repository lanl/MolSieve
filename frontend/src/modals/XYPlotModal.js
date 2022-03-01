import React from "react";
import DialogTitle from "@mui/material/DialogTitle";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import Stack from "@mui/material/Stack";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
import FormHelperText from "@mui/material/FormHelperText";
import FormControl from "@mui/material/FormControl";
import Scatterplot from "../vis/Scatterplot.js";

class XYPlotModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = { x_attribute: null, y_attribute: null };
    }

    componentDidMount() {
        const properties = this.props.trajectory.properties;
        if (this.state.x_attribute == null && this.state.y_attribute == null) {
            this.setState({
                x_attribute: properties[0],
                y_attribute: properties[0],
            });
        }
    }

    setX = (e) => {
        this.setState({ x_attribute: e.target.value });
    };

    setY = (e) => {
        this.setState({ y_attribute: e.target.value });
    };

    closeFunc = () => {
        this.props.closeFunc();
    };

    render() {
        let properties = this.props.trajectory.properties;

        var options = properties.map((property) => {
            return (
                <MenuItem key={property} value={property}>
                    {property}
                </MenuItem>
            );
        });
        return (
            <Dialog
                onClose={this.closeFunc}
                onBackdropClick={() => this.closeFunc()}
                open={this.props.open}
                fullWidth={true}
            >
                <DialogTitle>{this.props.title}</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} alignItems="center" justifyContent="center">
                        <p>Select which attributes to render in the X-Y plot.</p>
                        <Stack spacing={2} direction="row" alignItems="center" justifyContent="center">
                        <FormControl>
                            <Select
                                name="select_x_attribute"
                                id="select_x_attribute"
                                value={this.state.x_attribute}
                                onChange={(e) => {
                                    this.setX(e);
                                }}
                            >
                                {options}
                            </Select>
                            <FormHelperText>X attribute</FormHelperText>
                        </FormControl>
                        <FormControl>
                            <Select
                                name="select_y_attribute"
                                id="select_y_attribute"
                                value={this.state.y_attribute}
                                onChange={(e) => {
                                    this.setY(e);
                                }}
                            >
                                {options}
                            </Select>
                            <FormHelperText>Y attribute</FormHelperText>
                        </FormControl>
                        </Stack>
                        <Scatterplot
                            data={{
                                sequence: this.props.trajectory.sequence,
                                x_attribute: this.state.x_attribute,
                                y_attribute: this.state.y_attribute,
                            }}                            
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={this.closeFunc}>Close</Button>
                </DialogActions>
            </Dialog>
        );
    }
}

export default XYPlotModal;
