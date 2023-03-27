import { React, memo } from 'react';
import { useSelector } from 'react-redux';

import { getGlobalScale } from '../api/states';

// HOC that watches global scale for changes
// data - unprocessed values
// calculateValues processes them
function PropertyWrapper({ property, data, calculateValues = (d) => d, children }) {
    const globalScale = useSelector(
        (state) => getGlobalScale(state, property),
        (oldScale, newScale) => oldScale.min === newScale.min && oldScale.max === newScale.max
    );
    const { min, max } = globalScale;
    const values = calculateValues(data, property);

    return <>{children(min, max, values)}</>;
}

export default memo(PropertyWrapper);
