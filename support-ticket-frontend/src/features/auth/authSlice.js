import { createSlice } from '@reduxjs/toolkit';
import { parseUserFromToken } from './tokenUtils';

const TOKEN_STORAGE_KEY = 'sts_token';

const tokenFromStorage = localStorage.getItem(TOKEN_STORAGE_KEY);
const userFromStorage = parseUserFromToken(tokenFromStorage);

// If localStorage held an expired/garbage token, don't hydrate state with it.
const initialState = {
  token: userFromStorage ? tokenFromStorage : null,
  user: userFromStorage,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { token } = action.payload;
      state.token = token;
      state.user = parseUserFromToken(token);
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
    },
    logout: (state) => {
      state.token = null;
      state.user = null;
      localStorage.removeItem(TOKEN_STORAGE_KEY);
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;
export default authSlice.reducer;

export const selectCurrentToken = (state) => state.auth.token;
export const selectCurrentUser = (state) => state.auth.user;
