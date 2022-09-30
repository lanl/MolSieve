import { React, useEffect } from 'react';

import Table from '@mui/material/Table';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import TableCell from '@mui/material/TableCell';
import TableBody from '@mui/material/TableBody';

import * as d3 from 'd3';

import { normalizeDict } from '../api/myutils';
import GlobalStates from '../api/globalStates';

// in theory, we should still have some idea for the zTable on the first render
// can't do this if no values are loaded beforehand
// perhaps add button to calculate zScores?
export default function ZTable({ trajectories, propertyList }) {
    useEffect(() => {
        for (const traj of Object.values(trajectories)) {
            traj.calculateFeatureImportance();
        }
    }, [GlobalStates, trajectories]);

    return (
        <Table size="small">
            <TableHead>
                <TableRow>
                    <TableCell>Attribute</TableCell>
                    {Object.keys(trajectories).map((name) => (
                        <TableCell>{`${name}`}</TableCell>
                    ))}
                </TableRow>
            </TableHead>
            <TableBody>
                {propertyList.map((property) => {
                    const zScores = [];
                    for (const trajectory of Object.values(trajectories)) {
                        const { featureImportance, name } = trajectory;
                        if (featureImportance && featureImportance[property]) {
                            const normDict = normalizeDict(featureImportance, [-1, 1]);
                            zScores.push(
                                <TableCell key={`${property}_${name}`}>
                                    <span
                                        style={{
                                            color: d3.interpolateRdBu(normDict[property]),
                                        }}
                                    >
                                        {featureImportance[property].toFixed(2)}
                                    </span>
                                </TableCell>
                            );
                        }
                    }
                    if (zScores.length > 0) {
                        return (
                            <TableRow>
                                <TableCell>{property}</TableCell>
                                {zScores}
                            </TableRow>
                        );
                    }
                })}
            </TableBody>
        </Table>
    );
}
