import React from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import { DataGrid } from '@mui/x-data-grid';

import { useSelector } from 'react-redux';
import SingleStateViewer from './SingleStateViewer';
import { getState, getStateColoringMethod } from '../api/states';

/**
 * Shows details about a state with a 3D render and table of its properties.
 * TODO: Rename to State Detail Widget
 *
 * @param {Number} stateID - ID of the state to display information about.
 * @param {String} visScript - Visualization script to use to draw 3D render.
 */
export default function StateDetailView({ activeState, visScript }) {
    const state = useSelector((states) => getState(states, activeState.id));
    const colorState = useSelector((states) => getStateColoringMethod(states));
    return (
        <Paper>
            <SingleStateViewer activeState={activeState} visScript={visScript} />
            <Box height={5} width="100%" sx={{ backgroundColor: colorState(activeState) }} />
            <DataGrid
                sx={{ width: '200px' }}
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
