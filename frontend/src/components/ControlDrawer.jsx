import { React, useState } from 'react';

import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';

import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';

import Typography from '@mui/material/Typography';
import Toolbar from '@mui/material/Toolbar';

import Drawer from '@mui/material/Drawer';

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';

import Divider from '@mui/material/Divider';

import IconButton from '@mui/material/IconButton';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import Container from '@mui/material/Container';
import AnalysisTab from '../modals/AnalysisTab';
import AddFilterModal from '../modals/AddFilterModal';

import ChartBox from './ChartBox';
import FilterComponent from './FilterComponent';
import Timeline from '../vis/Timeline';

const ADD_FILTER_MODAL = 'add-filter-modal';
const METADATA_MODAL = 'metadata-modal';
const ANALYSIS_MODAL = 'analysis-modal';

function ControlDrawer({
    trajectories,
    runs,
    updateRun,
    recalculateClustering,
    simplifySet,
    drawerOpen,
    toggleDrawer,
    addFilter,
    propagateChange,
    properties,
}) {
    const [currentModal, setCurrentModal] = useState();
    const [currentRun, setCurrentRun] = useState(null);

    const toggleModal = (key) => {
        if (currentModal) {
            setCurrentModal();

            return;
        }
        setCurrentModal(key);
    };

    const thisRecalculateClustering = async (run) => {
        try {
            await recalculateClustering(run, runs[run].current_clustering);
        } catch (e) {
            updateRun(run, 'current_clustering', trajectories[run].current_clustering);
        }
    };

    const controls = Object.keys(runs).map((run) => (
        <Accordion disableGutters key={run}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">{run}</Typography>
            </AccordionSummary>
            <Divider />
            <AccordionDetails>
                <Button
                    onClick={() => {
                        setCurrentRun(run);
                        toggleModal(METADATA_MODAL);
                    }}
                >
                    Display metadata
                </Button>
                <Button
                    onClick={() => {
                        setCurrentRun(run);
                        toggleModal(ANALYSIS_MODAL);
                    }}
                >
                    Run analysis
                </Button>
                <List key={run}>
                    <ListItem>
                        <ListItemText>
                            <Typography>Number of PCCA clusters</Typography>
                        </ListItemText>
                    </ListItem>
                    <ListItem>
                        <Slider
                            step={1}
                            min={2}
                            max={20}
                            onChangeCommitted={() => {
                                thisRecalculateClustering(run);
                            }}
                            valueLabelDisplay="auto"
                            onChange={(e) => {
                                updateRun(run, 'current_clustering', e.target.value);
                            }}
                            value={runs[run].current_clustering}
                            marks={[
                                { value: 2, label: '2' },
                                { value: 20, label: '20' },
                            ]}
                        />
                    </ListItem>
                    <ListItem>
                        <ListItemText>
                            <Typography>Simplification threshold</Typography>
                        </ListItemText>
                    </ListItem>
                    <ListItem>
                        <Slider
                            step={0.01}
                            min={0}
                            max={1}
                            onChangeCommitted={() => {
                                simplifySet(run, runs[run].chunkingThreshold);
                            }}
                            valueLabelDisplay="auto"
                            onChange={(e) => {
                                updateRun(run, 'chunkingThreshold', e.target.value);
                            }}
                            value={runs[run].chunkingThreshold}
                            marks={[
                                { value: 0, label: '0%' },
                                { value: 1, label: '100%' },
                            ]}
                        />
                    </ListItem>
                    <Divider />
                    {Object.keys(runs[run].filters).length > 0 &&
                        Object.keys(runs[run].filters).map((key) => {
                            const filter = runs[run].filters[key];

                            return (
                                <ListItem key={key}>
                                    <FilterComponent
                                        filter={filter}
                                        run={run}
                                        propagateChange={propagateChange}
                                    />
                                </ListItem>
                            );
                        })}
                    <ListItem>
                        <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                                setCurrentRun(run);
                                toggleModal(ADD_FILTER_MODAL);
                            }}
                        >
                            Add a new filter
                        </Button>
                    </ListItem>
                </List>
            </AccordionDetails>
        </Accordion>
    ));

    // we want persistent because it doesn't draw a backdrop & its state is saved between opening and closing it
    return (
        <>
            <Drawer
                anchor="right"
                variant="persistent"
                open={drawerOpen}
                onClose={() => toggleDrawer()}
            >
                <Toolbar
                    variant="dense"
                    sx={{ fontColor: '#394043', boxShadow: '0 1px 2px rgba(0,0,0,0.4)' }}
                >
                    <IconButton onClick={() => toggleDrawer()}>
                        <ChevronRightIcon />
                    </IconButton>
                </Toolbar>
                <Container maxWidth="xs">
                    <ChartBox>
                        {(width) => {
                            // 50px per trajectory
                            const h = Object.keys(trajectories).length * 50;
                            return Object.values(trajectories).map((trajectory) => (
                                <Timeline
                                    width={width}
                                    setExtent={(name, values) => {
                                        updateRun(name, 'extents', values);
                                    }}
                                    height={h}
                                    trajectory={trajectory}
                                    run={runs[trajectory.name]}
                                />
                            ));
                        }}
                    </ChartBox>
                    {/* <ZTable trajectories={trajectories} propertyList={structuralAnalysisProps} /> */}
                    {controls}
                </Container>
            </Drawer>

            {currentModal === ADD_FILTER_MODAL && (
                <AddFilterModal
                    title={`Add filter for ${currentRun}`}
                    open={currentModal === ADD_FILTER_MODAL}
                    properties={properties}
                    trajectory={trajectories[currentRun]}
                    closeFunc={() => {
                        toggleModal(null);
                    }}
                    addFilter={addFilter}
                    run={currentRun}
                />
            )}

            {currentModal === ANALYSIS_MODAL && (
                <Dialog
                    open={currentModal === ANALYSIS_MODAL}
                    onClose={toggleModal}
                    onBackdropClick={() => {
                        toggleModal(null);
                    }}
                >
                    <DialogTitle>
                        Analysis for
                        {currentRun}
                    </DialogTitle>
                    <AnalysisTab run={currentRun} closeFunc={toggleModal} />
                </Dialog>
            )}

            {currentModal === METADATA_MODAL && (
                <Dialog
                    open={currentModal === METADATA_MODAL}
                    onClose={toggleModal}
                    onBackdropClick={() => {
                        toggleModal(null);
                    }}
                >
                    <DialogTitle>
                        Metadata for
                        {currentRun}
                    </DialogTitle>
                    <DialogContent>
                        <p>{trajectories[currentRun].LAMMPSBootstrapScript}</p>
                    </DialogContent>
                    <DialogActions>
                        <Button
                            onClick={() => {
                                toggleModal(null);
                            }}
                        >
                            Close
                        </Button>
                    </DialogActions>
                </Dialog>
            )}
        </>
    );
}

/* */

export default ControlDrawer;
