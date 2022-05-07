import {React, useState, useEffect} from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';

export default function ProgressBox({messageProp, progressVal}) {
    
    const [progress, setProgress] = useState(0);
    const [message, setMessage] = useState("");
    
    useEffect(() => {
        setMessage(messageProp);
    }, [messageProp]);
    
    useEffect(() => {
        setProgress(progressVal);
    }, [progressVal]);
    
    return (<Box> {message}
                <LinearProgress variant="determinate" value={progress}/>
            </Box>);
}


