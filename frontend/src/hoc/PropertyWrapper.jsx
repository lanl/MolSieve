import { React, memo } from 'react';
import { useSelector } from 'react-redux';

import { getGlobalScale } from '../api/states';

/**
 * HOC that watches globalScale object for changes, and processes data when it does.
 * Processed data is then sent to children.
 *
 * @param {String} property - Property to watch.
 * @param {Array<Number>} data - Property values.
 * @param {Function} calculateValues - Function to process property values.
 */
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
