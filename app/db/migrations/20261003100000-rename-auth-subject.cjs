'use strict'

/**
 * STS Street: identity is no longer provided by Auth0. The column that
 * stored the Auth0 `sub` claim now stores the STS identity subject, which is
 * the `sub` claim of tokens issued by the built-in STS identity service
 * (e.g. `sts|<uuid>` for local accounts, `oidc:google|<sub>` for
 * federated accounts). Existing rows keep their values.
 */
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.renameColumn('Users', 'auth0_id', 'auth_subject')
  },

  down: async (queryInterface) => {
    await queryInterface.renameColumn('Users', 'auth_subject', 'auth0_id')
  },
}
