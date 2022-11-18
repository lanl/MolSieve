import { React, useState, useEffect } from 'react';
import Box from '@mui/material/Box';

import Stack from '@mui/material/Stack';
import StateViewer from './StateViewer';
import ChartBox from './ChartBox';
import RadarChart from '../vis/RadarChart';

import '../css/App.css';

import { structuralAnalysisProps } from '../api/constants';
import GlobalStates from '../api/globalStates';
import { oneShotTooltip, abbreviate } from '../api/myutils';

export default function SubSequenceView({
    stateIDs,
    children,
    properties,
    sx,
    disabled,
    onMouseEnter,
    onMouseLeave,
    globalScale,
}) {
    const [data, setData] = useState([]);
    useEffect(() => {
        GlobalStates.ensureSubsetHasProperties(properties, stateIDs).then(() => {
            const states = stateIDs.map((id) => GlobalStates.get(id));
            setData(states);
        });
    }, []);

    return (
        <Box
            sx={{ sx }}
            onMouseEnter={() => onMouseEnter()}
            onMouseLeave={() => onMouseLeave()}
            disabled={disabled}
        >
            {children}
            <Stack direction="row" spacing={2}>
                <StateViewer stateIDs={stateIDs} sx={{ flexGrow: 1 }} />
                <ChartBox sx={{ flexGrow: 1 }}>
                    {(width, height) => (
                        <RadarChart
                            data={data}
                            properties={properties}
                            width={width}
                            height={height}
                            globalScale={globalScale}
                            onElementMouseOver={(node, d) => {
                                oneShotTooltip(
                                    node,
                                    `<b>${abbreviate(d.property)}</b>: ${d.value}`
                                );
                            }}
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
