import { React, useEffect, useState, useRef } from 'react';
import ScatterGrid from './ScatterGrid';
import Box from '@mui/material/Box';

function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value; //assign the value of ref to the argument
  },[value]); //this code will run when the value of 'value' changes
  return ref.current; //in the end, return the current ref value.
}


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
        const newGrids = grids;
        let difference = null;
        if(prevTrajectories !== undefined) {                  
            difference = Object.keys(trajectories).filter(x => !Object.keys(prevTrajectories).includes(x));
        } else {
            difference = Object.keys(trajectories);
        }
        newGrids.push(<ScatterGrid key={difference[0]} trajectory={trajectories[difference[0]]} globalUniqueStates={globalUniqueStates}/>);
        setGrids(newGrids);
    }, [Object.keys(trajectories).length]);
        
    return (<Box sx={{display: displayProp, flexDirection:'column'}}>
                {grids}
            </Box>);
}
