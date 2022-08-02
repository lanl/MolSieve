import React from 'react';
import * as d3 from 'd3';

import Box from '@mui/material/Box';

import '../css/vis.css';

import { useTrajectoryChartRender } from '../hooks/useTrajectoryChartRender';
import { useResize } from '../hooks/useResize';
import { onChunkMouseOver, getLengthList } from '../api/myutils';

/*const margin = {
    top: 35, bottom: 20, left: 25, right: 25,
};*/

export default function CircularSequence({ trajectories }) {

  const { width, height, divRef } = useResize();
  console.log(divRef);

  const ref = useTrajectoryChartRender((svg) => {

    if (height === undefined || width === undefined) {
      return;
    }

    if (!svg.empty()) {
      svg.selectAll('*').remove();
    }

    const chunkGroup = svg.append('g').attr('transform', `translate(${width / 2}, ${height / 2})`);

    const scaleR = d3.scaleRadial()
      .range([height / 3, height / 2]) // from center of chart to top
      .domain([0, Object.keys(trajectories).length]);
    
    let count = 0; 
    
    const sortedTraj = getLengthList(trajectories);
      
    for (const st of sortedTraj) {
      const name = st.name;
      const trajectory = trajectories[name];
      
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
      <svg className="vis lightBorder"
        id="sequence"
        ref={ref}
        viewBox={[0, 0, width, height]}
      />
    </Box>);
        //preserveAspectRatio="none"
}
