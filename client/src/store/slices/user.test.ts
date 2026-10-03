import user, {
  setSignInData,
  clearSignInData
} from './user'

describe('user reducer', () => {
  const initialState = {
    signInData: null,
    signedIn: false,
    isSubscriber: false,
    geolocation: {
      attempted: false,
      data: null,
      error: null
    }
  }

  it('should handle setSignInData()', () => {
    expect(
      user(
        initialState,
        setSignInData({
          details: {
            id: 'foo',
            profileImageUrl: 'image.gif',
            flags: {},
            roles: ['USER']
          }
        })
      )
    ).toEqual({
      signInData: {
        details: {
          id: 'foo',
          profileImageUrl: 'image.gif',
          flags: {},
          roles: ['USER']
        }
      },
      signedIn: true,
      isSubscriber: false,
      geolocation: {
        attempted: false,
        data: null,
        error: null
      }
    })
  })

  it('should handle setSignInData() for subscribers', () => {
    expect(
      user(
        initialState,
        setSignInData({
          details: {
            id: 'foo',
            profileImageUrl: 'image.gif',
            flags: {},
            roles: ['USER', 'SUBSCRIBER_1']
          }
        })
      )
    ).toEqual({
      signInData: {
        details: {
          id: 'foo',
          profileImageUrl: 'image.gif',
          flags: {},
          roles: ['USER', 'SUBSCRIBER_1']
        }
      },
      signedIn: true,
      isSubscriber: true,
      geolocation: {
        attempted: false,
        data: null,
        error: null
      }
    })
  })

  it('should handle clearSignInData()', () => {
    expect(
      user(
        {
          signInData: {
            details: {
              id: 'foo',
              profileImageUrl: 'image.gif',
              flags: {},
              roles: ['USER']
            }
          },
          signedIn: true,
          isSubscriber: true,
              geolocation: {
            attempted: true,
            data: null,
            error: null
          }
        },
        clearSignInData({})
      )
    ).toEqual({
      signInData: null,
      signedIn: false,
      isSubscriber: false,
      geolocation: {
        attempted: true,
        data: null,
        error: null
      }
    })
  })



})
