import { React, useState, useEffect, memo } from 'react';
import * as d3 from 'd3';
import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import { useSelector } from 'react-redux';

import LinearProgress from '@mui/material/LinearProgress';
import Divider from '@mui/material/Divider';

import RemovableBox from './RemovableBox';
import Scatterplot from '../vis/Scatterplot';
import SingleStateViewer from './SingleStateViewer';
import { apiSelectionDistance } from '../api/ajax';
import ControlChart from '../vis/ControlChart';

function SelectionComparisonView({
    selections,
    visScript,
    onStateClick = () => {},
    deleteFunc = () => {},
}) {
    const stateData = useSelector((state) => state.states.values);
    const [extents, setExtents] = useState(() => {
        const extentDict = {};
        for (const selection of selections) {
            extentDict[selection.id] = [0, 5];
        }
        return extentDict;
    });

    const calculateComparison = () => {
        // get shortest selection - that is used for the basis
        const length = Math.min(
            ...Object.values(extents).map((extent) => Math.abs(extent[1] - extent[0]))
        );

        // for each selection, get all of the values from start to length, build pairs
        const truncSelections = selections.map((d) => {
            const [start, end] = extents[d.id];
            return d.extent
                .slice(start, end)
                .slice(0, length)
                .map((s) => s.id);
        });

        // build pairs from these arrays, we send this to get compared on the back-end
        const pairedSelections = truncSelections.reduce(
            (acc, val) => {
                for (let i = 0; i < val.length; i++) {
                    acc[i].push(val[i]);
                }
                return acc;
            },
            Array.from(Array(length), () => [])
        );
        return pairedSelections;
    };

    const [comparison, setComparison] = useState(() => calculateComparison());
    const [comparisonData, setComparisonData] = useState([]);
    const [activeStates, setActiveStates] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        setComparison(calculateComparison());
    }, [JSON.stringify(extents)]);

    useEffect(() => {
        setIsLoading(true);
        apiSelectionDistance(comparison).then((data) => {
            setIsLoading(false);
            setComparisonData(data);
        });
    }, [JSON.stringify(comparison)]);

    return (
        <RemovableBox deleteFunc={deleteFunc} height={475} alignItems="center">
            <Stack>
                {selections.map((selection) => {
                    const states = selection.extent.map((d) => stateData.get(d.id));
                    return (
                        <Box
                            onMouseEnter={() =>
                                d3.selectAll(`.${selection.id}`).classed('selected', true)
                            }
                            onMouseLeave={() =>
                                d3.selectAll(`.${selection.id}`).classed('selected', false)
                            }
                        >
                            <Scatterplot
                                width={205}
                                height={50}
                                colorFunc={(d) => {
                                    const state = stateData.get(d.y);
                                    return state.color;
                                }}
                                margin={{ top: 3, bottom: 2, left: 3, right: 3 }}
                                xAttributeList={[...Array(states.length).keys()]}
                                yAttributeList={states.map((d) => d.id)}
                                brush={d3.brushX().on('end', (e) => {
                                    if (e.selection) {
                                        const [gStart, gEnd] = e.selection;
                                        const x = d3
                                            .scaleLinear()
                                            .domain(d3.extent([...Array(states.length).keys()]))
                                            .range([0, 205]);

                                        const start = Math.trunc(x.invert(gStart));
                                        const end = Math.trunc(x.invert(gEnd));

                                        setExtents({ ...extents, [selection.id]: [start, end] });
                                    }
                                })}
                                selected={[
                                    {
                                        active: true,
                                        highlightValue: undefined,
                                        set: extents[selection.id],
                                    },
                                ]}
                            />
                            <Divider />
                        </Box>
                    );
                })}
            </Stack>
            {isLoading && <LinearProgress color="primary" variant="indeterminate" />}
            {comparisonData.length > 0 && (
                <>
                    <ControlChart
                        height={100}
                        width={205}
                        xAttributeList={comparison}
                        yAttributeList={comparisonData}
                        globalScaleMin={Math.min(...comparisonData) - 5}
                        globalScaleMax={Math.max(...comparisonData) + 5}
                        onClick={(x) => {
                            setActiveStates(x);
                        }}
                        margin={{ top: 3, bottom: 2, left: 3, right: 3 }}
                    />
                    <Divider />
                </>
            )}
            <Stack direction="row" gap={1}>
                {activeStates.map((stateID) => (
                    <SingleStateViewer
                        stateID={stateID}
                        visScript={visScript}
                        onClick={(e) => {
                            d3.selectAll('.clicked').classed('clicked', false);
                            onStateClick(stateID);
                            d3.select(e.target).classed('clicked', true);
                        }}
                    />
                ))}
            </Stack>
        </RemovableBox>
    );
}
export default memo(SelectionComparisonView);
