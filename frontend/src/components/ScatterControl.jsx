import {React, useState, useEffect} from 'react';

import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import Select from '@mui/material/Select';
import Scatterplot from '../vis/Scatterplot';
import Divider from '@mui/material/Divider';

export default function ScatterControl({trajectory, globalUniqueStates}) {

    // holds a scatterplot per user-defined number of scatterplots

    const [xAttribute, setXAttribute] = useState(trajectory.properties[0]);
    const [yAttribute, setYAttribute] = useState(trajectory.properties[0]);
    const [xAttributeList, setXAttributeList] = useState(null);
    const [yAttributeList, setYAttributeList] = useState(null);

    const vals = [];
    for(const s of trajectory.simplifiedSequence.sequence) {
        vals.push(globalUniqueStates.get(s.id));
    }


    useEffect(() => {
        if(xAttribute === 'timestep') {
            const timesteps = trajectory.simplifiedSequence.sequence.map((s) => {
                return s.timestep;
            });
        
            setXAttributeList(timesteps);
        } else {
            setXAttributeList(null);
        }
    }, [xAttribute]);

    useEffect(() => {
        if(yAttribute === 'timestep') {
            const timesteps = trajectory.simplifiedSequence.sequence.map((s) => {
                return s.timestep;
            });
        
            setYAttributeList(timesteps);
        } else {
            setYAttributeList(null);
        }
    }, [yAttribute]);

    let options = trajectory.properties.map((property) => {
        return (
            <MenuItem key={property} value={property}>
                {property}
            </MenuItem>
        );
    });

    return (<>
            <Box sx={{display: 'flex', justifyContent: 'space-evenly'}}>
            <FormControl>
                <Select                
                    value={xAttribute}
                    onChange={(e) => {
                        setXAttribute(e.target.value);
                    }}
                >
                    {options}
                    <MenuItem key='timestep' value='timestep'>
                        timestep
                    </MenuItem>
                </Select>
                <FormHelperText>X attribute</FormHelperText>
            </FormControl>
            <FormControl>
                <Select                    
                    value={yAttribute}
                    onChange={(e) => {
                        setYAttribute(e.target.value);
                    }}>
                    {options}
                    <MenuItem key='timestep' value='timestep'>
                        timestep
                    </MenuItem>
                </Select>
                <FormHelperText>Y attribute</FormHelperText>
            </FormControl>
            </Box>
            <Divider />            
                <Scatterplot
                    data={{
                        sequence: vals,
                        x_attribute: xAttribute,
                        y_attribute: yAttribute,
                        colors: trajectory.colors,
                        trajectory: trajectory,
                        x_attributeList: xAttributeList,
                        y_attributeList: yAttributeList
                    }}                            
                />
            </>
           ); 
}

