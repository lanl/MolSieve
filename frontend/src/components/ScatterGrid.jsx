import {React, useState} from 'react';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ScatterControl from './ScatterControl';

export default function ScatterGrid({trajectory, globalUniqueStates, trajectoryName}) {

    // holds all of the scatterplots for one trajectory
    const [scatterplots, setScatterplots] = useState([]);

    const addScatterplot = () => {
        const new_plot = (<Box gridColumn="span 3">
                              <ScatterControl
                                  trajectory={trajectory}
                                  globalUniqueStates={globalUniqueStates}
                              /></Box>);
        setScatterplots([...scatterplots, new_plot]);
    }
    
    return (
        <Box sx={{backgroundColor: 'blue'}}>           
                <Typography variant="h6">{trajectoryName}</Typography>
                <Button variant="contained" onClick={() => {
                            addScatterplot()
                        }}>Add a new scatterplot</Button>
            <Box display="grid" gap={2} gridTemplateRows='1fr' gridTemplateColumns='repeat(12, 1fr)' sx={{backgroundColor: 'green'}}>
                {scatterplots}
            </Box>
        </Box>
    );
}
