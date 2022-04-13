/* eslint-disable */
self.onmessage = (event) => {
    self.importScripts('https://d3js.org/d3.v7.min.js');
    
    const chunks = event.data.chunks;
    const sSequence = event.data.sSequence;        
    const links = event.data.links; 
    const x_count = event.data.x_count;
    const width = event.data.width;

    const x_measureCount = event.data.x_measureCount;

    const traj_gap = width;
    
    // fix chunks to positions
    const center_x = x_count * width + x_count * traj_gap;    
    const cluster_gap = width / x_measureCount;
    const halfX = Math.floor(x_measureCount / 2);
    
    const sim = d3.forceSimulation([...chunks, ...sSequence])
          .force("link", d3.forceLink(links).id(function(d) { return d.id; }))
          .force("x", d3.forceX((d) => {
              if(d.x_measure === halfX) {
                  return center_x;
              } else {
                  if (d.x_measure < halfX) {
                      return center_x - ((halfX - d.x_measure) * cluster_gap);
                  } else {
                      return center_x + ((d.x_measure - halfX) * cluster_gap);
                  }
              }
          }))       
          .force("charge", d3.forceManyBody().theta(0.6))
          .force("collide", d3.forceCollide().iterations(2).radius((d) => {
                  if(d.size !== undefined && d.size !== null) {
                      return d.size;
                  } else {
                      return 5;
                  }                    
          })).stop();
        
        for (var i = 0, n = Math.ceil(Math.log(sim.alphaMin()) / Math.log(1 - sim.alphaDecay())); i < n; ++i) {
            self.postMessage({type: "tick", progress: i / n});
            sim.tick();
        }
        self.postMessage({type: "end", chunks: chunks, sSequence: sSequence, links: links});    
};
