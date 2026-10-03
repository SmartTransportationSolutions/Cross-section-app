import { applyProductName } from './locale.js'

describe('applyProductName', () => {
  it('replaces the upstream product name in translated strings', () => {
    expect(applyProductName('Welcome to Streetmix.')).toBe(
      'Welcome to STS Street.'
    )
    expect(applyProductName('Get Streetmix+')).toBe('Get STS Street Plus')
    expect(applyProductName('What’s new in Streetmix?')).toBe(
      'What’s new in STS Street?'
    )
  })

  it('leaves message placeholders and URLs alone', () => {
    expect(applyProductName('Made with {streetmixWordmark}')).toBe(
      'Made with {streetmixWordmark}'
    )
    expect(applyProductName('https://streetmix.net/')).toBe(
      'https://streetmix.net/'
    )
  })
})
