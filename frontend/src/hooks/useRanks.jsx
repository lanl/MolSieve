import { useReducer } from 'react';
import { normalizeDict } from '../api/myutils';

export default function useRanks(keys) {
    const [ranks, reduceRanks] = useReducer(
        (state, action) => {
            switch (action.type) {
                case 'updateValues': {
                    const { values, weight } = action.payload;
                    // console.log('new values, before normalize:', values);
                    const newRanks = normalizeDict(values, [0, 1]);

                    const avgRanks = {};
                    for (const key of keys) {
                        const oldVal = state.values[key];
                        if (state.values[key] || weight === 0) {
                            const newVal = newRanks[key];
                            avgRanks[key] = (oldVal + newVal * weight) / 2;
                        } else {
                            avgRanks[key] = newRanks[key];
                        }
                    }

                    const ordered = Object.entries(avgRanks)
                        .sort((a, b) => a[1] < b[1])
                        .map((d) => d[0]);

                    return { ordered, values: avgRanks };
                }
                default:
                    throw new Error();
            }
        },
        { ordered: keys, values: {} }
    );

    return { ranks, reduceRanks };
}
