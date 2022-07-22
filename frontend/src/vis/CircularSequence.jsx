import React from 'react';
import * as d3 from 'd3';

import Box from '@mui/material/Box';

import '../css/vis.css';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { useResize } from '../hooks/useResize';
import { onChunkMouseOver } from '../api/myutils';

const margin = {
    top: 35, bottom: 20, left: 25, right: 25,
};


export default function CircularSequence({ trajectories }) {

  const { width, height, divRef } = useResize();

  const ref = useTrajectoryChartRender((svg) => {
    if (height === undefined || width === undefined) {
      return;
    }

    if (!svg.empty()) {
      svg.selectAll('*').remove();
    }

    const chunkGroup = svg.append('g').attr('transform', `translate(${width / 2},${height / 2})`);

    const scaleR = d3.scaleRadial()
      .range([height / 2, height - margin.bottom]) // from center of chart to top
      .domain([0, Object.keys(trajectories).length]);
    let count = 0; 
    
    for (const [name, trajectory] of Object.entries(trajectories)) {
      const { simplifiedSequence, colors, idToCluster } = trajectory;
      let { chunks } = simplifiedSequence;
      const chunkList = Array.from(chunks.values()).filter((d) => d.parentID === undefined);

      const c = chunkGroup.append('g').attr('id', `c_${name}`).attr('name', `${name}`);

      const arcs = d3.pie()
        .value(d => d.size)
        .sort((a, b) => a.timestep - b.timestep)
        .padAngle((0.01))(chunkList);

      c.selectAll('arcs')
        .data(arcs)
        .enter()
        .append('path')
        .attr('d',
          d3.arc()
            .innerRadius(scaleR(count))
            .outerRadius(scaleR(count) - 5)
        ).on('mouseover', function(_, d) {
          onChunkMouseOver(this, d.data, name);
          //setStateHovered({ 'caller': this, 'stateID': d.id, 'name': trajectoryName, 'timestep': d.timestep });
        }).on('mouseout', function() {
          //setStateHovered(null);
        })
        .classed("importantChunk", (d) => d.data.important)
        .classed("unimportantChunk", (d) => !d.data.important)
        .attr('fill', (d) => { return colors[idToCluster[d.data.firstID]] });
      
      count++;
    }
  
  });

  return (
    <Box ref={divRef}>
      <svg className="vis"
        id="sequence"
        ref={ref}
        preserveAspectRatio="none"
        viewBox={[0, 0, width, height]}
      />
    </Box>);
}
