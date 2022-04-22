import { React, useEffect, useState, useRef } from 'react';
import ScatterGrid from './ScatterGrid';
import Container from '@mui/material/Container';

function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value; //assign the value of ref to the argument
  },[value]); //this code will run when the value of 'value' changes
  return ref.current; //in the end, return the current ref value.
}

// scatter graph is the top level grid of grids
export default function ScatterGraph({trajectories, display, globalUniqueStates}) {
    
    const [displayProp, setDisplayProp] = useState('block');
    const [grids, setGrids] = useState([]);

    const prevTrajectories = usePrevious(trajectories);
    
    useEffect(() => {
        if(display === undefined || display === true) {
            setDisplayProp('flex');
        } else {
            setDisplayProp('none');
        }
    }, [display]);

    useEffect(() => {
        let difference = null;
        if(prevTrajectories !== undefined) {                  
            difference = Object.keys(trajectories).filter(x => !Object.keys(prevTrajectories).includes(x));
        } else {
            difference = Object.keys(trajectories);
        }
        const newGrid = (<ScatterGrid key={difference[0]} trajectory={trajectories[difference[0]]} globalUniqueStates={globalUniqueStates} trajectoryName={difference[0]}/>);
        setGrids([...grids, newGrid]);
    }, [Object.keys(trajectories).length]);
        
    return (<Container maxWidth={false} sx={{display: displayProp, flexDirection: 'column' }}>
                {grids}
            </Container>);
}
