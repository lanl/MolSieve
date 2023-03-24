import { React, useState, useEffect, memo, useMemo } from 'react';
import * as d3 from 'd3';
import Stack from '@mui/material/Stack';
// import { useSelector } from 'react-redux';
import LinearProgress from '@mui/material/LinearProgress';
import RemovableBox from './RemovableBox';
import HeatMap from '../vis/HeatMap';

import SingleStateViewer from './SingleStateViewer';
import { apiSelectionDistance } from '../api/ajax';
import { oneShotTooltip } from '../api/myutils';

function SelectionComparisonView({
    selections,
    visScript,
    onStateClick = () => {},
    deleteFunc = () => {},
}) {
    const [selection1, selection2] = selections;

    const getIDs = (selection) => [...new Set(selection.extent.map((d) => d.id))];
    const s1 = useMemo(() => getIDs(selection1));
    const s2 = useMemo(() => getIDs(selection2));

    const [comparisonData, setComparisonData] = useState(null);
    const [activeStates, setActiveStates] = useState([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!comparisonData) {
            setIsLoading(true);
            apiSelectionDistance(s1, s2).then((data) => {
                setIsLoading(false);
                setComparisonData(data);
            });
        }
    }, []);

    useEffect(() => {
        setActiveStates([]);
    }, [JSON.stringify(comparisonData)]);

    // refactor later - this can be attached to selection object
    const selectInSubSequence = (id, stateID) => {
        d3.select(`#scatterplot-${id}`).selectAll(`.y-${stateID}`).classed('clicked', true);
    };

    return (
        <RemovableBox deleteFunc={deleteFunc} alignItems="center">
            {isLoading && <LinearProgress color="primary" variant="indeterminate" />}
            <HeatMap
                width={207}
                height={207}
                xList={s1}
                yList={s2}
                data={comparisonData}
                onElementClick={(node, d) => {
                    d3.selectAll('.clicked').classed('clicked', false);
                    setActiveStates([d.id, d.id2]);
                    d3.select(node.target).classed('clicked', true);
                }}
                onElementMouseOver={(node, d) => {
                    oneShotTooltip(node, `<b>${d.id}</b>, <b>${d.id2}</b>: ${d.value}`);
                    d3.selectAll('.clicked').classed('clicked', false);
                    selectInSubSequence(selection1.id, d.id);
                    selectInSubSequence(selection2.id, d.id2);
                }}
            />
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
