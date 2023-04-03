import { React, memo } from 'react';
import { useSelector } from 'react-redux';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import RemovableBox from './RemovableBox';
import OverlayViolinPlot from '../vis/OverlayViolinPlot';
import { focusChart, unFocusCharts, abbreviate } from '../api/myutils';
import PropertyWrapper from '../hoc/PropertyWrapper';

function ComparisonView({
    selection,
    properties,
    deleteFunc = () => {},
    onMouseEnter = () => {},
    onMouseLeave = () => {},
}) {
    const states = useSelector((state) => state.states.values);

    const data = selection.map((chunk) => ({
        color: chunk.color,
        id: chunk.id,
        values: chunk.selected.map((id) => states[id]),
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

                return (
                    <Box key={property} sx={{ textAlign: 'center' }}>
                        <Typography variant="caption" display="block">
                            {abbreviate(property)}
                        </Typography>
                        <PropertyWrapper property={property}>
                            {(min, max) => (
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
                            )}
                        </PropertyWrapper>
                    </Box>
                );
            })}
        </RemovableBox>
    );
}

export default memo(ComparisonView);
