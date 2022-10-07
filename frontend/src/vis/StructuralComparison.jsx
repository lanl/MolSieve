import { React } from 'react';

import Stack from '@mui/material/Stack';
import Box from '@mui/material/Box';
import AjaxVideo from '../components/AjaxVideo';

export default function StructuralComparison({ chunk1, chunk2 }) {
    return (
        <Stack direction="row">
            <Box sx={{ flex: '0 0 auto' }}>
                <AjaxVideo states={chunk1.states} />
            </Box>
            <Box sx={{ flex: '0 0 auto' }}>
                <AjaxVideo states={chunk2.states} />
            </Box>
        </Stack>
    );
}
