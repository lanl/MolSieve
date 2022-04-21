import {React, useState, useEffect} from 'react';
import './css/ExpandableView.css';

import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';

export default function ExpandableView(props) {    
    const [minHeight, setMinHeight] = useState(props.sx.minHeight);
    console.log(props.sx.minHeight);
    useEffect(() => {
        const newHeightPercent = 5 + props.heightDependency * 10;
        if (newHeightPercent < 50) {
            const strPer = `${newHeightPercent}%`;
            setMinHeight(strPer);
            changeStyle('minHeight', strPer);
        } else {
            changeStyle('overflow', true);
        }
    }, [props.heightDependency]);
    
    
    
    const [containerStyle, setContainerStyle] = useState(props.sx);
    const [expanded, setExpanded] = useState(false);
    const [hidden, setHidden] = useState('flex');
    const changeStyle = (name, value) => {
        const currStyle = containerStyle;
        currStyle[name] = value;
        setContainerStyle(currStyle);
    }
    
    return (
        <Paper sx={containerStyle} className="expandableView">
             <Box className="expandableView_toolbar">
                  <Typography align="center" variant="h6" className="expandableView_items">{props.title}</Typography>
                    {!expanded &&
                     <Button className="expandableView_items" size="small" onClick={() => {
                                 changeStyle('width', '50%');
                                 setExpanded(true);
                             }}>Expand</Button>}
                    {expanded &&
                     <Button className="expandableView_items" size="small" onClick={() => {
                                 changeStyle('width', '25%');
                                 setExpanded(false);
                             }}>Shrink</Button>}
                 {hidden == 'flex' &&
                 <Button className="expandableView_items" size="small" onClick={() => {
                             setHidden('none');
                             changeStyle('minHeight', '0%');
                         }}>Hide</Button>
                 }
                 {hidden == 'none' &&
                 <Button className="expandableView_items" size="small" onClick={() => {
                             setHidden('flex');
                             changeStyle('minHeight', minHeight);
                         }}>Show</Button>}                  
             </Box>
            <Divider />
            <Box sx={{display: hidden}} className="expandableView_items">
                {props.children}
            </Box>         
        </Paper>);
}


//this.setState({expandWidth: '50%'})
