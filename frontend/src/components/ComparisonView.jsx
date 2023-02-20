import { React, memo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import RemovableBox from './RemovableBox';
import OverlayViolinPlot from '../vis/OverlayViolinPlot';
import GlobalStates from '../api/globalStates';
import { focusChart, unFocusCharts, abbreviate } from '../api/myutils';

function ComparisonView({
    selection,
    properties,
    globalScale,
    deleteFunc = () => {},
    onMouseEnter = () => {},
    onMouseLeave = () => {},
}) {
    const data = selection.map((chunk) => ({
        color: chunk.color,
        id: chunk.id,
        values: chunk.selected.map((id) => GlobalStates.get(id)),
    }));

    return (
        <RemovableBox
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            deleteFunc={deleteFunc}
            height={475}
            overflow="auto"
        >
            {properties.map((property) => {
                const propertyDistributions = data.map((obj) => ({
                    id: obj.id,
                    values: obj.values.map((state) => state[property]),
                }));
                const colors = data.map((obj) => obj.color);
                const { min, max } = globalScale[property];

                return (
                    <Box key={property} sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" display="block">
                            {abbreviate(property)}
                        </Typography>
                        <OverlayViolinPlot
                            data={propertyDistributions}
                            colors={colors}
                            width={100}
                            height={50}
                            scaleMin={min}
                            scaleMax={max}
                            onMouseEnter={() => {}}
                            onElementMouseEnter={(_, d) => {
                                focusChart(d.id);
                            }}
                            onElementMouseLeave={() => {
                                unFocusCharts();
                            }}
                        />
                    </Box>
                );
            })}
        </RemovableBox>
    );
}

export default memo(ComparisonView);
