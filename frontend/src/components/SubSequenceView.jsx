import { React, useState, useEffect, memo } from 'react';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import ScienceIcon from '@mui/icons-material/Science';
import DisabledByDefaultIcon from '@mui/icons-material/DisabledByDefault';
import Tooltip from '@mui/material/Tooltip';

import SingleStateViewer from './SingleStateViewer';
import RadarChart from '../vis/RadarChart';
import NEBModal from '../modals/NEBModal';
import NEBWrapper from '../hoc/NEBWrapper';
import Scatterplot from '../vis/Scatterplot';

import '../css/App.css';

import GlobalStates from '../api/globalStates';
import { oneShotTooltip } from '../api/myutils';
import { apiSubsetConnectivityDifference } from '../api/ajax';

function SubSequenceView({
    stateIDs,
    timesteps,
    trajectoryName,
    properties,
    globalScale,
    sx = {},
    disabled = false,
    onMouseEnter = () => {},
    onMouseLeave = () => {},

    deleteFunc = () => {},
}) {
    const [data, setData] = useState([]);
    const [activeState, setActiveState] = useState(stateIDs[0]);
    const [isLoaded, setIsLoaded] = useState(false);
    const [interestingStates, setInterestingStates] = useState([
        stateIDs[0],
        stateIDs[stateIDs.length - 1],
    ]);
    const [openModal, setOpenModal] = useState(false);
    const [nebPlots, setNEBPlots] = useState(null);

    useEffect(() => {
        // find interesting states
        apiSubsetConnectivityDifference(stateIDs).then((d) => {
            // remove duplicates if they are next to each other
            const states = [stateIDs[0], ...d, stateIDs[stateIDs.length - 1]].reduce(
                (acc, val, idx, arr) => {
                    if (idx > 0) {
                        if (acc[acc.length - 1] !== arr[idx]) {
                            return [...acc, val];
                        }
                        return acc;
                    }
                    return [val];
                },
                []
            );
            setIsLoaded(true);
            setInterestingStates(states);
        });
        // update
    }, [JSON.stringify(stateIDs)]);

    const addNEB = (states, start, end, interpolate, maxSteps, fmax, saveResults) => {
        if (!nebPlots) {
            setNEBPlots([{ states, start, end, interpolate, maxSteps, fmax, saveResults }]);
        } else {
            setNEBPlots([
                ...nebPlots,
                { states, start, end, interpolate, maxSteps, fmax, saveResults },
            ]);
        }
    };
    useEffect(() => {
        GlobalStates.ensureSubsetHasProperties(properties, stateIDs).then(() => {
            const states = stateIDs.map((id) => GlobalStates.get(id));
            setData(states);
        });
    }, []);

    useEffect(() => {
        onMouseEnter(activeState);
    }, [activeState]);

    return (
        <>
            <Box
                component={Paper}
                sx={{ sx }}
                onMouseEnter={() => onMouseEnter(activeState)}
                onMouseLeave={() => onMouseLeave()}
                disabled={disabled}
            >
                <Box display="flex" direction="row">
                    <Tooltip title="Remove selection" arrow>
                        <IconButton
                            color="secondary"
                            size="small"
                            onClick={() => {
                                deleteFunc();
                            }}
                        >
                            <DisabledByDefaultIcon />
                        </IconButton>
                    </Tooltip>
                    <Tooltip title="Run NEB" arrow>
                        <IconButton
                            color="secondary"
                            size="small"
                            onClick={() => setOpenModal(!openModal)}
                        >
                            <ScienceIcon />
                        </IconButton>
                    </Tooltip>
                </Box>
                <Divider />
                {!isLoaded && <LinearProgress />}
                <Stack direction="row" spacing={0.5}>
                    {interestingStates.map((stateID) => (
                        <SingleStateViewer
                            stateID={stateID}
                            onHover={() => setActiveState(stateID)}
                        />
                    ))}

                    <RadarChart
                        data={data}
                        properties={properties}
                        width={200}
                        height={200}
                        globalScale={globalScale}
                        onElementMouseOver={(node, d) => {
                            oneShotTooltip(node, `${d.value}`);
                        }}
                        renderSingle={GlobalStates.get(activeState)}
                    />
                </Stack>
                <Divider />
                <Stack
                    direction="row"
                    spacing={0.5}
                    sx={{
                        maxWidth: `${interestingStates.length * 100 + 220}px`,
                        overflow: 'scroll',
                        minHeight: '30px',
                        maxHeight: '30px',
                        backgroundColor: '#F8F9F9',
                    }}
                >
                    <Scatterplot
                        width={interestingStates.length * 100 + 220}
                        height={30}
                        colorFunc={(d) => {
                            const state = GlobalStates.get(d.y);
                            return state.individualColor;
                        }}
                        xAttributeList={timesteps}
                        yAttributeList={stateIDs}
                        onElementMouseOver={(_, d) => {
                            setActiveState(d.y);
                        }}
                    />
                </Stack>
                {nebPlots !== null && (
                    <>
                        <Divider />
                        <Stack direction="row" spacing={0.5}>
                            {nebPlots.map((plot) => {
                                const {
                                    states,
                                    start,
                                    end,
                                    interpolate,
                                    maxSteps,
                                    fmax,
                                    saveResults,
                                } = plot;
                                return (
                                    <NEBWrapper
                                        stateIDs={states}
                                        trajectoryName={trajectoryName}
                                        start={start}
                                        end={end}
                                        interpolate={interpolate}
                                        maxSteps={maxSteps}
                                        fmax={fmax}
                                        saveResults={saveResults}
                                        setActiveState={(id) => setActiveState(id)}
                                    />
                                );
                            })}
                        </Stack>
                    </>
                )}
            </Box>
            <NEBModal
                open={openModal}
                close={() => setOpenModal(!openModal)}
                states={stateIDs.map((d, i) => ({
                    id: d,
                    timestep: timesteps[i],
                }))}
                submit={addNEB}
            />
        </>
    );
}

export default memo(SubSequenceView);
