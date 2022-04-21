import {React, useState} from 'react';

import MenuItem from '@mui/material/MenuItem';
import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import Select from '@mui/material/Select';
import Scatterplot from '../vis/Scatterplot';

export default function ScatterControl({trajectory, globalUniqueStates}) {

    const [xAttribute, setXAttribute] = useState(trajectory.properties[0]);
    const [yAttribute, setYAttribute] = useState(trajectory.properties[0]);

    const vals = [];
    for(const s of trajectory.sequence) {
        vals.push(globalUniqueStates.get(s));
    }
        

    let options = trajectory.properties.map((property) => {
        return (
            <MenuItem key={property} value={property}>
                {property}
            </MenuItem>
        );
    });

    return (
        <Box sx={{display: 'flex', flexDirection: 'column'}}>
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
            <Scatterplot
                data={{
                    sequence: vals,
                    x_attribute: xAttribute,
                    y_attribute: yAttribute,
                    colors: trajectory.colors,
                    trajectory: trajectory
                }}                            
            />
        </Box>
    )

    
    
}
