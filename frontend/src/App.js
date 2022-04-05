import React from 'react';
import './css/App.css';
import Box from '@mui/material/Box';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import AjaxMenu from './components/AjaxMenu';
import LoadRunModal from './modals/LoadRunModal';
import LoadingModal from './modals/LoadingModal';
import Trajectory from './api/trajectory';
import VisGrid from './components/VisGrid';
import MenuIcon from '@mui/icons-material/Menu';
import { api_loadPCCA, api_loadSequence, api_load_metadata } from './api/ajax';

const RUN_MODAL = 'run_modal';

class App extends React.Component {
    constructor() {
      super();
      this.runListButton = React.createRef();
        this.state = {
            isLoading: false,
            currentModal: null,
            showRunList: false,
            drawerOpen: false,
            run: null,
            trajectories: {},
            loadingMessage: 'Loading...',
            colors: ['ff0029', '377eb8', '66a61e', '984ea3', '00d2d5', 'ff7f00', 'af8d00',
                     '7f80cd', 'b3e900', 'c42e60', 'a65628', 'f781bf', '8dd3c7', 'bebada',
                     'fb8072', '80b1d3', 'fdb462', 'fccde5', 'bc80bd', 'ffed6f', 'c4eaff',
                     'cf8c00', '1b9e77', 'd95f02', 'e7298a', 'e6ab02', 'a6761d', '0097ff',
                     '00d067', '000000', '252525', '525252', '737373', '969696', 'bdbdbd',
                     'f43600', '4ba93b', '5779bb', '927acc', '97ee3f', 'bf3947', '9f5b00',
                     'f48758', '8caed6', 'f2b94f', 'eff26e', 'e43872', 'd9b100', '9d7a00',
                     '698cff', 'd9d9d9', '00d27e', 'd06800', '009f82', 'c49200', 'cbe8ff',
                     'fecddf', 'c27eb6', '8cd2ce', 'c4b8d9', 'f883b0', 'a49100', 'f48800',
                     '27d0df', 'a04a9b'],
            globalUniqueStates: new Map(),
        };
    }

    toggleModal = (key) => {
        if (this.state.currentModal) {
            this.setState({
                ...this.state,
                currentModal: null,
            });
            return;
        }

        this.setState({ ...this.state, currentModal: key });
    };

  selectRun = (v) => {
      this.setState({
        run: v,
        currentModal: RUN_MODAL,        
      });
  };

  removeRun = (v) => {
    const trajectories = this.state.trajectories;
    delete this.state.trajectories[v];
    this.setState({trajectories: trajectories});
  }

    /** Wrapper for the backend call in api.js */
    load_PCCA = (run, clusters, optimal, m_min, m_max, trajectory) => {
        this.setState({
            isLoading: true,
            loadingMessage: `Calculating PCCA for ${run}...`,
        });

        if (m_min === undefined) m_min = 0;
        if (m_max === undefined) m_max = 0;

        return api_loadPCCA(run, clusters, optimal, m_min, m_max, trajectory);
    };

    /** Wrapper for the backend call in api.js */
    load_sequence = (run, properties, new_traj) => {
        this.setState({
            isLoading: true,
            loadingMessage: `Loading sequence for ${run}...`,
        });
        return api_loadSequence(run, properties, new_traj);
    };

    load_metadata = (run, new_traj) => {
        this.setState({
            isLoading: true,
            loadingMessage: `Loading metadata for ${run}...`,
        });
        return api_load_metadata(run, new_traj);
    };

    /** Function called by the PCCA slider allocated for each run. Reruns the PCCA for however many clusters the user specifies
     *  @param {string} run - Run to recalculate the clustering for
     *  @param {number} clusters - Number of clusters to split the trajectory into.
     */
    recalculate_clustering = (run, clusters) =>
        // first check if the state has that clustering already calculated
         new Promise((resolve, reject) => {
            const current_traj = this.state.trajectories[run];

            if (current_traj.feasible_clusters.includes(clusters)) {
                const new_trajectories = {
                    ...this.state.trajectories,
                };
                new_trajectories[run].current_clustering = clusters;
                new_trajectories[run].set_cluster_info();
                
                new_trajectories[run].simplifySet(new_trajectories[run].chunkingThreshold);
                this.setState({ trajectories: new_trajectories });
                resolve(true);
            } else {
                // if not, recalculate
                this.load_PCCA(
                    run,
                    clusters,
                    -1,
                    0,
                    0,
                    this.state.trajectories[run],
                )
                    .then((traj) => {
                        const new_trajectories = {
                            ...this.state.trajectories,
                        };
                        traj.add_colors(this.state.colors, clusters);
                        traj.simplifySet(new_trajectories[run].chunkingThreshold);
                        new_trajectories[run] = traj;
                        this.setState({
                            isLoading: false,
                            trajectories: new_trajectories,
                        });
                        resolve(true);
                    })
                    .catch((e) => {
                        this.setState({ isLoading: false });
                        alert(e);
                        reject(false);
                    });
            }
        })
    ;

