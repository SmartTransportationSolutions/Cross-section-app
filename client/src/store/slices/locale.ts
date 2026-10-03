import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { DEFAULT_LOCALE } from '@streetmix/i18n'
import { brand } from '@sts-street/branding'

import { getAppTranslations, getSegmentTranslations } from '../../util/api.js'

import type { TranslationRecord } from '@streetmix/types'

type LocaleMessages = Record<string, string>

interface LocaleState {
  locale: string
  messages: LocaleMessages
  segmentInfo: LocaleMessages
  isLoading: boolean
  requestedLocale: string | null
}

const initialState: LocaleState = {
  locale: DEFAULT_LOCALE,
  messages: {},
  segmentInfo: {},
  isLoading: false,
  requestedLocale: null,
}

// Flattens a nested object from translation response, e.g.
// { key1: { key2: "string" }} => { "key1.key2": "string" }
// This is because react-intl expects to look up translations this way.
// ES6-ported function from https://gist.github.com/penguinboy/762197
// Ignores arrays and passes them through unchanged.
// Does not address null values, since the responses from the server will not be containing those.
function flattenObject(obj: TranslationRecord): LocaleMessages {
  const toReturn: LocaleMessages = {}
  let flatObject: LocaleMessages
  Object.keys(obj).forEach((i: string) => {
    if (typeof obj[i] === 'object' && !Array.isArray(obj[i])) {
      flatObject = flattenObject(obj[i])
      Object.keys(flatObject).forEach((x: string) => {
        toReturn[i + '.' + x] = flatObject[x]
      })
    } else {
      toReturn[i] = obj[i]
    }
  })
  return toReturn
}

/**
 * Applies the product name to translated strings. Translations are
 * maintained upstream with the upstream product name; substituting at load
 * time keeps all 29 locales in sync with the STS brand without forking the
 * translation files. Placeholders such as `{streetmixWordmark}` are not
 * touched because they are part of the message syntax.
 */
export function applyProductName(message: string): string {
  if (typeof message !== 'string') return message
  return message
    .replace(/Streetmix\+/g, brand.plusName)
    .replace(/(?<![{\w@/.-])Streetmix(?![\w+}])/g, brand.productName)
}

function applyProductNameDeep(obj: TranslationRecord): TranslationRecord {
  const out: TranslationRecord = {}
  for (const key of Object.keys(obj)) {
    const value = obj[key]
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      out[key] = applyProductNameDeep(value as TranslationRecord)
    } else if (typeof value === 'string') {
      out[key] = applyProductName(value)
    } else {
      out[key] = value
    }
  }
  return out
}

export const changeLocale = createAsyncThunk(
  'locale/changeLocale',
  async (locale: string) => {
    const messages = await getAppTranslations(locale)
    const segmentInfo = await getSegmentTranslations(locale)

    return {
      locale,
      translation: {
        messages: applyProductNameDeep(messages.data),
        segmentInfo: segmentInfo.data,
      },
    }
  }
)

const localeSlice = createSlice({
  name: 'locale',
  initialState,

  reducers: {},

  extraReducers: (builder) => {
    builder
      .addCase(changeLocale.pending, (state, action) => {
        state.isLoading = true
        state.requestedLocale = action.meta.arg
      })

      .addCase(changeLocale.fulfilled, (state, action) => {
        const { locale, translation } = action.payload
        const { messages, segmentInfo = {} } = translation

        state.locale = locale
        state.messages = flattenObject(messages)
        state.segmentInfo = flattenObject(segmentInfo)
        state.isLoading = false
        state.requestedLocale = null

        const el = document.querySelector('html')
        if (el) {
          el.lang = locale
        }
      })

      .addCase(changeLocale.rejected, (state) => {
        state.isLoading = false
        state.requestedLocale = null
      })
  },
})

export default localeSlice.reducer
