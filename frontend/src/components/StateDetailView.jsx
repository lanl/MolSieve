import React from 'react';
import Paper from '@mui/material/Paper';
import Divider from '@mui/material/Divider';

import { DataGrid } from '@mui/x-data-grid';

import SingleStateViewer from './SingleStateViewer';

export default function StateDetailView({ state }) {
    return (
        <Paper>
            <SingleStateViewer stateID={state.id} />
            <Divider />
            <DataGrid
                autoHeight
                density="compact"
                disableColumnSelector
                disableDensitySelector
                hideFooterSelectedRowCount
                disableSelectionOnClick
                pageSize={5}
                columns={[
                    { field: 'property', headerName: 'property' },
                    { field: 'value', headerName: 'value' },
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
