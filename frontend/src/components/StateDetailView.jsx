import React from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import { DataGrid } from '@mui/x-data-grid';

import { useSelector } from 'react-redux';
import SingleStateViewer from './SingleStateViewer';
import { getState, getStateColoringMethod } from '../api/states';

export default function StateDetailView({ stateID, visScript }) {
    const state = useSelector((states) => getState(states, stateID));
    const colorState = useSelector((states) => getStateColoringMethod(states));
    return (
        <Paper>
            <SingleStateViewer stateID={state.id} visScript={visScript} />
            <Box height={5} width={190} sx={{ backgroundColor: colorState(stateID) }} />
            <DataGrid
                sx={{ width: '190px' }}
                autoHeight
                density="compact"
                disableColumnSelector
                disableDensitySelector
                hideFooterSelectedRowCount
                disableSelectionOnClick
                pageSize={5}
                columns={[
                    { field: 'property', headerName: 'Property' },
                    { field: 'value', headerName: 'Value' },
                ]}
                rows={state.properties.map(([property, value], idx) => ({
                    id: idx,
                    property,
                    value,
                }))}
            />
        </Paper>
    );
}
