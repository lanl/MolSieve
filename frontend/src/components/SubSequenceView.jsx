import {
    React,
    useEffect,
    useRef
} from 'react';
import Box from "@mui/material/Box";
import AjaxVideo from "../components/AjaxVideo";
import {isPath} from '../api/myutils';
import Stack from '@mui/material/Stack';
import Button from '@mui/material/Button';
import '../css/vis.css';

export default function SubSequenceView({
    subSequence,
    children,
    openNEBModal,
    openMPSModal,
    addScatterplot,
    setVisibleExtent,
    visibleExtent,
    id
}) {
    
    // sub-sequence can be made up of multiple extents
    const extentVideos = subSequence.map((extent, idx) => {
        return (<Box key={idx} gridColumn="span 1"><AjaxVideo title={`extent ${idx+1}`} states={extent.states.map((state) => state.id)}/></Box>);
    });

    const divRef = useRef(null);
    
    useEffect(() => {
        if(divRef && divRef.current) {
            if(id === visibleExtent) {
                divRef.current.classList.add('selectedExtent');
            } else {
                divRef.current.classList.remove('selectedExtent');
            }
        }
    }, [visibleExtent, divRef]);
    
    // the results from the KSTest to display
    /*const [KSTestResultsArray, setKSTestResultsArray] = useState([]);

    // results from analyses to display
    const [analyses, setAnalyses] = useState([]);

    // results from path similarity test to display
    const [pathSimilarityResults, setPathSimilarityResults] = useState([]);            
    
    const KSTestRender = (KSTestResultsArray !== undefined) ? KSTestResultsArray.map((results, idx) => {
        return (<TableRow key={idx}>
                    <TableCell>{results.rvs}</TableCell>
                    <TableCell>{results.cdf}</TableCell>
                    <TableCell>{results.ksProperty}</TableCell>
                    <TableCell>{results.statistic}</TableCell>
                    <TableCell>{results.pvalue}</TableCell>                                                      
                </TableRow>);
    }) : null;

    
            
            const dataGrids = (Analyses !== undefined) ? Object.keys(Analyses).map((count, idx) => {                                
                const data = Analyses[count];
                const grids = [];

                for (const step of Object.keys(data)) {                    
                    const stepData = data[step];

                    let rows =  [];
                    let columns = [];
                    let rowCount = 0;

                    for(const key of Object.keys(stepData[0])) {
                        columns.push({'field': key, 'headerName': key, 'flex': 1});
                    }
            
                    for(const state of stepData) {
                        let row = Object.assign({}, state);                
                        row['id'] = rowCount;
                        rows.push(row);
                        rowCount++;
                    }
                    
                    if(step === 'info') {
                        return null;
                    }
                    
                    grids.push(<DataGrid key={`${idx}_${step}`} autoHeight rows={rows} columns={columns}/>);
                }
                
                return grids;
            }) : null;
            
            const pathSimilarityRender = (pathSimilarityResults !== undefined) ? pathSimilarityResults.map((results, idx) => {
                return (<TableRow key={idx}>
                            <TableCell>{results.e1}</TableCell>
                            <TableCell>{results.e2}</TableCell>                                                    
                            <TableCell>{results.score}</TableCell>
                        </TableRow>);
                
            }) : null;*/

    
    // vis is set to the top to avoid re-rendering when sequenceExtent changes
    return (<Box
                ref={divRef}
                onClick={() => {
                    setVisibleExtent(id);                    
                }} className= "lightBorder subSequenceView selectedExtent" sx={{minHeight: '50px'}}>
                <Stack direction="row" justifyContent="center">
                    <Button color="secondary" onClick={() => addScatterplot() }>Add scatterplot</Button>
                    <Button color="secondary" onClick={() => openMPSModal() }>Analysis</Button>
                    {subSequence.some(isPath) && <Button color="secondary" onClick={() => openNEBModal() }>NEB</Button>}
                </Stack>
                {children}                
                {extentVideos && (
                    <Box display="grid"
                         sx={{
                             gridColumnGap: "10px",
                             gridTemplateColumns: "repeat(2, 1fr)"
                         }}>
                        {extentVideos}
                    </Box>
                )}                
            </Box>);
}

/*        {KSTestResultsArray && (
                            <>
                            <Divider/>
                            <Accordion disableGutters={true}>                                
                                <AccordionSummary
                                    expandIcon={<ExpandMoreIcon />}
                                >
                                    K-S Test Results
                                </AccordionSummary>
                                <Divider/>
                                <AccordionDetails>
                                    <TableContainer>
                                    <Table size="small">
                                        <TableHead>
                                            <TableCell>RVS</TableCell>
                                            <TableCell>CDF</TableCell>
                                            <TableCell>Property</TableCell>
                                            <TableCell>Statistic</TableCell>
                                            <TableCell>P-Value</TableCell>
                                        </TableHead>
                                        <TableBody>
                                            {KSTestRender}
                                        </TableBody>
                                    </Table>
                                    </TableContainer>
                                </AccordionDetails>
                            </Accordion>
                            </>
                        )}
                        {dataGrids && (
                            <>
                                <Divider/>
                                <Accordion disableGutters={true}>                                
                                    <AccordionSummary
                                        expandIcon={<ExpandMoreIcon />}
                                    >
                                    Analysis Results
                                    </AccordionSummary>
                                    <Divider/>
                                    <AccordionDetails>
                                            {dataGrids}
                                    </AccordionDetails>
                            </Accordion>
                            </>                            
                        )}
                    {pathSimilarityRender &&
                     <>
                         <Divider/>
                         <Accordion disableGutters={true}>                                
                             <AccordionSummary
                                 expandIcon={<ExpandMoreIcon />}
                             >
                                 Path Similarity Results
                             </AccordionSummary>
                             <Divider/>
                             <AccordionDetails>
                                 <TableContainer>
                                     <Table size="small">
                                         <TableHead>
                                            <TableCell>Extent 1</TableCell>
                                            <TableCell>Extent 2</TableCell>
                                            <TableCell>Score</TableCell>
                                        </TableHead>
                                        <TableBody>
                                            {pathSimilarityRender}
                                        </TableBody>
                                    </Table>
                                    </TableContainer>
                                </AccordionDetails>
                            </Accordion>
                            </>}
*/
