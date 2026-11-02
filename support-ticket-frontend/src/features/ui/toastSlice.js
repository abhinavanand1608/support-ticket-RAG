import { createSlice, nanoid } from '@reduxjs/toolkit';

// Global toast queue, fed by errorToastMiddleware (any failed RTK Query
// call, app-wide) and available for pages to push their own via
// `dispatch(addToast(...))` if they ever need a success toast too.
const toastSlice = createSlice({
  name: 'toasts',
  initialState: [],
  reducers: {
    addToast: {
      reducer(state, action) {
        state.push(action.payload);
      },
      prepare(message, type = 'error') {
        return { payload: { id: nanoid(), message, type } };
      },
    },
    removeToast(state, action) {
      return state.filter((toast) => toast.id !== action.payload);
    },
  },
});

export const { addToast, removeToast } = toastSlice.actions;
export default toastSlice.reducer;
