import { isRejectedWithValue } from '@reduxjs/toolkit';
import { addToast } from '../../features/ui/toastSlice';
import { getErrorMessage } from '../../utils/apiError';

// Catches every failed RTK Query call (query or mutation) across the
// whole app and surfaces it as a toast - RTK Query's `isRejectedWithValue`
// matches any endpoint's rejected action regardless of which slice
// injected it, so this is one place that guarantees error visibility
// everywhere, instead of relying on each page remembering to render its
// own `<ErrorText>`. Pages can still ALSO show inline errors next to the
// specific control that failed (most already do) - the two aren't
// mutually exclusive, they serve different purposes (toast = "something
// went wrong, glance up"; inline = "here's specifically what and where").
export const errorToastMiddleware = (storeApi) => (next) => (action) => {
  if (isRejectedWithValue(action)) {
    // 401s are already handled by baseQueryWithReauth (logs the user out
    // and they're redirected to /login) - a toast on top would just be
    // confusing noise during that redirect.
    if (action.payload?.status !== 401) {
      storeApi.dispatch(addToast(getErrorMessage(action.payload)));
    }
  }

  return next(action);
};
