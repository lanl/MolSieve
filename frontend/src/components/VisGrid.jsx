import React from "react";
import TrajectoryChart from "../vis/TrajectoryChart";
import Box from "@mui/material/Box";

import SingleStateModal from "../modals/SingleStateModal";
import LoadingModal from "../modals/LoadingModal";
import GraphVis from "../vis/GraphVis";
import ScatterGraph from './ScatterGraph';

import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

const SINGLE_STATE_MODAL = 'single_state';

class VisGrid extends React.Component {
    constructor(props) {
        super(props);       

        this.state = {
            currentModal: null,
            currentRun: null,            
            drawerOpen: false,
            isLoading: false,
            stateHovered: null,
            stateClicked: null,
        };
    }

    toggleModal = (key) => {
        if (this.state.currentModal) {
            this.setState({
                currentModal: null,
            });
            return;
        }
        this.setState({ currentModal: key });
    };

    chartFinishedLoading = () => {        
        this.setState({ isLoading: false });
    }

    setStateHovered = (stateInfo) => {        
        this.setState({stateHovered: stateInfo});            
    }

    componentDidMount() {
        document.addEventListener("keydown", this.changeTimestep);        
    }
    
    changeTimestep = (e) => {        
        if(this.state.stateHovered !== null) {
            // timestep = index into simplifiedSequence array            
            let timestep = null;
            
            if(this.state.stateHovered.timesteps) {
                console.log(this.state.stateHovered.timesteps);                
            } else {
                timestep = this.state.stateHovered.timestep;
            }
            
            if(timestep) {                 
                if(e.key == 'ArrowLeft' || e.key == 'ArrowRight') {
                    timestep = (e.key == 'ArrowLeft') ? timestep - 1 : timestep + 1;
                    const name = this.state.stateHovered.name;
                    const stateID = this.props.trajectories[name].simplifiedSequence.sequence[timestep].id;
                    this.setStateHovered({'caller': e, 'stateID': stateID, 'name': name, 'timestep': timestep});                                
                }
            }
        }
    }                      


    setStateClicked = (state) => {        
        this.setState({stateClicked: state}, () => {
            this.toggleModal(SINGLE_STATE_MODAL)});
    }
        
    render() {
        const runs = Object.keys(this.props.runs);
        const trajs = Object.keys(this.props.trajectories);
        const safe = (runs.length === trajs.length && runs.length > 0 && trajs.length > 0) ? true : false;

        return (
            <Box sx={{flexGrow: 1}}>
                {this.state.isLoading && <LoadingModal
                                             open={this.state.isLoading}
                                             title="Rendering..."/> }

                {safe &&
                 (<Accordion defaultExpanded={true} disableGutters={true} sx={{position: 'fixed', bottom: 0,  maxWidth: '25%', zIndex: 1299}}>
                      <AccordionSummary
                          expandIcon={<ExpandMoreIcon />}
                      ><Typography variant="h6">Sequence View</Typography></AccordionSummary>
                      <Divider/>
                      <AccordionDetails>
                          <TrajectoryChart
                              trajectories={this.props.trajectories}
                              globalUniqueStates={this.props.globalUniqueStates}
                              runs={this.props.runs}
                              loadingCallback={this.chartFinishedLoading}
                              setStateHovered={this.setStateHovered}
                              setStateClicked={this.setStateClicked}
                              stateHovered={this.state.stateHovered}
                              lastEventCaller={this.state.lastEventCaller}
                          />
                      </AccordionDetails>
                  </Accordion>)
                }        
                
                {safe &&
                 <GraphVis
                     display={this.props.graphMode}
                     trajectories={this.props.trajectories}
                     runs={this.props.runs}
                     globalUniqueStates={this.props.globalUniqueStates}
                     setStateHovered={this.setStateHovered}
                     setStateClicked={this.setStateClicked}
                     loadingCallback={this.chartFinishedLoading}
                     stateHovered={this.state.stateHovered}
                     lastEventCaller={this.state.lastEventCaller}
                 />
                }

                {safe &&                 
                 <ScatterGraph display={!this.props.graphMode} trajectories={this.props.trajectories}
                               globalUniqueStates={this.props.globalUniqueStates}
                 />
                }
                                         
            {this.state.currentModal === SINGLE_STATE_MODAL && (
                    <SingleStateModal
                        open={this.state.currentModal === SINGLE_STATE_MODAL}
                        state={this.props.globalUniqueStates.get(this.state.stateClicked.id)}
                        closeFunc={() => {
                            this.toggleModal(SINGLE_STATE_MODAL);                                                        
                        }}
                    />
            )}
        </Box>
        );
    }
}

export default VisGrid;
