import ColorScheme from './colorschemes';
/* wrapper around the dictionary of trajectories
/ that enables the calculation of intra-trajectory values */
class Trajectories {

    // dictionary of name: trajectory
    trajectories = {};

    //dictionary of name: simplified trajectory; these objects are the only things that the visualizations ever see
    simplifiedTrajectories = {};
    
    // map of trajectory commonalities; id to list of names; only includes states in common
    commonalities = new Map();

    // global map of uniqueStates
    uniqueStates = new Map();

    // colors currently available for use
    colors = ColorScheme();

    
}
