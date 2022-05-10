import * as d3 from 'd3';
import {useState, useEffect, useCallback} from 'react';

export const useExtents = (setExtents, onComplete) => {
    const [iExtents, setInternalExtents] = useState([]);
    const [pushExtent, setPushExtent] = useState(false);
    
    useEffect(() => {
        if (!d3.selectAll('.brush').empty()) {
            d3.selectAll('.brush').remove();
        }
        
        if(pushExtent && iExtents.length > 0) {         
            setExtents([...iExtents]);
            setInternalExtents([]);
        }
        setPushExtent(false);
    }, [pushExtent]);

    const completeSelection = useCallback(() => {        
        setPushExtent(true);
        onComplete();
    }, []);

    return {setInternalExtents, completeSelection};
}
