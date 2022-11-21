import { React, useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import StateViewer from './StateViewer';
import RadarChart from '../vis/RadarChart';

import '../css/App.css';

import { structuralAnalysisProps } from '../api/constants';
import GlobalStates from '../api/globalStates';
import { oneShotTooltip, abbreviate } from '../api/myutils';

export default function SubSequenceView({
    stateIDs,
    deleteFunc,
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
            component={Paper}
            sx={{ sx }}
            onMouseEnter={() => onMouseEnter()}
            onMouseLeave={() => onMouseLeave()}
            disabled={disabled}
        >
            <Button
                color="secondary"
                size="small"
                onClick={() => {
                    deleteFunc();
                }}
            >
                X
            </Button>
            <Divider />
            <Stack direction="row" spacing={0.5}>
                <StateViewer stateIDs={stateIDs} />
                <RadarChart
                    data={data}
                    properties={properties}
                    width={200}
                    height={200}
                    globalScale={globalScale}
                    onElementMouseOver={(node, d) => {
                        oneShotTooltip(node, `<b>${abbreviate(d.property)}</b>: ${d.value}`);
                    }}
                />
            </Stack>
            <Box sx={{ maxWidth: '400px', overflow: 'scroll' }}>{stateIDs.map((id) => id)}</Box>
        </Box>
    );
}
//
SubSequenceView.defaultProps = {
    properties: structuralAnalysisProps,
};
