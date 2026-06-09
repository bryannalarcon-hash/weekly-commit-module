// libs/api/src/store.ts — Redux store factory wiring the commitApi reducer + middleware (U17).
// makeStore() is used by the remote's app shell AND by tests to spin an isolated store; setupListeners
// enables refetchOnFocus/refetchOnReconnect. Typed RootState/AppDispatch are derived from the store.
import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { commitApi } from './commitApi';

/** Build a fresh store with the commitApi slice installed. Each call is independent (test-friendly). */
export function makeStore() {
  const store = configureStore({
    reducer: {
      commitApi: commitApi.reducer,
    },
    middleware: (getDefault) => getDefault().concat(commitApi.middleware),
  });
  setupListeners(store.dispatch);
  return store;
}

export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
