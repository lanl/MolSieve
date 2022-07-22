import React from "react";
import Box from "@mui/material/Box";
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
//import AddCircleIcon from '@mui/icons-material/AddCircle';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
/*import TableContainer from "@mui/material/TableContainer";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import { DataGrid } from "@mui/x-data-grid";*/

import GraphVis from "../vis/GraphVis";
import Scatterplot from "../vis/Scatterplot";
import SelectionVis from '../vis/SelectionVis';
//import TrajectoryChart from "../vis/TrajectoryChart";

import SingleStateModal from "../modals/SingleStateModal";
import LoadingModal from "../modals/LoadingModal";
import MultiplePathSelectionModal from '../modals/MultiplePathSelectionModal';

import SubSequenceView from "./SubSequenceView";
//import ButtonWithOpenMenu from "../components/ButtonWithOpenMenu";
import ScatterGrid from "./ScatterGrid";

import '../css/App.css';

import NEBModal from "../modals/NEBModal";
import RemovableBox from "./RemovableBox";
import CircularSequence from "../vis/CircularSequence";

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
      analyses: {},
      similarities: {},
      NEBPlots: [],
      visible: null,
      sequenceExtent: null,
      visibleExtent: null
    };
  }

  addNEBPlot = (energies, drawSequence, trajectoryName) => {
    this.setState({ NEBPlots: [...this.state.NEBPlots, { 'energies': energies, 'drawSequence': drawSequence, 'trajectoryName': trajectoryName }] });
  }

  setExtents = (extent) => {
    const modEx = [];
    for (const ex of extent) {
      const ids = this.props.trajectories[ex.name].sequence.slice(ex.begin, ex.end + 1);
      let uniqueStates = null;
      if (!ex.states) {
        uniqueStates = [...new Set(ids)].map((state) => {
          return { 'id': state };
        });
      } else {
        uniqueStates = ex.states;
      }
      const newEx = { ...ex, states: uniqueStates };
      modEx.push(newEx);
    }
    const count = Object.keys(this.state.subSequences).length;
    const extents_id = `ss_${count}`;
    this.setState({
      subSequences: { ...this.state.subSequences, [extents_id]: modEx },
      visibleExtent: extents_id
    });
  }

  setExtentsUniqueStates = (extent) => {
    const modEx = [];
    for (const ex of extent) {
      const ids = ex.states.map((state) => {
        return { 'id': state.id };
      });

      const newEx = { ...ex, states: ids };
      modEx.push(newEx);
    }

    const count = Object.keys(this.state.subSequences).length;
    const extents_id = `ss_${count}`;

    this.setState({
      subSequences: { ...this.state.subSequences, [extents_id]: modEx },
      visibleExtent: extents_id
    });
  }

  setVisible = (visible) => {
    this.setState({ visible: { ...visible } });
    // could set up visible here instead of doing it seperately for each vis...
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
    this.setState({ stateHovered: stateInfo });
  }

  // sets the context box for the selection vis
  setSequenceExtent = (extent) => {
    this.setState({ sequenceExtent: extent });
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

    this.setState({
      KSTestResults: {
        ...this.state.KSTestResults,
        [extentsID]: (this.state.KSTestResults[extentsID] !== undefined) ? [...this.state.KSTestResults[extentsID], results] : [results]
      }
    });
  }

  addAnalysisResult = (analysis, extentsID) => {
    this.setState({
      analyses: {
        ...this.state.analyses,
        [extentsID]: (this.state.analyses[extentsID] !== undefined) ? [...this.state.analyses[extentsID], analysis] : [analysis]
      }
    });
  }

  addPathSimilarityResult = (e1, e2, score, extentsID) => {
    const scoreObj = { 'score': score, 'e1': e1, 'e2': e2 };
    this.setState({
      similarities: {
        ...this.state.similarities,
        [extentsID]: (this.state.similarities[extentsID] !== undefined) ? [...this.state.similarities[extentsID], scoreObj] : [scoreObj]
      }
    });
  }

  changeTimestep = (e) => {
    if (this.state.stateHovered !== null) {
      // timestep = index into simplifiedSequence array            
      let timestep = null;

      if (this.state.stateHovered.timesteps) {
        console.log(this.state.stateHovered.timesteps);
      } else {
        timestep = this.state.stateHovered.timestep;
      }

      if (timestep) {
        if (e.key == 'ArrowLeft' || e.key == 'ArrowRight') {
          timestep = (e.key == 'ArrowLeft') ? timestep - 1 : timestep + 1;
          const name = this.state.stateHovered.name;
          const stateID = this.props.trajectories[name].simplifiedSequence.sequence[timestep].id;
          this.setStateHovered({ 'caller': e, 'stateID': stateID, 'name': name, 'timestep': timestep });
        }
      }
    }
  }

  setStateClicked = (state) => {
    this.setState({ stateClicked: state }, () => {
      this.toggleModal(SINGLE_STATE_MODAL)
    });
  }

  addScatterplot = (name) => {
    const count = Object.keys(this.state.scatterplots).length;
    const id = `${name}_sc_${count}`;
    const sc = { 'name': name };

    this.setState({ scatterplots: { ...this.state.scatterplots, [id]: sc } });
  }

  addSubsequenceScatterplot = (extent, id) => {
    const count = Object.keys(this.state.scatterplots).length;
    const newPlots = {};
    let xCount = 0;
    for (const xtent of extent) {
      const title = `${id}_${count}_${xCount}`;
      newPlots[title] = { ...xtent };
    }
    this.setState({ scatterplots: { ...this.state.scatterplots, ...newPlots } });
  }

  // make this generalized
  deletePlot = (e) => {
    const plot = e.target.getAttribute("data-value");
    const newScatters = { ...this.state.scatterplots };
    delete newScatters[plot];
    this.setState({ scatterplots: newScatters });
  };

  deleteChild = (e) => {
    const key = e.target.getAttribute("data-value");
    const childType = e.target.getAttribute("data-type");

    let stateArray = null;

    if (Array.isArray(this.state[childType])) {
      stateArray = [...this.state[childType]];
    } else {
      stateArray = { ...this.state[childType] };
    }

    delete stateArray[key];
    this.setState({ [childType]: stateArray });
  }

  // essentially the same as useCallback
  setStateClickedProp = this.setStateClicked.bind(this);
  setStateHoveredProp = this.setStateHovered.bind(this);
  setExtentsProp = this.setExtents.bind(this);
  setExtentsUniqueStatesProp = this.setExtentsUniqueStates.bind(this);
  setSequenceExtentProp = this.setSequenceExtent.bind(this);

  render() {
    const runs = Object.keys(this.props.runs);
    const trajs = Object.keys(this.props.trajectories);
    const safe = (runs.length === trajs.length && runs.length > 0 && trajs.length > 0) ? true : false;
    console.log(this.state.NEBPlots);
    const NEBPlots = this.state.NEBPlots.map((plot, idx) => {
      return (
        <RemovableBox
          deleteChild={this.deleteChild}
          childType="NEBPlots"
          childID={idx}
          key={idx} className="lightBorder">
          <Scatterplot
            trajectories={this.props.trajectories}
            setStateClicked={this.setStateClickedProp}
            setStateHovered={this.setStateHoveredProp}
            globalUniqueStates={this.props.globalUniqueStates}
            sequence={plot.drawSequence}
            yAttributeListProp={plot.energies}
            xAttributeProp="timestep"
            yAttributeProp="energies"
            properties={['timestep', 'energies']}
            xAttributeListProp={plot.drawSequence.map((s) => s.timestep)}
            yAttributeList={plot.energies}
            path
            enableMenu={false}
          />
        </RemovableBox>);
    });

    const scatterplots = Object.keys(this.state.scatterplots).map((sc) => {
      const sc_props = this.state.scatterplots[sc];
      return (<Scatterplot
        key={sc}
        trajectories={this.props.trajectories}
        globalUniqueStates={this.props.globalUniqueStates}
        trajectoryName={sc_props.name}
        id={sc}
        runs={this.props.runs}
        setStateClicked={this.setStateClickedProp}
        setStateHovered={this.setStateHoveredProp}
        stateHovered={this.state.stateHovered}
        properties={this.props.properties}
        setExtents={this.setExtentsUniqueStatesProp}
        title={sc}
        sequence={sc_props.states}
        visibleExtent={this.state.subSequences[this.state.visibleExtent]}
      />);
      // 
    });

    const subSequenceCharts = Object.keys(this.state.subSequences).map((id) => {
      const ss = this.state.subSequences[id];
      let maxStates = Number.MIN_VALUE;
      for (const e of ss) {
        maxStates = (maxStates < e.states.length) ? e.states.length : maxStates;
      }
      return (<SubSequenceView
        key={id}
        id={id}
        deleteChild={this.deleteChild}
        openMPSModal={() => { this.setState({ selectedExtents: { 'ss': ss, 'id': id } }, () => { this.toggleModal(MULTIPLE_PATH_SELECTION); }) }}
        openNEBModal={() => { this.setState({ selectedExtents: { 'ss': ss, 'id': id } }, () => { this.toggleModal(NEB); }) }}
        addScatterplot={() => { this.addSubsequenceScatterplot(ss, id) }}
        setVisibleExtent={(id) => {
          this.setState({ visibleExtent: id });
        }}
        visibleExtent={this.state.visibleExtent}
        subSequence={ss}
      >
        <SelectionVis
          style={{
            sx: { minHeight: '50px' }
          }}
          setStateClicked={this.setStateClickedProp}
          setStateHovered={this.setStateHoveredProp}

          globalUniqueStates={this.props.globalUniqueStates}
          trajectories={this.props.trajectories}
          sequenceExtent={this.state.sequenceExtent}
          maxStates={maxStates}
          titleProp={id}
          extents={ss} />
      </SubSequenceView>);
    });

    return (
      <>
        <Box sx={this.props.sx}>
          {this.state.isLoading && <LoadingModal
            open={this.state.isLoading}
            title="Rendering..." />}

          {safe &&
            (<Box sx={{ flexBasis: '25%' }}>
              <Box>
                <Typography
                  color="secondary"
                  align="center"
                  gutterBottom={true}
                  variant="h6">Sequence View</Typography>
                <CircularSequence
                  trajectories={this.props.trajectories}
                  globalUniqueStates={this.props.globalUniqueStates}
                  runs={this.props.runs}
                  loadingCallback={this.chartFinishedLoading}
                  setStateHovered={this.setStateHoveredProp}
                  setStateClicked={this.setStateClickedProp}
                  stateHovered={this.state.stateHovered}
                  setVisible={this.setVisible}
                  setExtents={this.setExtentsProp}
                  setSequenceExtent={this.setSequenceExtentProp}
                  visibleExtent={this.state.subSequences[this.state.visibleExtent]}
                />
              </Box>
              {subSequenceCharts.length > 0 &&
                <Accordion defaultExpanded={false} disableGutters={true}>
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                  ><Typography
                    color="secondary"
                    variant="h6">Sub-sequence View</Typography></AccordionSummary>
                  <Divider />
                  <AccordionDetails>
                    <Box sx={{ maxHeight: '300px', overflow: 'auto' }}>
                      {subSequenceCharts}
                    </Box>
                  </AccordionDetails>
                </Accordion>}
              {NEBPlots.length > 0 &&
                <Accordion defaultExpanded={false} disableGutters={true}>
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                  ><Typography
                    color="secondary"
                    variant="h6">NEB Plots</Typography></AccordionSummary>
                  <Divider />
                  <AccordionDetails sx={{ overflow: 'auto' }}>
                    <Box sx={{ maxHeight: '300px', overflow: 'auto' }}>
                      {NEBPlots}
                    </Box>
                  </AccordionDetails>
                </Accordion>}
            </Box>)
          }

          {safe &&
            <GraphVis
              style={{
                sx: { flexBasis: '50%' },
                className: "lightBorder"
              }}
              trajectories={this.props.trajectories}
              runs={this.props.runs}
              globalUniqueStates={this.props.globalUniqueStates}
              setStateHovered={this.setStateHoveredProp}
              setStateClicked={this.setStateClickedProp}
              loadingCallback={this.chartFinishedLoading}
              stateHovered={this.state.stateHovered}
              visibleProp={this.state.visible}
              setExtents={this.setExtentsUniqueStatesProp}
              visibleExtent={this.state.subSequences[this.state.visibleExtent]}
            />
          }

          {safe &&
            (<ScatterGrid
              className="lightBorder"
              sx={{ flexBasis: '50%', flexGrow: 0 }}
              control={
                <Typography
                  color="secondary"
                  align="center"
                  gutterBottom={true}
                  variant="h6">Scatterplot View</Typography>
              }
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
              addAnalysisResult={this.addAnalysisResult}
              addPathSimilarityResult={this.addPathSimilarityResult}
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
              closeFunc={() => { this.toggleModal(NEB) }}
            />
          )}
        </Box>
      </>
    );
  }
}

//<ButtonWithOpenMenu buttonText={<AddCircleIcon/>} func={this.addScatterplot} data={Object.keys(this.props.trajectories)}/>
export default VisArea;
