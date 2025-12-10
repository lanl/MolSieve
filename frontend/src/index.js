/*
 * © 2025. Triad National Security, LLC. All rights reserved.
 * This program was produced under U.S. Government contract 89233218CNA000001 for Los Alamos National Laboratory (LANL), which is operated by Triad National Security, LLC for the U.S. Department of Energy/National Nuclear Security Administration. All rights in the program are reserved by Triad National Security, LLC, and the U.S. Department of Energy/National Nuclear Security Administration. The Government is granted for itself and others acting on its behalf a nonexclusive, paid-up, irrevocable worldwide license in this material to reproduce, prepare. derivative works, distribute copies to the public, perform publicly and display publicly, and to permit others to do so.
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import './css/index.css';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';

import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { Provider } from 'react-redux';
import { enableMapSet } from 'immer';

import store from './store';
import App from './App';

const theme = createTheme({
    palette: {
        type: 'light',
        primary: {
            main: '#394043',
        },
        secondary: {
            main: '#8C8C8C',
        },
        white: {
            main: '#fff',
        },
    },
});

enableMapSet(); // prevents immer from complaining about maps being stored in state

/* eslint-disable react/jsx-filename-extension */
const container = document.getElementById('root');
const root = createRoot(container);
root.render(
    <ThemeProvider theme={theme}>
        <Provider store={store}>
            <CssBaseline>
                <App />
            </CssBaseline>
        </Provider>
    </ThemeProvider>
);
