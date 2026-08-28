import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildSchema, validate } from 'graphql'
import { describe, expect, it } from 'vitest'

import * as themeSchema from './Appearance/Theme/schema'
import wallpaperSchema from './Appearance/Wallpaper/schema'
import dashboardAppearanceSchema from './schema/appearance'
import dashboardSettingsSchema from './schema/settings'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const schemaPath = path.join(__dirname, '../../../..', 'backend/api/schema.graphql')
const schema = buildSchema(fs.readFileSync(schemaPath, 'utf8'))

const documents = {
  updateDashboardBaseInfo: dashboardSettingsSchema.updateDashboardBaseInfo,
  updateDashboardMediaReports: dashboardSettingsSchema.updateDashboardMediaReports,
  updateDashboardThirdPartyAnalytics: dashboardSettingsSchema.updateDashboardThirdPartyAnalytics,
  updateDashboardSeo: dashboardSettingsSchema.updateDashboardSeo,
  updateDashboardEnable: dashboardSettingsSchema.updateDashboardEnable,
  updateDashboardLayout: dashboardAppearanceSchema.updateDashboardLayout,
  updateDashboardSocialLinks: dashboardSettingsSchema.updateDashboardSocialLinks,
  updateDashboardNameAlias: dashboardSettingsSchema.updateDashboardNameAlias,
  updateDashboardDocFaq: dashboardSettingsSchema.updateDashboardDocFaq,
  updateDashboardHeaderLinks: dashboardSettingsSchema.updateDashboardHeaderLinks,
  updateDashboardFooterLinks: dashboardSettingsSchema.updateDashboardFooterLinks,
  updateDashboardFooterOnelineLinks: dashboardSettingsSchema.updateDashboardFooterOnelineLinks,
  updateDashboardWallpaper: wallpaperSchema.updateDashboardWallpaper,
  saveCustomThemePreset: themeSchema.saveCustomThemePreset,
  selectThemePreset: themeSchema.selectThemePreset,
}

describe('dashboard mutation documents', () => {
  it.each(Object.entries(documents))('%s matches the current GraphQL schema', (name, document) => {
    const errors = validate(schema, document)

    expect(errors, `${name}: ${errors.map((err) => err.message).join('\n')}`).toEqual([])
  })
})
