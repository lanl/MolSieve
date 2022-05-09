import {React, useState} from 'react';

import DialogTitle from '@mui/material/DialogTitle';
import Dialog from '@mui/material/Dialog';
import MenuItem from '@mui/material/MenuItem';

import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';

import {
    //intersection,
    TabPanel,
    //isPath
       } from '../api/myutils';

import AnalysisTab from './AnalysisTab';
import KSTestTab from './KSTestTab';
import PathSimilarityTab from './PathSimilarityTab';

export default function MultiplePathSelectionModal({properties, close, extents, addKSTestResult, addAnalysisResult, extentsID}) {
    const [tabIdx, setTabIdx] = useState(0);
   
    if (open && extents) {
        const extents_kv = extents.map((extent, i) => (
            {'name': `extent ${i+1}`, 'value': JSON.stringify(extent.states.map((state) => state.id))}
        ));
        
        const extent_options = extents_kv.map((kv, i) => (
            <MenuItem key={i} name={kv.name} value={kv.value}>
                {kv.name}
            </MenuItem>
        ));
           
        const analysisTabs = extents.map((_, idx) => <Tab key={idx + 1} label={`Analysis for extent ${idx + 1}`} />);
        const analysisTabsContent = extents.map((extent, idx) => (
            <TabPanel value={tabIdx} key={idx + 1} index={idx + 1}>
                <AnalysisTab                    
                    states={extent.states}
                    extentsID={extentsID}
                    addAnalysisResult={addAnalysisResult}
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
                      {extents.length > 1 && <Tab label="Path Similarity"/>}
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
                {extents.length > 1 &&
                 <TabPanel value={tabIdx} index={analysisTabsContent.length + 1}>
                     <PathSimilarityTab
                         extents={extents_kv}
                         properties={properties}
                         closeFunc={close}
                         extent_options={extent_options}
                     />
                 </TabPanel>}                
            </Dialog>
        );
    } else {
        return null;
    }
}

//

