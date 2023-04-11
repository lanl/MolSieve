import { React, memo } from 'react';
import { useSelector } from 'react-redux';

import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

import RemovableBox from './RemovableBox';
import OverlayViolinPlot from '../vis/OverlayViolinPlot';
import { focusChart, unFocusCharts, abbreviate } from '../api/myutils';
import PropertyWrapper from '../hoc/PropertyWrapper';

/**
 * Region comparison widget; creates a small multiple of asymmetrical violin plots comparing the distributions
 * of the two selected regions.
 * TODO: rename to region comparison widget
 *
 * @param {Array<Chunk>} selection - Selection array, contains two Chunks to compare.
 * @param {Array<String>} properties - The properties to draw charts for.
 * @param {Function} deleteFunc - Function to call when the Box is removed.
 * @param {Function} onMouseEnter - Function called when mouse enters the Widget.
 * @param {Function} onMouseLeave - Function called when the mouse leaves the Widget.
 */
function ComparisonView({
    selection,
    properties,
    deleteFunc = () => {},
    onMouseEnter = () => {},
    onMouseLeave = () => {},
}) {
    const states = useSelector((state) => state.states.values);

    // extract necessary data from selected chunks
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
