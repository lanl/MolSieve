import React from "react";
import TrajectoryChart from "../vis/TrajectoryChart";
import Box from "@mui/material/Box";

import SingleStateModal from "../modals/SingleStateModal";
import LoadingModal from "../modals/LoadingModal";
import GraphVis from "../vis/GraphVis";
import ScatterGrid from "./ScatterGrid";
import Scatterplot from "../vis/Scatterplot";

import ButtonWithOpenMenu from "../components/ButtonWithOpenMenu";
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SelectionVis from '../vis/SelectionVis';
import AddCircleIcon from '@mui/icons-material/AddCircle';

import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';

const SINGLE_STATE_MODAL = 'single_state';

class VisArea extends React.Component {
    constructor(props) {
        super(props);       

        this.state = {
            currentModal: null,
            currentRun: null,            
            drawerOpen: false,
            isLoading: false,
            stateHovered: null,
            stateClicked: null,
            scatterplots: {},
            subSequences: []
        };
    }
    
    setExtents = (extent) => {
        const modEx = [];
        for(const ex of extent) {
            const ids = this.props.trajectories[ex.name].sequence.slice(ex.begin, ex.end + 1);
            const uniqueStates = [...new Set(ids)].map((state) => {
                return {'id': state};
            });
            
            const newEx = {...ex, states: uniqueStates};
            modEx.push(newEx);
        }
        this.setState({subSequences: [...this.state.subSequences, modEx]});
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
        this.setState({scatterplots: { ...this.state.scatterplots, [id]: sc}});        
    }

    addSubsequenceScatterplot = (extent) => {
        let newPlots = {...this.state.scatterplots};
        for (const xtent of extent) {            
            const title = `${xtent.name}_${xtent.begin}_${xtent.end}`;
            newPlots = {...newPlots, [title]: {...xtent}};
        }     
        
        this.setState({scatterplots: newPlots});
    }

    deletePlot = (e) => {
        const plot = e.target.getAttribute("data-value");
        const newScatters = {...this.state.scatterplots};
        delete newScatters[plot];
        this.setState({ scatterplots: newScatters});
    };

    // essentially the same as useCallback
    setStateClickedProp = this.setStateClicked.bind(this);
    setStateHoveredProp = this.setStateHovered.bind(this);

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
                        setStateClicked={this.setStateClickedProp}
                        setStateHovered={this.setStateHoveredProp}
                        runs={this.props.runs}
                        stateHovered={this.state.stateHovered}
                        title={sc}
                        uniqueStates={sc_props.states}
                   />);            
        });
        
        const subSequenceCharts = this.state.subSequences.map((ss, idx) => {
            return (<Box key={`ss_${idx}`} sx={{minHeight: '50px', border: 1}}>
                        <Button onClick={() => {this.addSubsequenceScatterplot(ss)}}>Add scatter</Button>
                        <SelectionVis 
                            trajectories={this.props.trajectories}
                            extents={ss} />
                    </Box>);
        });

        return (
            <>
                <Box sx={this.props.sx}>
                {this.state.isLoading && <LoadingModal
                                             open={this.state.isLoading}
                                             title="Rendering..."/> }

                
                {safe &&                 
                 <GraphVis
                     sx={{flexBasis: '50%', border: 1}}
                     trajectories={this.props.trajectories}
                     runs={this.props.runs}
                     globalUniqueStates={this.props.globalUniqueStates}
                     setStateHovered={this.setStateHoveredProp}
                     setStateClicked={this.setStateClickedProp}
                     loadingCallback={this.chartFinishedLoading}
                     stateHovered={this.state.stateHovered}                     
                 />
                }

                {safe && (<ScatterGrid
                              sx={{flexBasis: '50%', border: 1, flexGrow: 0}}
                              control={
                                  <Box display="flex" justifyContent="center" gap={1}>
                                      <Typography variant="h6">Scatterplot View</Typography>
                                      <ButtonWithOpenMenu buttonText={<AddCircleIcon/>} func={this.addScatterplot} data={Object.keys(this.props.trajectories)}/>
                                  </Box>}
                              deletePlot={this.deletePlot}>
                              {scatterplots}
                          </ScatterGrid>)}
                                         
z            {this.state.currentModal === SINGLE_STATE_MODAL && (
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
             (<Box sx={{position: 'fixed', bottom: 0, zIndex: 1299, maxWidth: '25%'}}>
                  <Accordion defaultExpanded={false} disableGutters={true}>
                      <AccordionSummary
                          expandIcon={<ExpandMoreIcon />}
                      ><Typography variant="h6">Sub-sequence View</Typography></AccordionSummary>
                      <Divider/>
                      <AccordionDetails>
                          <Stack direction="column" sx={{overflow: 'scroll'}}>
                              {subSequenceCharts}
                          </Stack>
                      </AccordionDetails>
                  </Accordion>     
                  <Accordion defaultExpanded={true} disableGutters={true}>
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
                              setStateHovered={this.setStateHoveredProp}
                              setStateClicked={this.setStateClickedProp}
                              stateHovered={this.state.stateHovered}
                              setExtents={this.setExtents}                              
                          />
                      </AccordionDetails>
                  </Accordion>
              </Box>)
            }        
            </>
        );
    }
}

export default VisArea;
