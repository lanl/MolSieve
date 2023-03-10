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
import { wsConnect } from './api/websocketmiddleware';

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

enableMapSet();

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

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
// reportWebVitals();
