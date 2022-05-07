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
            subSequences: {},
            selectedExtents: null,
            KSTestResults: {},
            NEBPlots: []
        };
    }

    addNEBPlot = (energies, drawSequence) => {
        this.setState({NEBPlots: [...this.state.NEBPlots, {'energies': energies, 'drawSequence': drawSequence}]});
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
        const count = Object.keys(this.state.subSequences).length;
        const extents_id = `ss_${count}`;        
        this.setState({subSequences: {...this.state.subSequences, [extents_id] : modEx}});
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

        const count = Object.keys(this.state.subSequences).length;
        const extents_id = `ss_${count}`;
        
        this.setState({subSequences: {...this.state.subSequences, [extents_id]: modEx}});          
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

    addKSTestResult = (rvs, cdf, ksProperty, statistic, pvalue, extentsID) => {
        const results = {
            'rvs': rvs,
            'cdf': cdf,
            'ksProperty': ksProperty,
            'statistic': statistic,
            'pvalue': pvalue
        }

        this.setState({KSTestResults: {
            ...this.state.KSTestResults,
            [extentsID]: (this.state.KSTestResults[extentsID] !== undefined) ? [ ...this.state.KSTestResults[extentsID], results] : [results]
        }});        
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

    addSubsequenceScatterplot = (extent, id) => {
        const count = Object.keys(this.state.scatterplots).length;
        const stateArray = [];
        for (const xtent of extent) {                        
            stateArray.push(...xtent.states);
        }
        const title = `${id}_${count}`;
        
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

        const NEBPlots = this.state.NEBPlots.map((plot, idx) => {
            return (
                <Box key={idx} className="lightBorder">
                    <Scatterplot
                        trajectories={this.props.trajectories}
                        globalUniqueStates={this.props.globalUniqueStates}                                    
                        sequence={plot.drawSequence}
                        yAttributeListProp={plot.energies}
                        xAttributeProp="timestep"
                        yAttributeProp="energies"
                        properties={['timestep','energies']}
                        xAttributeListProp={plot.drawSequence.map((s) => s.timestep)}
                        yAttributeList={plot.energies}
                        path={true}
                        enableMenu={false}
                    />
                </Box>);                                                    
        });
        
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
        
        const subSequenceCharts = Object.keys(this.state.subSequences).map((id) => {
            const ss = this.state.subSequences[id];

            const KSTestResultsArray = this.state.KSTestResults[id];
            
            const KSTestRender = (KSTestResultsArray !== undefined) ? KSTestResultsArray.map((results, idx) => {
                return (<p key={idx}>{JSON.stringify(results)}</p>);
            }) : null;
            
            return (<Box key={id} className="lightBorder" sx={{minHeight: '50px'}}>
                        <Stack direction="row" justifyContent="center">
                            <Button color="secondary" onClick={() => {this.addSubsequenceScatterplot(ss, id)}}>Add scatterplot</Button>
                            <Button color="secondary" onClick={() => {this.setState({selectedExtents: {'ss': ss, 'id': id}}, () => {this.toggleModal(MULTIPLE_PATH_SELECTION);})}}>Analysis</Button>
                            {ss.some(isPath) && <Button color="secondary" onClick={() => {this.setState({selectedExtents: {'ss': ss, 'id': id}}, () => {this.toggleModal(NEB);})}}>NEB</Button>}
                        </Stack>
                        <SelectionVis
                            style={{
                                sx:{minHeight: '50px'}
                            }}
                            globalUniqueStates={this.props.globalUniqueStates}                            
                            trajectories={this.props.trajectories}
                            titleProp={id}
                            extents={ss} />
                        {KSTestRender}
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
                          {subSequenceCharts.length > 0 &&
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
                           </Accordion>}
                          {NEBPlots.length > 0 &&
                           <Accordion defaultExpanded={false} disableGutters={true}>
                               <AccordionSummary
                                   expandIcon={<ExpandMoreIcon />}
                              ><Typography
                                   color="secondary"
                                   variant="h6">NEB Plots</Typography></AccordionSummary>
                              <Divider/>
                              <AccordionDetails sx={{overflow: 'scroll'}}>
                                  <Stack direction="column">
                                      {NEBPlots}
                                  </Stack>
                              </AccordionDetails>
                           </Accordion>}
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
                            extents={this.state.selectedExtents.ss}
                            extentsID={this.state.selectedExtents.id}
                            properties={this.props.properties}
                            addKSTestResult={this.addKSTestResult}
                            close={() => {
                                this.toggleModal(SINGLE_STATE_MODAL);                                                        
                            }}
                        />
                    )}
                    {this.state.currentModal === NEB && (
                        <NEBModal
                            open={this.state.currentModal === NEB}
                            trajectories={this.props.trajectories}
                            extents={this.state.selectedExtents.ss}
                            extentsID={this.state.selectedExtents.id}
                            addNEBPlot={this.addNEBPlot}
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
