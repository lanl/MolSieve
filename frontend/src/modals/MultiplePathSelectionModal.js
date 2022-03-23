import React from 'react';
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import Stack from '@mui/material/Stack';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import FormHelperText from '@mui/material/FormHelperText';
import FormControl from '@mui/material/FormControl';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Scatterplot from '../vis/Scatterplot.js';
import SelectionVis from '../vis/SelectionVis';
import { intersection, TabPanel } from '../api/myutils';
import { api_calculate_path_similarity } from '../api/ajax';
import CheckboxTable from '../components/CheckboxTable';
import AjaxVideo from '../components/AjaxVideo';
import AnalysisTab from './AnalysisTab';

import KSTestTab from './KSTestTab';

class MultiplePathSelectionModal extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
 cmn: null, x_attribute: null, y_attribute: null, tabIdx: 0, atomProperties: [], stateProperties: [],
};
    }

    addAtomProperty = (_, clicked) => {
        this.setState({ atomProperties: [...clicked] });
    };

    addStateProperty = (_, clicked) => {
        this.setState({ stateProperties: [...clicked] });
    };

    componentDidMount() {
        const propList = [];
        for (let i = 0; i < this.props.extents.length; i++) {
            propList.push(
                this.props.trajectories[this.props.extents[i].name]
                    .properties,
            );
        }

        const cmn = intersection(propList);

        if (this.state.x_attribute == null && this.state.y_attribute == null) {
            this.setState({
                cmn,
                x_attribute: cmn[0],
                y_attribute: cmn[0],
                extent1: JSON.stringify(this.props.extents[0]),
                extent2: JSON.stringify(this.props.extents[1]),
                rvs: JSON.stringify(this.props.extents[0]),
                cdf: JSON.stringify(this.props.extents[1]),
                similarity: null,
                isLoading: false,
            });
        }
    }

    setX = (e) => {
        this.setState({ x_attribute: e.target.value });
    };

    setY = (e) => {
        this.setState({ y_attribute: e.target.value });
    };

    calculatePathSimilarity = () => {
        this.setState({ isLoading: true });
        if (this.state.stateProperties.length === 0 && this.state.atomProperties.length === 0) {
            alert('Please choose some properties to calculate the path similarity with!');
            this.setState({ isLoading: false });
        } else {
            api_calculate_path_similarity(
                this.state.extent1,
                this.state.extent2,
                this.state.stateProperties,
                this.state.atomProperties,
            ).then((data) => {
                this.setState({ isLoading: false, similarity: data });
            }).catch((error) => {
                alert(error);
                this.setState({ isLoading: false });
            });
        }
    };

    closeFunc = () => {
        this.props.closeFunc();
    };

    render() {
        if (this.props.open && this.state.cmn) {
            const properties = this.state.cmn;
            const options = properties.map((property) => (
              <MenuItem key={property} value={property}>
                {property}
              </MenuItem>
                ));

            const extent_options = this.props.extents.map((extent, i) => (
              <MenuItem key={i} value={JSON.stringify(extent)}>
                {`${extent.name} ${extent.begin.timestep} - ${extent.end.timestep}`}
              </MenuItem>
                ));

            const extentGroups = {};

            for (const extent of this.props.extents) {
                if (Object.keys(extentGroups).includes(extent.name)) {
                    extentGroups[extent.name].push(extent);
                } else {
                    extentGroups[extent.name] = [extent];
                }
            }

            const selectionVisualizations = Object.keys(extentGroups).map((extentGroup, i) => (
              <SelectionVis
                  key={i}
                  data={{
                      run: extentGroup,
                      extents: extentGroups[extentGroup],
                      sequence: this.props.trajectories[extentGroup].sequence,
                      colors: this.props.trajectories[extentGroup].colors,
                  }}
              />
            ));

            const scatterplots = this.props.extents.map((extent, i) => (
              <Grid key={i} item xs={6}>
                <Scatterplot
                  data={{
                        sequence: this.props.trajectories[
                            extent.name
                        ].sequence.slice(
                            extent.begin.timestep,
                            extent.end.timestep + 1,
                        ),
                        x_attribute: this.state.x_attribute,
                        y_attribute: this.state.y_attribute,
                        colors: this.props.trajectories[extent.name].colors,
                        title: `${extent.name} ${extent.begin.timestep} - ${extent.end.timestep}`,
                    }}
                />
              </Grid>
                ));

            let similarityText = null;

            if (!this.state.similarity && !this.state.isLoading) {
                similarityText = (
                  <p />
                );
            } else if (this.state.isLoading) {
                similarityText = <CircularProgress color="grey" />;
            } else {
                const extent1 = JSON.parse(this.state.extent1);
                const extent2 = JSON.parse(this.state.extent2);
                similarityText = (
                  <p>
                    Similarity between
                    {' '}
                    {`${extent1.name} ${extent1.begin.timestep} - ${extent1.end.timestep}`}
                    {' '}
                    and
                    {' '}
                    {`${extent2.name} ${extent2.begin.timestep} - ${extent2.end.timestep}`}
                    {' '}
                    is
                    {' '}
                    {this.state.similarity}
                    {' '}
                  </p>
                );
            }

            // could use more spacing between the videos
            const ajaxVideos = this.props.extents.map((extent, idx) => {
                const start = extent.begin.timestep;
                const end = extent.end.timestep;

                return (
                  <Grid key={idx} item xs={6}>
                    <p>{`${extent.name} ${extent.begin.timestep} - ${extent.end.timestep}`}</p>
                    <AjaxVideo run={extent.name} start={start} end={end} />
                  </Grid>
                );
            });

            const analysisTabs = this.props.extents.map((extent, idx) => <Tab key={idx + 4} label={`Analysis for ${extent.name}: ${extent.begin.timestep} - ${extent.end.timestep}`} />);

            const analysisTabsContent = this.props.extents.map((extent, idx) => (
              <TabPanel value={this.state.tabIdx} key={idx + 4} index={idx + 4}>
                <AnalysisTab
                  run={extent.name}
                  pathStart={extent.begin.timestep}
                  pathEnd={extent.end.timestep}
                  closeFunc={() => {
                                             this.closeFunc(true);
                                         }}
                />
              </TabPanel>
));

            return (
              <Dialog
                onClose={this.closeFunc}
                onBackdropClick={() => this.closeFunc()}
                open={this.props.open}
                fullWidth
                maxWidth="xl"
              >
                  <DialogTitle sx={{height: 150}}>
                  {this.props.title}
                  <Tabs value={this.state.tabIdx} onChange={(_, v) => { this.setState({ tabIdx: v }); }}>
                    <Tab label="Info" disabled={this.state.isLoading} />
                    <Tab label="X-Y Plots" disabled={this.state.isLoading} />
                    <Tab label="Path Similarity" disabled={this.state.isLoading} />
                    <Tab label="Kolmogorov-Smirnov Test" disabled={this.state.isLoading} />
                    {analysisTabs}
                  </Tabs>                    
                    <Stack spacing={3} sx={{height: `${150 * selectionVisualizations.length}`}}>
                        {selectionVisualizations}
                    </Stack>
                </DialogTitle>
                <TabPanel value={this.state.tabIdx} index={0}>
                  <DialogContent>
                    <Grid
                      direction="row"
                      justifyContent="space-evenly"
                      container
                      spacing={2}
                    >
                      {ajaxVideos}
                    </Grid>
                  </DialogContent>
                  <DialogActions>
                    <Button
                      size="small"
                      variant="contained"
                      color="error"
                      onClick={this.closeFunc}
                    >
                      Cancel
                    </Button>
                  </DialogActions>
                </TabPanel>

                <TabPanel value={this.state.tabIdx} index={1}>
                  <DialogContent>
                    <Stack spacing={2} direction="column">
                      <p>Select which attributes to render in the X-Y plots.</p>
                      <Stack
                        spacing={2}
                        direction="row"
                      >
                        <FormControl>
                          <Select
                            name="select_x_attribute"
                            value={this.state.x_attribute}
                            onChange={(e) => {
                                                this.setX(e);
                                            }}
                          >
                            {options}
                          </Select>
                          <FormHelperText>X attribute</FormHelperText>
                        </FormControl>
                        <FormControl>
                          <Select
                            name="select_y_attribute"
                            value={this.state.y_attribute}
                            onChange={(e) => {
                                                this.setY(e);
                                            }}
                          >
                            {options}
                          </Select>
                          <FormHelperText>Y attribute</FormHelperText>
                        </FormControl>
                      </Stack>

                      <Stack
                        spacing={2}
                        direction="column"
                      />
                      <Grid
                        direction="row"
                        justifyContent="space-evenly"
                        container
                        spacing={2}
                      >
                        {scatterplots}
                      </Grid>
                    </Stack>
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={this.closeFunc} disabled={this.state.isLoading}>Close</Button>
                  </DialogActions>
                </TabPanel>
                <TabPanel value={this.state.tabIdx} index={2}>
                  <DialogContent>
                    <Stack
                      spacing={2}
                    >
                      <p>Select which two paths to compare.</p>
                      <Stack
                        spacing={2}
                        direction="row"
                      >
                        <FormControl>
                          <Select
                            value={this.state.extent1}
                            onChange={(e) => {
                                                this.setState({
                                                    extent1: e.target.value,
                                                });
                                            }}
                          >
                            {extent_options}
                          </Select>
                          <FormHelperText>Path 1</FormHelperText>
                        </FormControl>
                        <FormControl>
                          <Select
                            value={this.state.extent2}
                            onChange={(e) => {
                                                this.setState({
                                                    extent2: e.target.value,
                                                });
                                            }}
                          >
                            {extent_options}
                          </Select>
                          <FormHelperText>Path 2</FormHelperText>
                        </FormControl>
                      </Stack>
                      <CheckboxTable header="State properties" items={this.state.cmn} click={this.addStateProperty} />
                      <CheckboxTable header="Atom properties" api_call="/get_atom_properties" click={this.addAtomProperty} />
                      {similarityText}
                    </Stack>
                  </DialogContent>
                  <DialogActions>
                    <Button
                      variant="contained"
                      onClick={this.calculatePathSimilarity}
                      disabled={this.state.isLoading}
                    >
                      Calculate path similarity
                    </Button>
                    <Button onClick={this.closeFunc} disabled={this.state.isLoading}>Close</Button>
                  </DialogActions>
                </TabPanel>
                <TabPanel value={this.state.tabIdx} index={3}>
                  <KSTestTab closeFunc={this.closeFunc} cdf={extent_options} rvs={extent_options} rvsDefault={JSON.stringify(this.props.extents[0])} stateProperties={this.state.cmn} />
                </TabPanel>
                {analysisTabsContent}
              </Dialog>
            );
        }
            return null;
    }
}

export default MultiplePathSelectionModal;
