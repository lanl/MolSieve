import React from "react";
import Box from "@mui/material/Box";
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';

import GraphVis from "../vis/GraphVis";
import Scatterplot from "../vis/Scatterplot";
import SelectionVis from '../vis/SelectionVis';
import TrajectoryChart from "../vis/TrajectoryChart";

import SingleStateModal from "../modals/SingleStateModal";
import LoadingModal from "../modals/LoadingModal";
import MultiplePathSelectionModal from '../modals/MultiplePathSelectionModal';

import ButtonWithOpenMenu from "../components/ButtonWithOpenMenu";
import ScatterGrid from "./ScatterGrid";

import '../css/App.css';
import {isPath} from '../api/myutils';
import NEBModal from "../modals/NEBModal";

const SINGLE_STATE_MODAL = 'single_state';
const MULTIPLE_PATH_SELECTION = 'multiple_selection';
const NEB = 'neb';

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
            subSequences: [],
            selectedExtents: null
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

    setExtentsUniqueStates = (extent) => {
        const modEx = [];
        for(const ex of extent) {
            const ids = ex.states.map((state) => {
                return {'id': state.id};
            });
            
            const newEx = {...ex, states: ids};
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

    addSubsequenceScatterplot = (extent, idx) => {
        const count = Object.keys(this.state.scatterplots).length;
        const stateArray = [];
        for (const xtent of extent) {                        
            stateArray.push(...xtent.states);
        }
        const title = `ss_${idx}_${count}`;
        
        this.setState({scatterplots: {...this.state.scatterplots, [title]: {'states': stateArray}}});
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
    setExtentsProp = this.setExtents.bind(this);
    setExtentsUniqueStatesProp = this.setExtentsUniqueStates.bind(this);
    
    render() {
        const runs = Object.keys(this.props.runs);
        const trajs = Object.keys(this.props.trajectories);
        const safe = (runs.length === trajs.length && runs.length > 0 && trajs.length > 0) ? true : false;

        const scatterplots = Object.keys(this.state.scatterplots).map((sc) => {
            const sc_props = this.state.scatterplots[sc];            
            return (<Scatterplot
                        key={sc}
                        trajectories={this.props.trajectories}
                        globalUniqueStates={this.props.globalUniqueStates}       
                        trajectoryName={sc_props.name}
                        id={sc}
                        setStateClicked={this.setStateClickedProp}
                        setStateHovered={this.setStateHoveredProp}
                        runs={this.props.runs}
                        stateHovered={this.state.stateHovered}
                        properties={this.props.properties}
                        setExtents={this.setExtentsUniqueStatesProp}
                        title={sc}
                        sequence={(sc_props.name !== undefined) ? this.props.trajectories[sc_props.name].simplifiedSequence.sequence : sc_props.states}
                   />);            
        });
        
        const subSequenceCharts = this.state.subSequences.map((ss, idx) => {
            return (<Box key={idx} className="lightBorder" sx={{minHeight: '50px'}}>
                        <Stack direction="row" justifyContent="center">
                            <Button color="secondary" onClick={() => {this.addSubsequenceScatterplot(ss, idx)}}>Add scatterplot</Button>
                            <Button color="secondary" onClick={() => {this.setState({selectedExtents: ss}, () => {this.toggleModal(MULTIPLE_PATH_SELECTION);})}}>Analysis</Button>
                            {ss.some(isPath) && <Button color="secondary" onClick={() => {this.setState({selectedExtents: ss}, () => {this.toggleModal(NEB);})}}>NEB</Button>}
                        </Stack>
                        <SelectionVis
                            style={{
                                sx:{minHeight: '50px'}
                            }}
                            globalUniqueStates={this.props.globalUniqueStates}                            
                            trajectories={this.props.trajectories}
                            titleProp={`ss_${idx}`}
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
                     (<Box sx={{position:'absolute', zIndex: 1299, maxWidth: '25%'}}>
                          <Accordion defaultExpanded={true} disableGutters={true}>
                              <AccordionSummary
                                  expandIcon={<ExpandMoreIcon />}
                              ><Typography
                                   color="secondary"
                                   variant="h6">Sequence View</Typography></AccordionSummary>
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
                                      setExtents={this.setExtentsProp}                              
                                  />
                              </AccordionDetails>
                          </Accordion>
                          <Accordion defaultExpanded={false} disableGutters={true}>
                              <AccordionSummary
                                  expandIcon={<ExpandMoreIcon />}
                              ><Typography
                                   color="secondary"
                                   variant="h6">Sub-sequence View</Typography></AccordionSummary>
                              <Divider/>
                              <AccordionDetails sx={{overflow: 'scroll'}}>
                                  <Stack direction="column">
                                      {subSequenceCharts}
                                  </Stack>
                              </AccordionDetails>
                          </Accordion>                               
                      </Box>)
                    }        
                                   
                    {safe &&                 
                     <GraphVis
                         style={{
                             sx:{flexBasis: '50%'},
                             className:"lightBorder"
                         }}
                         trajectories={this.props.trajectories}
                         runs={this.props.runs}
                         globalUniqueStates={this.props.globalUniqueStates}
                         setStateHovered={this.setStateHoveredProp}
                         setStateClicked={this.setStateClickedProp}
                         loadingCallback={this.chartFinishedLoading}
                         stateHovered={this.state.stateHovered}
                         setExtents={this.setExtentsUniqueStatesProp}
                     />
                    }

                    {safe && (<ScatterGrid
                                  className="lightBorder"
                                  sx={{flexBasis: '50%', flexGrow: 0}}
                                  control={
                                      <Box display="flex" justifyContent="center"gap={1}>
                                          <Typography
                                              color="secondary"
                                              variant="h6">Scatterplot View</Typography>
                                          <ButtonWithOpenMenu buttonText={<AddCircleIcon/>} func={this.addScatterplot} data={Object.keys(this.props.trajectories)}/>
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
                    {this.state.currentModal === MULTIPLE_PATH_SELECTION && (
                        <MultiplePathSelectionModal                            
                            open={this.state.currentModal === MULTIPLE_PATH_SELECTION}
                            trajectories={this.props.trajectories}
                            extents={this.state.selectedExtents}
                            properties={this.props.properties}
                            close={() => {
                                this.toggleModal(SINGLE_STATE_MODAL);                                                        
                            }}
                        />
                    )}
                    {this.state.currentModal === NEB && (
                        <NEBModal
                            open={this.state.currentModal === NEB}
                            trajectories={this.props.trajectories}
                            extents={this.state.selectedExtents}
                            globalUniqueStates={this.props.globalUniqueStates}
                            closeFunc={() => {this.toggleModal(NEB)}}
                        />
                    )}
            </Box>
            </>
        );
    }
}

export default VisArea;
