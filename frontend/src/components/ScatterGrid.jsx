import {React, useState} from 'react';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ScatterControl from './ScatterControl';

export default function ScatterGrid({trajectory, globalUniqueStates, trajectoryName}) {

    // holds all of the scatterplots for one trajectory
    const [scatterplots, setScatterplots] = useState([]);

    const addScatterplot = () => {
        const new_plot = (<Box gridColumn="span 1">
                              <ScatterControl
                                  trajectory={trajectory}
                                  globalUniqueStates={globalUniqueStates}
                              />
                          </Box>);
        setScatterplots([...scatterplots, new_plot]);
    }
    
    return (
        <Box display="flex" gap={2} flexDirection="column">
            <Box display="flex" flexDirection="row" gap={5}>
                <Typography variant="h6">{trajectoryName}</Typography>
                <Button variant="contained" onClick={() => {
                            addScatterplot()
                        }}>Add a new scatterplot</Button>
            </Box>
            <Box display="grid" sx={{ gridColumnGap:"10px", gridTemplateColumns:'repeat(3, 1fr)'}}>
                {scatterplots}
            </Box>
        </Box>
    );
}
