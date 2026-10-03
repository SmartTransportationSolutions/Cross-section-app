import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'

import USER_ROLES from '../../../../app/data/user_roles.json'
import { getGeoIp } from '../../util/api.js'

import type { UserState, UserProfile, UserSignInData } from '../../types'
import type { PayloadAction } from '@reduxjs/toolkit'

const initialState: UserState = {
  signInData: null,
  signedIn: false,
  isSubscriber: false,
  geolocation: {
    attempted: false,
    data: null,
    error: null,
  },
}

export const detectGeolocation = createAsyncThunk(
  'user/detectGeolocation',
  async () => {
    const response = await getGeoIp()
    return response.data
  }
)

const userSlice = createSlice({
  name: 'user',
  initialState,

  reducers: {
    setSignInData(state, action: PayloadAction<UserSignInData>) {
      state.signInData = action.payload
      state.signedIn = true

      if (
        action.payload.details?.roles?.includes(USER_ROLES.SUBSCRIBER_1.value)
      ) {
        state.isSubscriber = true
      }
    },

    clearSignInData(state) {
      state.signInData = null
      state.signedIn = false
      state.isSubscriber = false
    },

    setUserProfile(state, action: PayloadAction<UserProfile>) {
      if (state.signInData) {
        state.signInData.details = action.payload

        // QUICK FIX. A race condition is clobbering subscriber status elsewhere.
        if (action.payload.roles?.includes(USER_ROLES.SUBSCRIBER_1.value)) {
          state.isSubscriber = true
        }
      }
    },

    updateDisplayName(
      state,
      action: PayloadAction<UserProfile['displayName']>
    ) {
      if (state.signInData?.details) {
        state.signInData.details.displayName = action.payload
      }
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(detectGeolocation.pending, (state) => {
        // Reset state when pending
        state.geolocation.attempted = false
        state.geolocation.data = null
        state.geolocation.error = null
      })

      .addCase(detectGeolocation.fulfilled, (state, action) => {
        state.geolocation.attempted = true
        state.geolocation.data = action.payload
        state.geolocation.error = null
      })

      .addCase(detectGeolocation.rejected, (state, action) => {
        state.geolocation.attempted = true
        state.geolocation.data = null
        state.geolocation.error = action.error.message ?? action.error
      })
  },
})

export const {
  setSignInData,
  clearSignInData,
  setUserProfile,
  updateDisplayName,
} = userSlice.actions

export default userSlice.reducer
