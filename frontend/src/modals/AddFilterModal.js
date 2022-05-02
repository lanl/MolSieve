import React from "react";
import DialogTitle from "@mui/material/DialogTitle";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import {TabPanel} from "../api/myutils";
import AjaxSelect from "../components/AjaxSelect";
import Box from "@mui/material/Box";

class AddFilterModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            attribute: null,
            filter_type: null,
            tabIdx: 0
        };
    }

    componentDidMount() {
        const properties = this.props.properties;
        this.setState({
            run: this.props.run,
            attribute: properties[0],
            relation_attribute: properties[0],
            filter_type: "MIN"
        });
    }

    addFilter = () => {        
        this.props.closeFunc();
        this.props.addFilter(this.state);
    };

    closeFunc = () => {
        this.props.closeFunc();
    };

    changeAttribute = (v) => {        
        this.setState({attribute: v});
    }

    render() {
        var options = this.props.properties.map((property) => {
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
                <DialogTitle>{this.props.title}
                    <Tabs value={this.state.tabIdx} onChange={(_, v) => {
                              this.setState({tabIdx: v}, () => {
                                  if(this.state.tabIdx === 0) {
                                      this.setState({filter_type: 'MIN', attribute: this.props.properties[0]})
                                  } else {
                                      this.setState({filter_type: 'RELATION'});
                                  }
                              })

                          }}>
                        <Tab label="Attribute filter"/>
                        <Tab label="Relationship filter"/>
                    </Tabs>
                </DialogTitle>
                <TabPanel value={this.state.tabIdx} index={0}>
                    <DialogContent>
                    <Stack spacing={1}>
                        <FormControl>
                            <Select                            
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
                            <FormHelperText>Filter Type</FormHelperText>
                        </FormControl>

                        <FormControl>
                            <Select                            
                                onChange={(e) => {
                                    this.setState({ attribute: e.target.value });
                                }}
                                value={this.state.attribute}
                            >
                                {options}
                            </Select>
                            <FormHelperText>Attribute</FormHelperText>
                        </FormControl>
                    </Stack>
                    </DialogContent>
                </TabPanel>
                <TabPanel value={this.state.tabIdx} index={1}>
                    <Box sx={{display: 'flex', alignItems:'center',
                              justifyContent: 'center'}}>
                        <FormControl>
                            <AjaxSelect api_call='/get_run_list'
                                        params={{
                                            truncateNEB: false
                                        }} change={this.changeAttribute}/>
                            <FormHelperText>Name of Relationship</FormHelperText>
                        </FormControl>
                        
                        <FormControl>
                            <Select                            
                                onChange={(e) => {
                                    this.setState({ relation_attribute: e.target.value });
                                }}
                                value={this.state.relation_attribute}
                            >
                                {options}
                            </Select>
                            <FormHelperText>Attribute to match</FormHelperText>
                        </FormControl>
                        
                    </Box>
                </TabPanel>
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
                        color="secondary"
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
