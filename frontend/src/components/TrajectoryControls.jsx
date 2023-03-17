import { React, useState } from 'react';
import { useSelector } from 'react-redux';

import List from '@mui/material/List';

import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';

import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import Slider from '@mui/material/Slider';

export default function TrajectoryControls({ name, simplifySet }) {
    const initThreshold = useSelector((state) => state.trajectories.values[name].chunkingThreshold);
    const initClustering = useSelector(
        (state) => state.trajectories.values[name].currentClustering
    );
    const [chunkingThreshold, setChunkingThreshold] = useState(initThreshold);
    const [currentClustering, setCurrentClustering] = useState(initClustering);

    return (
        <Accordion disableGutters key={name}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6">{name}</Typography>
            </AccordionSummary>
            <Divider />
            <AccordionDetails>
                <List key={name}>
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
                            onChangeCommitted={(_, v) => {
                                thisRecalculateClustering(run, v);
                            }}
                            valueLabelDisplay="auto"
                            onChange={(e) => {
                                setCurrentClustering(e.target.value);
                            }}
                            value={currentClustering}
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
                            onChangeCommitted={(_, v) => {
                                simplifySet(name, v);
                            }}
                            valueLabelDisplay="auto"
                            onChange={(e) => {
                                setChunkingThreshold(e.target.value);
                            }}
                            value={chunkingThreshold}
                            marks={[
                                { value: 0, label: '0%' },
                                { value: 1, label: '100%' },
                            ]}
                        />
                    </ListItem>
                </List>
            </AccordionDetails>
        </Accordion>
    );
}
