import {React, useState} from 'react';
import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import ScatterControl from './ScatterControl';

export default function ScatterGrid({trajectory, globalUniqueStates}) {

    const [scatterCount, setScatterCount] = useState(0);

    const scatterplots = [];

    for(let i = 0; i < scatterCount; i++) {
        const new_plot = (<ScatterControl
                              trajectory={trajectory}
                              globalUniqueStates={globalUniqueStates}
                          />);
        scatterplots.push(new_plot);
    }
    
    return (
        <Box sx={{flexGrow : 1}}>
            <Button onClick={() => {
                        const newCount = scatterCount +1;
                        setScatterCount(newCount);
                    }}>Add a new scatterplot</Button>
            <Grid>
                {scatterplots}
            </Grid>
        </Box>
    );
}
