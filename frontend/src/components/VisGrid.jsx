import React from "react";
import TrajectoryChart from "../vis/TrajectoryChart";
import Box from "@mui/material/Box";

import SingleStateModal from "../modals/SingleStateModal";
import LoadingModal from "../modals/LoadingModal";
import GraphVis from "../vis/GraphVis";
import ScatterGrid from "./ScatterGrid";
import Scatterplot from "../vis/Scatterplot";

import Button from "@mui/material/Button";
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
            scatterplots: {}
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

    addScatterplot = (name) => {        
        const count = Object.keys(this.state.scatterplots).length;
        const id = `${name}_sc_${count}`;
        const sc = {'name' : name};
        this.setState({scatterplots: { ...this.state.scatterplots, [id]: sc}}, console.log(this.state));        
    }

    deletePlot = (e) => {
        const plot = e.target.getAttribute("data-value");
        const newScatters = {...this.state.scatterplots};
        delete newScatters[plot];
        this.setState({ scatterplots: newScatters}, () => {console.log(this.state);});
    };


    render() {
        const runs = Object.keys(this.props.runs);
        const trajs = Object.keys(this.props.trajectories);
        const safe = (runs.length === trajs.length && runs.length > 0 && trajs.length > 0) ? true : false;

        const scatterplots = Object.keys(this.state.scatterplots).map((sc) => {
            const sc_props = this.state.scatterplots[sc];            
            return (<Scatterplot
                       key={sc}
                       trajectory={this.props.trajectories[sc_props.name]}
                       globalUniqueStates={this.props.globalUniqueStates}       
                       trajectoryName={sc_props.name}
                       id={sc}
                       setStateClicked={this.setStateClicked}
                       setStateHovered={this.setStateHovered}
                       runs={this.props.runs}
                       stateHovered={this.state.stateHovered}
                       title={sc}
                   />);            
        });

        return (
            <>
            <Box sx={{flexGrow: 1, display:'flex', alignItems:'stretch'}}>
                {this.state.isLoading && <LoadingModal
                                             open={this.state.isLoading}
                                             title="Rendering..."/> }

                
                {safe &&                 
                 <GraphVis
                     sx={{flexGrow: 1, minWidth: '50%', maxWidth: '50%', height:'100%'}}
                     trajectories={this.props.trajectories}
                     runs={this.props.runs}
                     globalUniqueStates={this.props.globalUniqueStates}
                     setStateHovered={this.setStateHovered}
                     setStateClicked={this.setStateClicked}
                     loadingCallback={this.chartFinishedLoading}
                     stateHovered={this.state.stateHovered}                     
                 />
                }

                {safe && (<ScatterGrid
                              sx={{flexGrow: 1, minWidth: '50%', maxWidth: '50%'}}
                              control={
                                  <Box display="flex" flexDirection="row" gap={5}>                             
                                      <Button
                                          variant="contained"
                                          onClick={() => {                                     
                                              this.addScatterplot('nano_pt');
                                          }}>
                                          Add a new scatterplot
                                      </Button>
                                  </Box>}
                              deletePlot={this.deletePlot}>
                              {scatterplots}
                          </ScatterGrid>)}
                                         
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
                          />
                      </AccordionDetails>
                  </Accordion>)
            }        
            </>
        );
    }
}

export default VisGrid;
