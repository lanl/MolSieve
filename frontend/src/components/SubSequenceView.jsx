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
    const [activeState, setActiveState] = useState({ id: stateIDs[0], idx: 0 });

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
                <StateViewer
                    stateIDs={stateIDs}
                    activeState={activeState}
                    setActiveState={setActiveState}
                />
                <RadarChart
                    data={data}
                    properties={properties}
                    width={200}
                    height={200}
                    globalScale={globalScale}
                    onElementMouseOver={(node, d) => {
                        oneShotTooltip(node, `<b>${abbreviate(d.property)}</b>: ${d.value}`);
                    }}
                    renderSingle={GlobalStates.get(activeState.id)}
                />
            </Stack>
            <Stack
                direction="row"
                spacing={0.5}
                sx={{ maxWidth: '400px', overflow: 'scroll', minHeight: '40px', maxHeight: '40px' }}
            >
                {[...new Set(stateIDs)].map((id) => {
                    const state = GlobalStates.get(id);
                    const idx = stateIDs.indexOf(id);
                    return (
                        <span
                            className="state"
                            style={{ color: state.individualColor }}
                            onMouseEnter={() => setActiveState({ id, idx })}
                        >
                            {id}
                        </span>
                    );
                })}
            </Stack>
        </Box>
    );
}
//
SubSequenceView.defaultProps = {
    properties: structuralAnalysisProps,
};