    /** Creates a new trajectory object and populates it with data from the database
     * @param {string} run - Which run this trajectory object will correspond to
     * @param {number} clusters - Number of clusters to cluster the trajectory into. Ignored if optimal = 1
     * @param {number} optimal - Whether or not PCCA should try and find the optimal clustering between m_min and m_max
     * @param {number} m_min - When running optimal clustering, minimal cluster size to try; ignored if optimal = -1
     * @param {number} m_max - When running optimal clustering, maximum cluster size to try; ignored if optimal = -1
     * @param {Array<String>} properties - Properties of the trajectory to retrieve
     */
    load_trajectory = (run, clusters, optimal, m_min, m_max, properties, chunkingThreshold) => {

        this.load_sequence(run, properties)
            .then((data) => {
                const newTraj = new Trajectory();
                newTraj.sequence = data.sequence;                
                newTraj.uniqueStates = data.uniqueStates.map((state) => {
                    return state.id;
                });                
                
                newTraj.properties = [...properties]; // questionable if we need it
                const newUniqueStates = this.calculateGlobalUniqueStates(data.uniqueStates);
                
                this.load_PCCA(run, clusters, optimal, m_min, m_max, newTraj)
                    .then((newTraj) => {
                        this.load_metadata(run, newTraj).then((newTraj) => {
                            newTraj.set_cluster_info();
                            // could be an option
                            newTraj.chunkingThreshold = chunkingThreshold;                            
                            newTraj.simplifySet(chunkingThreshold);
                            newTraj.buildAdjacencyList();
                            console.log(newTraj);
                            const removed = newTraj.set_colors(this.state.colors);
                            const newTrajectories = {
                                ...this.state.trajectories,
                            };

                            newTrajectories[run] = newTraj;
                            const newColors = [...this.state.colors];
                            newColors.splice(0, removed);

                            this.setState({
                                isLoading: false,
                                trajectories: newTrajectories,
                                colors: newColors,
                                globalUniqueStates: newUniqueStates
                            });
                        });
                    });
            })
            .catch((e) => {
                alert(e);
            });
    };

    calculateGlobalUniqueStates = (newUniqueStates) => {
        const globalUniqueStates = this.state.globalUniqueStates;
        for(const s of newUniqueStates) {
            if(globalUniqueStates.has(s.id)) {
                const previous = globalUniqueStates.get(s.id);
                globalUniqueStates.set(s.id, Object.assign(previous, s));
            }
            else {
                globalUniqueStates.set(s.id, s);
            }
        }    
        return globalUniqueStates;        
    }

    simplifySet = (run, threshold) => {
        const new_trajectories = {
            ...this.state.trajectories,
        };
        const new_traj = new_trajectories[run];

        new_traj.simplifySet(threshold);        
        new_trajectories[run] = new_traj;
        
        this.setState({ trajectories: new_trajectories });
    };

    toggleDrawer = () => {
        this.setState({ drawerOpen: !this.state.drawerOpen});
    }
    
    render() {
        return (
            <Box className="App" sx={{ display: 'flex', flexDirection: 'column', gap: '1%' }}>
                <AppBar position="static">                    
                    <Toolbar>
                        <Typography
                            sx={{ flexGrow: 1}}
                            variant="h6">Trajectory Visualization</Typography>
                        <Button                            
                          color="inherit"
                          ref={this.runListButton}
                            onClick={
                            () => {
                                    this.setState({showRunList: !this.state.showRunList});
                                }
                            }
                        >Manage trajectories</Button>
                        {Object.keys(this.state.trajectories).length > 0 &&
                         <Button                            
                           color="inherit"
                           onClick={() => {
                             this.toggleDrawer();
                           }}>
                             <MenuIcon/>
                         </Button> }
                    </Toolbar>
                </AppBar>
                <AjaxMenu                     
                    anchorEl={this.runListButton.current}
                    api_call="/get_run_list"
                    open={this.state.showRunList}
                    handleClose={() => {this.setState({showRunList: !this.state.showRunList, anchorEl: null})}}
                    click={(e,v) => {
                        this.setState({showRunList: !this.state.showRunList}, 
                                      () => {
                                          if(e.target.checked) {
                                              this.selectRun(v);
                                          } else {
                                              this.removeRun(v);
                                          }
                                      });
                    }}
                />                   
              <VisGrid
                trajectories={this.state.trajectories}
                globalUniqueStates={this.state.globalUniqueStates}
                recalculate_clustering={this.recalculate_clustering}
                simplifySet={this.simplifySet}
                toggleDrawer={this.toggleDrawer}
                drawerOpen={this.state.drawerOpen}
              />
                
            {this.state.currentModal === RUN_MODAL
                 && (
                 <LoadRunModal
                   run={this.state.run}
                   runFunc={this.load_trajectory}
                   isOpen={this.state.currentModal === RUN_MODAL}
                   lastEvent={this.state.lastEvent}
                   closeFunc={() => this.toggleModal(RUN_MODAL)}
                   onRequestClose={() => this.toggleModal(RUN_MODAL)}
                 />
            )}

            {this.state.isLoading && (
              <LoadingModal
                open={this.state.isLoading}
                title={this.state.loadingMessage}
              />
            )}
          </Box>
        );
    }
}
/*                  <h1>Trajectory Visualization</h1>
                  <h2>powered by React.js</h2>
                  <p>
                    Press CTRL to toggle the path selection brush.
                    Press Z to toggle the zoom brush. Double click
                    to reset zoom. Press and hold SHIFT to select
                    multiple paths. Right click to open a context menu.
                  </p>*/

export default App;
