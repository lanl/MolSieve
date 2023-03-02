import React from 'react';
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import { DataGrid } from '@mui/x-data-grid';

import SingleStateViewer from './SingleStateViewer';

export default function StateDetailView({ state, visScript }) {
    return (
        <Paper>
            <SingleStateViewer stateID={state.id} visScript={visScript} />
            <Box height={5} width={225} sx={{ backgroundColor: state.individualColor }} />
            <DataGrid
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
