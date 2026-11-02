import { configureStore } from '@reduxjs/toolkit';
import { apiSlice } from './api/apiSlice';
import { errorToastMiddleware } from './api/errorToastMiddleware';
import authReducer from '../features/auth/authSlice';
import toastsReducer from '../features/ui/toastSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    toasts: toastsReducer,
    [apiSlice.reducerPath]: apiSlice.reducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(apiSlice.middleware, errorToastMiddleware),
});
