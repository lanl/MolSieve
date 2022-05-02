import * as d3 from 'd3';
import { useCallback } from 'react';

export const useBrush = (ref, brush) => {
    
    const brushFunc = useCallback(() => {
        if (brush != null) {            
            if (!d3.selectAll('.brush').empty()) {
                d3.selectAll('.brush').remove();
            }
            
            d3.select(ref.current)
                .append('g')
                .attr('class', 'brush')
                .call(brush);
        }
    }, [ref, brush]);

    return brushFunc;
};
