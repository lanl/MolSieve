/* eslint-disable */
self.onmessage = (event) => {
    self.importScripts('https://d3js.org/d3.v7.min.js');
    
    const chunks = event.data.chunks;
    const sSequence = event.data.sSequence;
    const links = event.data.links;
        
    const x_count = event.data.x_count;
    const y_count = event.data.y_count;
    const width = event.data.width;
    const height = event.data.height;
    const maxChunkSize = event.data.maxChunkSize;
        
    const traj_gap = width;
    const y_gap = height * 4;

    // fix chunks to positions
    const centerChunk = Math.floor(chunks.length / 2);
    const center_x = x_count * width + x_count * traj_gap;
    const center_y = y_count * y_gap;

        // min(width / chunks.length, maxChunkSize)
    const chunk_gap = Math.max(width / chunks.length, maxChunkSize);

    for(let c = 0; c < chunks.length; c++) {
        if(c == centerChunk) {
            chunks[c].fx = center_x;
        } else {
            if (c < centerChunk) {
                chunks[c].fx = center_x - ((centerChunk - c) * chunk_gap);
            } else {
                chunks[c].fx = center_x + ((c - centerChunk) * chunk_gap);
            }
        }
        chunks[c].fy = center_y;
    }                            

    const sim = d3.forceSimulation([...chunks, ...sSequence])
          .force("link", d3.forceLink(links)
                 .id(function(d) { return d.id; })
                 /*.strength(function(d) {
                   console.log(d.transitionProb);
                   return d.transitionProb * 100;
                   })*/
                )
          .force("center", d3.forceCenter(center_x, center_y))
          .force("charge", d3.forceManyBody().theta(0.6))
          .force("collide", d3.forceCollide().strength(5)).stop();//.radius((d) => {
//                  if(d.size !== undefined && d.size !== null) {
//                      return globalTimeScale(d.size);
//                  } else {
//                      return 5;
//                  }                    
             // })).stop();
        
        for (var i = 0, n = Math.ceil(Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay())); i < n; ++i) {
            self.postMessage({type: "tick", progress: i / n});
            sim.tick();
        }
        self.postMessage({type: "end", chunks: chunks, sSequence: sSequence, links: links});    
};
