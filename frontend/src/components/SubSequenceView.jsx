import { React, useState, useEffect, memo, useCallback } from 'react';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import LinearProgress from '@mui/material/LinearProgress';
import ScienceIcon from '@mui/icons-material/Science';
import Tooltip from '@mui/material/Tooltip';

import * as d3 from 'd3';

import RemovableBox from './RemovableBox';
import SingleStateViewer from './SingleStateViewer';
import RadarChart from '../vis/RadarChart';
import NEBModal from '../modals/NEBModal';
import NEBWrapper from '../hoc/NEBWrapper';
import Scatterplot from '../vis/Scatterplot';

import '../css/App.css';

import { oneShotTooltip } from '../api/myutils';
import { apiSubsetConnectivityDifference } from '../api/ajax';

function SubSequenceView({
    stateIDs,
    timesteps,
    trajectoryName,
    properties,
    globalScale,
    visScript,
    sx = {},
    disabled = false,
    onMouseEnter = () => {},
    onMouseLeave = () => {},
    onClick = () => {},
    onElementClick = () => {},
    deleteFunc = () => {},
    className = '',
    id = '',
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

    const colorFunc = useCallback((d) => {
        const state = States.get(d.y);
        return state.individualColor;
    }, []);

    useEffect(() => {
        const controller = new AbortController();
        // find interesting states
        apiSubsetConnectivityDifference(stateIDs, controller).then((d) => {
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
        return () => controller.abort();
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
        States.ensureSubsetHasProperties(properties, stateIDs).then(() => {
            const states = stateIDs.map((stateID) => States.get(stateID));
            setData(states);
        });
    }, []);

    useEffect(() => {
        onElementClick(activeState);
    }, [activeState]);

    return (
        <>
            <RemovableBox
                sx={sx}
                onMouseEnter={onMouseEnter}
                onMouseLeave={onMouseLeave}
                onClick={onClick}
                disabled={disabled}
                deleteFunc={deleteFunc}
                className={className}
                toolbar={
                    <Tooltip title="Run NEB" arrow>
                        <IconButton
                            color="secondary"
                            size="small"
                            onClick={() => setOpenModal(!openModal)}
                        >
                            <ScienceIcon />
                        </IconButton>
                    </Tooltip>
                }
            >
                {!isLoaded && <LinearProgress />}
                <Stack direction="row" spacing={0.5}>
                    {interestingStates.map((stateID) => (
                        <SingleStateViewer
                            stateID={stateID}
                            visScript={visScript}
                            onClick={(e) => {
                                d3.selectAll('.clicked').classed('clicked', false);
                                setActiveState(stateID);
                                // select matching state in scatterplot
                                d3.select(`#scatterplot-${id}`)
                                    .selectAll(`.y-${stateID}`)
                                    .classed('clicked', true);
                                d3.select(e.target).classed('clicked', true);
                            }}
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
                        renderSingle={States.get(activeState)}
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
                        id={`scatterplot-${id}`}
                        width={interestingStates.length * 100 + 220}
                        height={30}
                        colorFunc={colorFunc}
                        xAttributeList={timesteps}
                        yAttributeList={stateIDs}
                        onElementClick={(node, d) => {
                            d3.selectAll('.clicked').classed('clicked', false);
                            setActiveState(d.y);
                            d3.select(node).classed('clicked', true);
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
                                        setActiveState={(stateID) => setActiveState(stateID)}
                                    />
                                );
                            })}
                        </Stack>
                    </>
                )}
            </RemovableBox>
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
