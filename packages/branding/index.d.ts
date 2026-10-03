export interface BrandUpstream {
  name: string
  url: string
  repositoryUrl: string
  commit: string
  codeLicense: string
  illustrationsLicense: string
  copyright: string
}

export interface Brand {
  productName: string
  productNameShort: string
  plusName: string
  tagline: string
  description: string
  companyName: string
  companyShortName: string
  companyUrl: string
  companyLocation: string
  supportEmail: string
  contactUrl: string
  docsUrl: string
  guidebookUrl: string
  troubleshootingUrl: string
  plusInfoUrl: string
  privacyPolicyUrl: string
  termsOfServiceUrl: string
  sourceUrl: string
  sourceRepositoryUrl: string
  themeColor: string
  tileColor: string
  socialImagePath: string
  socialImageWidth: number
  socialImageHeight: number
  upstream: BrandUpstream
}

export const brand: Brand
export default brand
