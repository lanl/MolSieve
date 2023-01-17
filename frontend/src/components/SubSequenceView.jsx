import { React, useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import SortIcon from '@mui/icons-material/Sort';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';

import SingleStateViewer from './SingleStateViewer';
import RadarChart from '../vis/RadarChart';

import '../css/App.css';

import { structuralAnalysisProps } from '../api/constants';
import GlobalStates from '../api/globalStates';
import { oneShotTooltip, abbreviate, occurrenceDict } from '../api/myutils';
import { apiSubsetConnectivityDifference } from '../api/ajax';

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
    const [anchorEl, setAnchorEl] = useState(null);
    const [interestingStates, setInterestingStates] = useState([
        stateIDs[0],
        stateIDs[stateIDs.length - 1],
    ]);

    useEffect(() => {
        // find interesting states
        apiSubsetConnectivityDifference(stateIDs).then((d) => {
            // remove duplicates if they are next to each other
            const states = [stateIDs[0], ...d, stateIDs[stateIDs.length - 1]].reduce(
                (acc, val, idx, arr) => {
                    if (idx > 0) {
                        if (acc[idx - 1] !== arr[idx]) {
                            return [...acc, val];
                        }
                        return acc;
                    }
                    return [val];
                },
                []
            );
            setInterestingStates(states);
        });
        // update
    }, [JSON.stringify(stateIDs)]);

    /**
     * Returns the stateIDs without any sorting.
     *
     * @returns {Array<Number>} The sorted stateIDs.
     */
    const sortInOrder = () => {
        return [...new Set(stateIDs)];
    };

    /**
     * Sorts state counts by occurrences from greatest to least left to right
     *
     * @returns {Array<Number>} The sorted stateIDs.
     */
    const sortByCount = () => {
        const oc = occurrenceDict(stateIDs);

        return Object.entries(oc)
            .sort((a, b) => a[1] < b[1])
            .map((e) => parseInt(e[0], 10));
    };

    const [stateOrder, setStateOrder] = useState(sortByCount);

    useEffect(() => {
        GlobalStates.ensureSubsetHasProperties(properties, stateIDs).then(() => {
            const states = stateIDs.map((id) => GlobalStates.get(id));
            setData(states);
        });
    }, []);

    useEffect(() => {
        onMouseEnter(activeState.id);
    }, [activeState.id]);

    return (
        <Box
            component={Paper}
            sx={{ sx }}
            onMouseEnter={() => onMouseEnter(activeState.id)}
            onMouseLeave={() => onMouseLeave()}
            disabled={disabled}
        >
            <Box display="flex" direction="row">
                <Button
                    color="secondary"
                    size="small"
                    onClick={() => {
                        deleteFunc();
                    }}
                >
                    X
                </Button>
                <IconButton
                    color="secondary"
                    size="small"
                    onClick={(e) => {
                        setAnchorEl(e.currentTarget);
                    }}
                >
                    <SortIcon />
                </IconButton>
            </Box>
            <Divider />
            <Stack direction="row" spacing={0.5}>
                {interestingStates.map((stateID) => (
                    <SingleStateViewer
                        stateID={stateID}
                        onHover={() => setActiveState({ id: stateID })}
                    />
                ))}
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
            <Divider />
            <Stack
                direction="row"
                spacing={0.5}
                sx={{ maxWidth: '400px', overflow: 'scroll', minHeight: '40px', maxHeight: '40px' }}
            >
                {stateOrder.map((id) => {
                    const state = GlobalStates.get(id);
                    const idx = stateIDs.indexOf(id);
                    return (
                        <span
                            key={id}
                            className="state"
                            style={{ color: state.individualColor }}
                            onMouseEnter={() => setActiveState({ id, idx })}
                        >
                            {id}
                        </span>
                    );
                })}
            </Stack>
            <Menu open={anchorEl !== null} anchorEl={anchorEl} onClose={() => setAnchorEl(null)}>
                <MenuItem onClick={() => setStateOrder(sortInOrder)}>
                    Sort by temporal order
                </MenuItem>
                <MenuItem onClick={() => setStateOrder(sortByCount)}>
                    Sort by occurrence count
                </MenuItem>
            </Menu>
        </Box>
    );
}
//
SubSequenceView.defaultProps = {
    properties: structuralAnalysisProps,
};
