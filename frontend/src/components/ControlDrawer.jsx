import {React, useState} from 'react';

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

import Drawer from '@mui/material/Drawer';

import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';

import Divider from '@mui/material/Divider';
import AnalysisTab from '../modals/AnalysisTab';

import AddFilterModal from '../modals/AddFilterModal';
import FilterComponent from './FilterComponent';
import CheckboxTable from './CheckboxTable';

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
  setProperties,
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
                {value: 0, label: '0%'},
                {value: 1, label: '100%'},
              ]}
            />
          </ListItem>
          <Divider />
          {Object.keys(runs[run].filters).length > 0 &&
            Object.keys(runs[run].filters).map(key => {
              const filter = runs[run].filters[key];

              return (
                <ListItem key={key}>
                  <FilterComponent filter={filter} run={run} propagateChange={propagateChange} />
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

  return (
    <>
      <Drawer anchor="right" variant="persistent" open={drawerOpen}>
          <Accordion disableGutters TransitionProps={{ unmountOnExit: true }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">Properties</Typography>
          </AccordionSummary>
          <Divider />
          <AccordionDetails>
            <CheckboxTable
              header="Property"
              api_call="/api/get_property_list"
              click={setProperties}
              clickedProps={properties}
            />
          </AccordionDetails>
        </Accordion>
        {controls}
        <Button
          color="secondary"
          size="small"
          variant="contained"
          onClick={() => {
            toggleDrawer();
          }}
        >
          Close
        </Button>
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

export default ControlDrawer;
