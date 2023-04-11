import { React, createRef, useState, useEffect, memo } from 'react';

import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import '../css/App.css';

import IconButton from '@mui/material/IconButton';
import HighlightAltIcon from '@mui/icons-material/HighlightAlt';
import DeselectIcon from '@mui/icons-material/Deselect';
import * as d3 from 'd3';

/**
 * Allows embedding SVG within SVG as React components.
 *
 * TODO: Decouple selected
 * @param {Function} onChartClick - Function called when chart is clicked.
 * @param {Bool} selected - Is chart selected?
 * @param {String} id - Chart ID
 * @param {Function} brush - Function that brushes over chart.
 * @param {Array<Object>} selections - Selections within chart.
 * @param {Object} controls - JSX objects to render inside chart.
 * @param {String} color - Border color
 */
function EmbeddedChart({
    children,
    height,
    width,
    onChartClick,
    selected,
    id,
    brush,
    selections,
    controls,
    color = 'black',
    margin = {
        top: 3,
        left: 3,
    },
}) {
    const ref = createRef();
    const [selectionMode, setSelectionMode] = useState(false);
    const [borderStyle, setBorderStyle] = useState(2);

    useEffect(() => {
        if (ref.current && brush !== undefined) {
            const svg = d3.select(ref.current);
            if (selectionMode) {
                svg.append('g').classed('brush', true).call(brush);
            } else {
                svg.selectAll('.brush').remove();
            }
        }
    }, [selectionMode]);

    useEffect(() => {
        d3.select(ref.current).selectAll('.chartSelection').remove();

        if (selections) {
            for (const s of selections) {
                const { id: sID, brushValues } = s;
                const { start, end } = brushValues;
                d3.select(ref.current)
                    .append('rect')
                    .attr('x', start)
                    .attr('y', 0)
                    .attr('height', height)
                    .attr('width', end - start)
                    .attr('fill', 'none')
                    .attr('stroke', 'gray')
                    .attr('stroke-width', 1)
                    .classed(sID, true)
                    .classed('chartSelection', true);
            }
        }

        return () => {
            d3.select(ref.current).selectAll('.chartSelection').remove();
        };
    }, [JSON.stringify(selections), width, height]);

    useEffect(() => {
        if (selected) {
            setBorderStyle(4);
        } else {
            setBorderStyle(3);
        }
    }, [selected]);

    const h = height - margin.top;
    const w = width - margin.left;

    // svg is what makes the brush interactions possible
    return (
        <Box
            id={id}
            width={w}
            height={height}
            sx={{ display: 'flex' }}
            className="embeddedChart"
            onClick={onChartClick}
        >
            <Box className="floatingToolBar" width={w}>
                {brush !== undefined ? (
                    <Tooltip title="Select sub-region" arrow>
                        <IconButton
                            color="secondary"
                            size="small"
                            aria-label={selectionMode ? 'Clear Selection' : 'Start Selection'}
                            onClick={() => setSelectionMode(!selectionMode)}
                        >
                            {selectionMode ? <DeselectIcon /> : <HighlightAltIcon />}
                        </IconButton>
                    </Tooltip>
                ) : null}
                {controls}
            </Box>
            <svg ref={ref} width={width} height={height}>
                <foreignObject x={0} y={0} width={w} height={h}>
                    {children(w, h)}
                </foreignObject>
                <rect
                    x={0}
                    y={0}
                    width={w}
                    height={h}
                    fill="none"
                    stroke={color}
                    strokeWidth={borderStyle}
                />
            </svg>
        </Box>
    );
}
export default memo(EmbeddedChart);
