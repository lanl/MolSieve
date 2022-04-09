import {React, useState, useEffect} from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';

export default function ProgressBox({name, progressVal}) {
    
    const [progress, setProgress] = useState(0);

    useEffect(() => {
        console.log('setting progress');
        setProgress(progressVal);
    }, [progressVal]);
    
    return (<Box> Loading {name} graph {progress}
                <LinearProgress variant="determinate" value={progress}/>
            </Box>);
}


