class SimplifiedTrajectory {   
    // the states in the simplified trajectory; objects of {id, timestep}
    states = [];
    
    // the chunks in the simplified trajectory; objects of {id, timestep, last}
    chunks = [];

    // the transitions between chunks and states; objects of {source id, target id}
    transitions = [];

    // given a state ID, get the timestep that corresponds to it in the trajectory
    idToTimestep = [];

    // list of unique state ids within the simplified trajectory
    uniqueStates = [];
}
