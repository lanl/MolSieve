import {React, useState} from 'react';
//import * as d3 from "d3";
import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
//import DialogActions from '@mui/material/DialogActions';
//import DialogContent from '@mui/material/DialogContent';
//import Stack from '@mui/material/Stack';
//import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
//import Button from '@mui/material/Button';
//import FormHelperText from '@mui/material/FormHelperText';
//import FormControl from '@mui/material/FormControl';
//import CircularProgress from '@mui/material/CircularProgress';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

import {
    //intersection,
    TabPanel,
    //isPath
       } from '../api/myutils';
//import { api_calculate_path_similarity } from '../api/ajax';
//import CheckboxTable from '../components/CheckboxTable';

import AnalysisTab from './AnalysisTab';
import KSTestTab from './KSTestTab';

export default function MultiplePathSelectionModal({properties, close, extents, addKSTestResult, extentsID}) {

    const [tabIdx, setTabIdx] = useState(0);
    
    // x_attribute: null, y_attribute: null, atomProperties: [], stateProperties: []

    /*addAtomProperty = (_, clicked) => {
        this.setState({ atomProperties: [...clicked] });
    };

    addStateProperty = (_, clicked) => {
        this.setState({ stateProperties: [...clicked] });
    };

    componentDidMount() {

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
    }*/

    /*setX = (e) => {
        this.setState({ x_attribute: e.target.value });
    };

    setY = (e) => {
        this.setState({ y_attribute: e.target.value });
    };*/

    /*calculatePathSimilarity = () => {
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
    };*/

    if (open && extents) {
        const extents_kv = extents.map((extent, i) => (
            {'name': `extent ${i+1}`, 'value': JSON.stringify(extent.states.map((state) => state.id))}
        ));
        
        const extent_options = extents_kv.map((kv, i) => (
            <MenuItem key={i} name={kv.name} value={kv.value}>
                {kv.name}
            </MenuItem>
        ));

        
        /*
        //const extentGroups = d3.group(this.props.extents, (d) => d.name);
        let similarityText = null;
            
        if (!this.state.similarity && !this.state.isLoading) {
            similarityText = <p/>;
        } else if (this.state.isLoading) {
            similarityText = <CircularProgress color="grey" />;
        } else {
            const extent1 = JSON.parse(this.state.extent1);
            const extent2 = JSON.parse(this.state.extent2);
            similarityText = (
                <p>
                    {`Similarity between ${extent1.name} ${extent1.begin} - ${extent1.end} and ${extent2.name} ${extent2.begin} - ${extent2.end} is ${this.state.similarity}`}
                </p>
            );
        }*/

            /*const ajaxVideos = this.props.extents.map((extent, idx) => {
                const start = extent.begin;
                const end = extent.end;

                return (
                  <Grid key={idx} item xs={6}>
                    <p>{`${extent.name} ${extent.begin} - ${extent.end}`}</p>
                    <AjaxVideo run={extent.name} start={start} end={end} />
                  </Grid>
                );
            });*/

        const analysisTabs = extents.map((_, idx) => <Tab key={idx + 1} label={`Analysis for extent ${idx + 1}`} />);
        const analysisTabsContent = extents.map((extent, idx) => (
            <TabPanel value={tabIdx} key={idx + 1} index={idx + 1}>
                <AnalysisTab                    
                    states={extent.states}
                    closeFunc={() => {
                        close();
                    }}
                />
            </TabPanel>
        ));
        return (
            <Dialog
                onClose={close}
                onBackdropClick={() => {close();}}
                open={open}
                maxWidth={false}
              >
                <DialogTitle>
                  Path Selection
                  <Tabs value={tabIdx} onChange={(_, v) => { setTabIdx(v); }}>                    
                      <Tab label="Kolmogorov-Smirnov Test"/>                      
                    {analysisTabs}
                  </Tabs>                    
                </DialogTitle>
                <TabPanel value={tabIdx} index={0}>
                    <KSTestTab closeFunc={close}
                               rvs={extent_options}
                               cdf={extent_options}
                               rvsDefault={extents_kv[0]}
                               extentsID={extentsID}
                               addKSTestResult={addKSTestResult}
                               stateProperties={properties} />
                </TabPanel>
                {analysisTabsContent}
            </Dialog>
        );
    } else {
        return null;
    }
}

//<Tab label="Path Similarity" disabled={this.state.isLoading} />
/*
                <TabPanel value={tabIdx} index={0}>
                    <DialogContent>
                    <Stack spacing={2}>
                      <p>Select which two paths to compare.</p>
                      <Stack spacing={2} direction="row">
                        <FormControl>
                          <Select
                              value={this.state.extent1}
                              onChange={(e) => {
                                  this.setState({
                                      extent1: e.target.value,
                                  });
                              }}>
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
*/
