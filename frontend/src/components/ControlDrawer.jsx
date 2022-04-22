import { React, useState } from 'react';

import Box from '@mui/material/Box';

import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';

import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';

import Drawer from '@mui/material/Drawer';

import AddFilterModal from '../modals/AddFilterModal';

import FilterComponent from './FilterComponent';

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';

const ADD_FILTER_MODAL = "add-filter-modal";
const METADATA_MODAL = "metadata-modal";


function ControlDrawer({trajectories, runs, updateRun, recalculate_clustering, simplifySet, drawerOpen, toggleDrawer, addFilter, propagateChange}) {
    const [currentModal, setCurrentModal] = useState();
    const [currentRun, setCurrentRun] = useState(null);
    
    const toggleModal = (key) => {
        if (currentModal) {
            setCurrentModal();
           
            return;
        }
        setCurrentModal(key);
    };

    const this_recalculate_clustering = async (run) => {
        try {
            await recalculate_clustering(
                run,
                runs[run]["current_clustering"]
            );            
        } catch(e) {
            updateRun(
                run,
                "current_clustering",
                trajectories[run].current_clustering
            );        
        }         
    };

    // next, add accordions
    const controls = Object.keys(runs).map((run) => {
        return (
            <Accordion disableGutters={true} key={run}>
                <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                >{run}
                </AccordionSummary>
                <AccordionDetails>
                    <List key={run}>
                        <ListItem>
                            <Button size="small" variant="outlined"
                                    onClick={() => {
                                        setCurrentRun(run), () => {
                                            toggleModal(METADATA_MODAL);   
                                };
                            }}>
                                Display metadata
                            </Button>
                        </ListItem>
                <ListItem>
                    <Slider
                        step={1}
                        min={2}
                        max={20}                        
                        onChangeCommitted={() => {
                            this_recalculate_clustering(run);
                        }}                        
                        valueLabelDisplay="auto"
                        onChange={(e) => {
                            updateRun(
                                run,
                                "current_clustering",
                                e.target.value
                            );
                        }}
                        value={runs[run]["current_clustering"]}
                    />
                </ListItem>
                <ListItem>
                    <ListItemText secondary={runs[run]["current_clustering"] + " clusters"}>                            
                    </ListItemText>
                </ListItem>
                <ListItem>
                    <Slider step={0.05}
                            min={0}
                            max={1}
                            onChangeCommitted={() => {
                                simplifySet(run, runs[run].chunkingThreshold);
                            }}
                            valueLabelDisplay="auto"
                            onChange={(e) => {
                                updateRun(run, "chunkingThreshold", e.target.value);
                            }}
                            value={runs[run].chunkingThreshold}
                    />
                </ListItem>
                <ListItem>
                    <ListItemText secondary={`${runs[run]["chunkingThreshold"] * 100}% chunking threshold`}/>                            
                </ListItem>                        

                {Object.keys(runs[run]["filters"]).length > 0 &&
                 Object.keys(runs[run]["filters"]).map((key, idx) => {
                     const filter = runs[run]["filters"][key];
                     return (
                         <ListItem key={idx}>
                             <FilterComponent
                                 filter={filter}
                                 run={run}
                                 propagateChange={propagateChange}
                             />
                         </ListItem>);
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
        );
    });    
    
    return (
        <Box>
            <Drawer anchor="right" variant="persistent" open={drawerOpen}>
                {controls}
                <Button color="secondary" size="small" variant="contained" onClick={() => {
                            toggleDrawer();
                        }}>
                    Close
                </Button>
            </Drawer>
            

            {currentModal === ADD_FILTER_MODAL &&
             (
                 <AddFilterModal
                     title={`Add filter for ${currentRun}`}
                     open={currentModal === ADD_FILTER_MODAL}
                     trajectory={
                         trajectories[currentRun]
                     }
                     closeFunc={() => {
                         toggleModal(null);
                     }}
                     addFilter={addFilter}
                     run={currentRun}
                 />
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
                        Metadata for {currentRun}
                    </DialogTitle>
                    <DialogContent>
                        {
                            trajectories[currentRun]
                                .LAMMPSBootstrapScript
                        }
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
        </Box>);
}

export default ControlDrawer;
