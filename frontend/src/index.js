import React from 'react';
import { createRoot } from 'react-dom/client';
import './css/index.css';
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import { SnackbarProvider } from 'notistack';
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
    },
});

enableMapSet(); // prevents immer from complaining about maps being stored in state

/* eslint-disable react/jsx-filename-extension */
const container = document.getElementById('root');
const root = createRoot(container);
root.render(
    <ThemeProvider theme={theme}>
        <SnackbarProvider
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
            }}
        >
            <Provider store={store}>
                <CssBaseline>
                    <App />
                </CssBaseline>
            </Provider>
        </SnackbarProvider>
    </ThemeProvider>
);
