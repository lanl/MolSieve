import { useReducer } from 'react';
import { normalizeDict, getNeighbors, buildDictFromArray } from '../api/myutils';
import { zTest } from '../api/stats';

export default function useRanks(keys, chunkOrder) {
    const [ranks, reduceRanks] = useReducer(
        (state, action) => {
            switch (action.type) {
                case 'updateValues': {
                    const { values, id } = action.payload;

                    const chunkIdx = state.chunkOrder.indexOf(id);
                    const neighbors = getNeighbors(state.chunkOrder, chunkIdx);

                    const zScores = buildDictFromArray(Object.keys(values), []);
                    for (const neighbor of neighbors) {
                        const neighborValues = state.chunkValues[neighbor];

                        for (const prop of Object.keys(values)) {
                            if (neighborValues) {
                                zScores[prop] = [
                                    ...zScores[prop],
                                    Math.abs(zTest(values[prop], neighborValues[prop])),
                                ];
                            } else {
                                zScores[prop] = [...zScores[prop], 0];
                            }
                        }
                    }

                    // for each property, calculate the zScore
                    const newRanks = Object.keys(zScores)
                        .map((prop) => ({
                            [prop]: zScores[prop].reduce((acc, v) => acc + v, 0),
                        }))
                        .reduce((acc, arr) => ({ ...acc, ...arr }), {});

                    const ordered = Object.entries(normalizeDict(newRanks, [0, 1]))
                        .sort((a, b) => a[1] < b[1])
                        .map((d) => d[0]);

                    return {
                        ordered,
                        chunkValues: { ...state.chunkValues, [id]: values },
                        chunkOrder,
                    };
                }
                default:
                    throw new Error();
            }
        },
        { ordered: keys, chunkOrder, chunkValues: {} }
    );

    return { ranks, reduceRanks };
}
