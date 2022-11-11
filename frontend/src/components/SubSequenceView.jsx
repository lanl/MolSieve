import { React, useState, useEffect } from 'react';
import Box from '@mui/material/Box';

import Stack from '@mui/material/Stack';
import StateViewer from './StateViewer';
import ChartBox from './ChartBox';
import RadarChart from '../vis/RadarChart';

import '../css/vis.css';

import { structuralAnalysisProps } from '../api/constants';
import GlobalStates from '../api/globalStates';

export default function SubSequenceView({ selection, children, properties, sx }) {
    const [data, setData] = useState([]);

    useEffect(() => {
        GlobalStates.ensureSubsetHasProperties(properties, selection).then(() => {
            const states = selection.map((id) => GlobalStates.get(id));
            setData(states);
        });
    }, [selection]);

    return (
        <Box sx={sx}>
            {children}
            <Stack direction="row" spacing={2}>
                <StateViewer selection={selection} sx={{ flexGrow: 1 }} />
                <ChartBox sx={{ flexGrow: 1 }}>
                    {(width, height) => (
                        <RadarChart
                            data={data}
                            properties={properties}
                            width={width}
                            height={height}
                        />
                    )}
                </ChartBox>
            </Stack>
        </Box>
    );
}

SubSequenceView.defaultProps = {
    properties: structuralAnalysisProps,
};
