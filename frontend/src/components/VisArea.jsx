import React from 'react';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
// import AddCircleIcon from '@mui/icons-material/AddCircle';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
/* import TableContainer from "@mui/material/TableContainer";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";

import { DataGrid } from "@mui/x-data-grid"; */

import GraphVis from '../vis/GraphVis';
import Scatterplot from '../vis/Scatterplot';
import SelectionVis from '../vis/SelectionVis';
import TrajectoryChart from '../vis/TrajectoryChart';
import Legend from '../vis/Legend';

import SingleStateModal from '../modals/SingleStateModal';
import LoadingModal from '../modals/LoadingModal';
import MultiplePathSelectionModal from '../modals/MultiplePathSelectionModal';

import SubSequenceView from './SubSequenceView';
// import ButtonWithOpenMenu from "../components/ButtonWithOpenMenu";
import ScatterGrid from './ScatterGrid';

import '../css/App.css';

import NEBModal from '../modals/NEBModal';
import RemovableBox from './RemovableBox';
import CircularSequence from '../vis/CircularSequence';

import GlobalStates from '../api/globalStates';

const SINGLE_STATE_MODAL = 'single_state';
const MULTIPLE_PATH_SELECTION = 'multiple_selection';
const NEB = 'neb';

class VisArea extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            currentModal: null,
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
            visibleExtent: null,
        };
    }

    componentDidMount() {
        document.addEventListener('keydown', this.changeTimestep);
    }

    setExtents = (extent) => {
        const modEx = [];
        const { trajectories } = this.props;
        const { subSequences } = this.state;

        for (const ex of extent) {
            const ids = trajectories[ex.name].sequence.slice(ex.begin, ex.end + 1);
            let uniqueStates = null;
            if (!ex.states) {
                uniqueStates = [...new Set(ids)].map((state) => {
                    return { id: state };
                });
            } else {
                uniqueStates = ex.states;
            }
            const newEx = { ...ex, states: uniqueStates };
            modEx.push(newEx);
        }
        const count = Object.keys(subSequences).length;
        const extentsID = `ss_${count}`;
        this.setState({
            subSequences: { ...subSequences, [extentsID]: modEx },
            visibleExtent: extentsID,
        });
    };

    setExtentsUniqueStates = (extent) => {
        const modEx = [];
        const { subSequences } = this.state;

        for (const ex of extent) {
            const ids = ex.states.map((state) => {
                return { id: state.id };
            });

            const newEx = { ...ex, states: ids };
            modEx.push(newEx);
        }

        const count = Object.keys(subSequences).length;
        const extentsID = `ss_${count}`;

        this.setState({
            subSequences: { ...subSequences, [extentsID]: modEx },
            visibleExtent: extentsID,
        });
    };

    setVisible = (visible) => {
        this.setState({ visible: { ...visible } });
        // could set up visible here instead of doing it seperately for each vis...
        // each vis should just return toAdd, toRemove and have this do the math
    };

    setStateHovered = (stateInfo) => {
        this.setState({ stateHovered: stateInfo });
    };

    // sets the context box for the selection vis
    setSequenceExtent = (extent) => {
        this.setState({ sequenceExtent: extent });
    };

    /* Sets the currently clicked state to the supplied ID */
    setStateClicked = (id) => {
        this.setState({ stateClicked: GlobalStates.get(id) }, () => {
            this.toggleModal(SINGLE_STATE_MODAL);
        });
    };

    // essentially the same as useCallback
    setStateClickedProp = this.setStateClicked.bind(this);

    setStateHoveredProp = this.setStateHovered.bind(this);

    setExtentsProp = this.setExtents.bind(this);

    setExtentsUniqueStatesProp = this.setExtentsUniqueStates.bind(this);

    setSequenceExtentProp = this.setSequenceExtent.bind(this);

    addNEBPlot = (energies, drawSequence, trajectoryName) => {
        this.setState((previous) => ({
            NEBPlots: [...previous.NEBPlots, { energies, drawSequence, trajectoryName }],
        }));
    };

    toggleModal = (key) => {
        const { currentModal } = this.state;
        if (currentModal) {
            this.setState({
                currentModal: null,
            });
            return;
        }
        this.setState({ currentModal: key });
    };

    chartFinishedLoading = () => {
        this.setState({ isLoading: false });
    };

    addKSTestResult = (rvs, cdf, ksProperty, statistic, pvalue, extentsID) => {
        const results = {
            rvs,
            cdf,
            ksProperty,
            statistic,
            pvalue,
        };

        this.setState((previous) => ({
            KSTestResults: {
                ...previous.KSTestResults,
                [extentsID]:
                    previous.KSTestResults[extentsID] !== undefined
                        ? [...previous.KSTestResults[extentsID], results]
                        : [results],
            },
        }));
    };

    addAnalysisResult = (analysis, extentsID) => {
        this.setState((previous) => ({
            analyses: {
                ...previous.analyses,
                [extentsID]:
                    previous.analyses[extentsID] !== undefined
                        ? [...previous.analyses[extentsID], analysis]
                        : [analysis],
            },
        }));
    };

    addPathSimilarityResult = (e1, e2, score, extentsID) => {
        const scoreObj = { score, e1, e2 };
        this.setState((previous) => ({
            similarities: {
                ...previous.similarities,
                [extentsID]:
                    previous.similarities[extentsID] !== undefined
                        ? [...previous.similarities[extentsID], scoreObj]
                        : [scoreObj],
            },
        }));
    };

    changeTimestep = (e) => {
        const { stateHovered } = this.state;
        const { trajectories } = this.props;

        if (stateHovered !== null) {
            // timestep = index into simplifiedSequence array
            let timestep = null;

            if (stateHovered.timesteps) {
                console.log(stateHovered.timesteps);
            } else {
                timestep = stateHovered.timestep;
            }

            if (timestep) {
                if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    timestep = e.key === 'ArrowLeft' ? timestep - 1 : timestep + 1;
                    const { name } = stateHovered;
                    const stateID = trajectories[name].simplifiedSequence.sequence[timestep].id;
                    this.setStateHovered({
                        caller: e,
                        stateID,
                        name,
                        timestep,
                    });
                }
            }
        }
    };

    /* addScatterplot = (name) => {
        const count = Object.keys(this.state.scatterplots).length;
        const id = `${name}_sc_${count}`;
        const sc = { name };

        this.setState({ scatterplots: { ...this.state.scatterplots, [id]: sc } });
    }; */

    addSubsequenceScatterplot = (extent, id) => {
        const { scatterplots } = this.state;
        const count = Object.keys(scatterplots).length;
        const newPlots = {};
        const xCount = 0;
        for (const xtent of extent) {
            const title = `${id}_${count}_${xCount}`;
            newPlots[title] = { ...xtent };
        }
        this.setState({ scatterplots: { ...scatterplots, ...newPlots } });
    };

    // make this generalized
    deletePlot = (e) => {
        const { scatterplots } = this.state;
        const plot = e.target.getAttribute('data-value');
        const newScatters = { ...scatterplots };
        delete newScatters[plot];
        this.setState({ scatterplots: newScatters });
    };

    deleteChild = (e) => {
        const key = e.target.getAttribute('data-value');
        const childType = e.target.getAttribute('data-type');

        const { [childType]: childArray } = this.state;

        let stateArray = null;

        if (Array.isArray(childArray)) {
            stateArray = [...childArray];
        } else {
            stateArray = { ...childArray };
        }

        delete stateArray[key];
        this.setState({ [childType]: stateArray });
    };

    render() {
        const { trajectories, runs, properties, sx } = this.props;
        const {
            NEBPlots,
            scatterplots,
            stateHovered,
            subSequences,
            visibleExtent,
            sequenceExtent,
            isLoading,
            visible,
            currentModal,
            stateClicked,
            selectedExtents,
        } = this.state;

        const nebPlots = NEBPlots.map((plot, idx) => {
            return (
                <RemovableBox
                    deleteChild={this.deleteChild}
                    childType="NEBPlots"
                    childID={idx}
                    key={idx}
                    className="lightBorder"
                >
                    <Scatterplot
                        trajectories={trajectories}
                        setStateClicked={this.setStateClickedProp}
                        setStateHovered={this.setStateHoveredProp}
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
                </RemovableBox>
            );
        });

        const scplots = Object.keys(scatterplots).map((sc) => {
            const scProps = scatterplots[sc];
            return (
                <Scatterplot
                    key={sc}
                    trajectories={trajectories}
                    trajectoryName={scProps.name}
                    id={sc}
                    runs={runs}
                    setStateClicked={this.setStateClickedProp}
                    setStateHovered={this.setStateHoveredProp}
                    stateHovered={stateHovered}
                    properties={properties}
                    setExtents={this.setExtentsUniqueStatesProp}
                    title={sc}
                    sequence={scProps.states}
                    visibleExtent={subSequences[visibleExtent]}
                />
            );
            //
        });

        const subSequenceCharts = Object.keys(subSequences).map((id) => {
            const ss = subSequences[id];
            let maxStates = Number.MIN_VALUE;
            for (const e of ss) {
                maxStates = maxStates < e.states.length ? e.states.length : maxStates;
            }
            return (
                <SubSequenceView
                    key={id}
                    id={id}
                    deleteChild={this.deleteChild}
                    openMPSModal={() => {
                        this.setState({ selectedExtents: { ss, id } }, () => {
                            this.toggleModal(MULTIPLE_PATH_SELECTION);
                        });
                    }}
                    openNEBModal={() => {
                        this.setState({ selectedExtents: { ss, id } }, () => {
                            this.toggleModal(NEB);
                        });
                    }}
                    addScatterplot={() => {
                        this.addSubsequenceScatterplot(ss, id);
                    }}
                    setVisibleExtent={(d) => {
                        this.setState({ visibleExtent: d });
                    }}
                    visibleExtent={visibleExtent}
                    subSequence={ss}
                >
                    <SelectionVis
                        style={{
                            sx: { minHeight: '50px' },
                        }}
                        setStateClicked={this.setStateClickedProp}
                        setStateHovered={this.setStateHoveredProp}
                        trajectories={trajectories}
                        sequenceExtent={sequenceExtent}
                        maxStates={maxStates}
                        titleProp={id}
                        extents={ss}
                    />
                </SubSequenceView>
            );
        });

        return (
            <Box sx={sx}>
                {isLoading && <LoadingModal open={isLoading} title="Rendering..." />}
                <Box sx={{ flexBasis: '35%' }}>
                    <Legend trajectories={trajectories} />
                    <Typography color="secondary" align="center" gutterBottom variant="h6">
                        Sequence View
                    </Typography>
                    <CircularSequence
                        sx={{ minHeight: '45%' }}
                        trajectories={trajectories}
                        runs={runs}
                        loadingCallback={this.chartFinishedLoading}
                        setStateHovered={this.setStateHoveredProp}
                        setStateClicked={this.setStateClickedProp}
                        stateHovered={stateHovered}
                        visibleProp={visible}
                        setVisible={this.setVisible}
                        setExtents={this.setExtentsProp}
                        setSequenceExtent={this.setSequenceExtentProp}
                        visibleExtent={subSequences[visibleExtent]}
                    />
                    <TrajectoryChart
                        trajectories={trajectories}
                        runs={runs}
                        loadingCallback={this.chartFinishedLoading}
                        setStateHovered={this.setStateHoveredProp}
                        setStateClicked={this.setStateClickedProp}
                        stateHovered={stateHovered}
                        setVisible={this.setVisible}
                        setExtents={this.setExtentsProp}
                        setSequenceExtent={this.setSequenceExtentProp}
                        visibleExtent={subSequences[visibleExtent]}
                    />
                    {subSequenceCharts.length > 0 && (
                        <Accordion defaultExpanded={false} disableGutters>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography color="secondary" variant="h6">
                                    Sub-sequence View
                                </Typography>
                            </AccordionSummary>
                            <Divider />
                            <AccordionDetails>
                                <Box sx={{ maxHeight: '300px', overflow: 'auto' }}>
                                    {subSequenceCharts}
                                </Box>
                            </AccordionDetails>
                        </Accordion>
                    )}
                    {NEBPlots.length > 0 && (
                        <Accordion defaultExpanded={false} disableGutters>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                <Typography color="secondary" variant="h6">
                                    NEB Plots
                                </Typography>
                            </AccordionSummary>
                            <Divider />
                            <AccordionDetails sx={{ overflow: 'auto' }}>
                                <Box sx={{ maxHeight: '300px', overflow: 'auto' }}>{nebPlots}</Box>
                            </AccordionDetails>
                        </Accordion>
                    )}
                </Box>

                <GraphVis
                    style={{
                        sx: { flexBasis: '50%' },
                        className: 'lightBorder',
                    }}
                    trajectories={trajectories}
                    runs={runs}
                    setStateHovered={this.setStateHoveredProp}
                    setStateClicked={this.setStateClickedProp}
                    loadingCallback={this.chartFinishedLoading}
                    stateHovered={stateHovered}
                    visibleProp={visible}
                    setExtents={this.setExtentsUniqueStatesProp}
                    visibleExtent={subSequences[visibleExtent]}
                />

                <ScatterGrid
                    className="lightBorder"
                    sx={{ flexBasis: '50%', flexGrow: 0 }}
                    control={
                        <Typography color="secondary" align="center" gutterBottom variant="h6">
                            Scatterplot View
                        </Typography>
                    }
                    deletePlot={this.deletePlot}
                >
                    {scplots}
                </ScatterGrid>
                {currentModal === SINGLE_STATE_MODAL && (
                    <SingleStateModal
                        open={currentModal === SINGLE_STATE_MODAL}
                        state={GlobalStates.get(stateClicked.id)}
                        closeFunc={() => {
                            this.toggleModal(SINGLE_STATE_MODAL);
                        }}
                    />
                )}
                {currentModal === MULTIPLE_PATH_SELECTION && (
                    <MultiplePathSelectionModal
                        open={currentModal === MULTIPLE_PATH_SELECTION}
                        trajectories={trajectories}
                        extents={selectedExtents.ss}
                        extentsID={selectedExtents.id}
                        properties={properties}
                        addKSTestResult={this.addKSTestResult}
                        addAnalysisResult={this.addAnalysisResult}
                        addPathSimilarityResult={this.addPathSimilarityResult}
                        close={() => {
                            this.toggleModal(SINGLE_STATE_MODAL);
                        }}
                    />
                )}
                {currentModal === NEB && (
                    <NEBModal
                        open={currentModal === NEB}
                        trajectories={trajectories}
                        extents={selectedExtents.ss}
                        extentsID={selectedExtents.id}
                        addNEBPlot={this.addNEBPlot}
                        closeFunc={() => {
                            this.toggleModal(NEB);
                        }}
                    />
                )}
            </Box>
        );
    }
}

// <ButtonWithOpenMenu buttonText={<AddCircleIcon/>} func={this.addScatterplot} data={Object.keys(this.props.trajectories)}/>
export default VisArea;
