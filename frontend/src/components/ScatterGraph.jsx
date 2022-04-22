import { React, useState, useEffect } from 'react';
import ScatterGrid from './ScatterGrid';
import Container from '@mui/material/Container';

/*function usePrevious(value) {
  const ref = useRef();
  useEffect(() => {
    ref.current = value; //assign the value of ref to the argument
  },[value]); //this code will run when the value of 'value' changes
  return ref.current; //in the end, return the current ref value.
}*/

// scatter graph is the top level grid of grids
export default function ScatterGraph({trajectories, display, globalUniqueStates, setStateHovered, setStateClicked}) {
    
    const [displayProp, setDisplayProp] = useState('block');
    const [grids, setGrids] = useState([]);

    //const prevTrajectories = usePrevious(trajectories);
    
    useEffect(() => {
        if(display === undefined || display === true) {
            setDisplayProp('flex');
        } else {
            setDisplayProp('none');
        }
    }, [display]);

    useEffect(() => {
        /*console.log(trajectories);
        let difference = null;
        if(prevTrajectories !== undefined) {                  
            difference = Object.keys(trajectories).filter(x => !Object.keys(prevTrajectories).includes(x));
        } else {
            difference = Object.keys(trajectories);
        }
        if(difference.length > 1 || prevTrajectories === undefined) {*/
        
        const newGrids = Object.keys(trajectories).map((trajectoryName) => {
            return (<ScatterGrid key={trajectoryName}
                                 trajectory={trajectories[trajectoryName]}
                                 globalUniqueStates={globalUniqueStates}
                                 trajectoryName={trajectoryName}
                                 setStateHovered={setStateHovered}
                                 setStateClicked={setStateClicked}                                      
                    />)});
        setGrids(newGrids);
        //}
    },[trajectories, globalUniqueStates]);
    
    return (<Container maxWidth={false} sx={{display: displayProp, flexDirection: 'column' }}>
                {grids}
            </Container>);
}
