import { React } from 'react';
import { useSelector } from 'react-redux';

import { getGlobalScale } from '../api/states';

// HOC that watches global scale for changes
function PropertyWrapper({ property, children }) {
    const globalScale = useSelector(
        (state) => getGlobalScale(state, property),
        (oldScale, newScale) => oldScale.min === newScale.min && oldScale.max === newScale.max
    );

    const { min, max } = globalScale;

    return <>{children(min, max)}</>;
}

export default PropertyWrapper;
