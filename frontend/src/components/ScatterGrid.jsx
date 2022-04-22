import {React, useState} from 'react';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import ScatterControl from './ScatterControl';

export default function ScatterGrid({trajectory, globalUniqueStates, trajectoryName, setStateHovered, setStateClicked }) {

    // holds all of the scatterplots for one trajectory
    const [scatterplotCount, setScatterplotCount] = useState(0);

    let scatterplots = [];
    
    for(let i = 0; i < scatterplotCount; i++) {
        const sc = (<Box gridColumn="span 1" key={`${trajectoryName}_sc_${i}`} >
                        <ScatterControl
                            trajectory={trajectory}
                            globalUniqueStates={globalUniqueStates}
                            trajectoryName={trajectoryName}
                            setStateHovered={setStateHovered}
                            setStateClicked={setStateClicked}
                            
                        />
                    </Box>);
        scatterplots.push(sc);
    }
    
    return (
        <Box display="flex" gap={2} flexDirection="column">
            <Box display="flex" flexDirection="row" gap={5}>
                <Typography variant="h6">{trajectoryName}</Typography>
                <Button variant="contained" onClick={() => {
                          setScatterplotCount(prevState => prevState + 1);
                        }}>Add a new scatterplot</Button>
            </Box>
            <Box display="grid" sx={{ gridColumnGap:"10px", gridTemplateColumns:'repeat(3, 1fr)'}}>
                {scatterplots}
            </Box>
        </Box>
    );

    //stateHovered={stateHovered}
}
