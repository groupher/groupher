import fs from 'node:fs'
import path from 'node:path'

import { buildSchema, validate } from 'graphql'
import { describe, expect, it } from 'vitest'

import * as themeSchema from './Appearance/Theme/schema'
import wallpaperSchema from './Appearance/Wallpaper/schema'
import dashboardSchema from './schema'

const schemaPath = path.join(process.cwd(), 'frontend/main/graphql/schema.graphql')
const schema = buildSchema(fs.readFileSync(schemaPath, 'utf8'))

const documents = {
  updateDashboardBaseInfo: dashboardSchema.updateDashboardBaseInfo,
  updateDashboardMediaReports: dashboardSchema.updateDashboardMediaReports,
  updateDashboardSeo: dashboardSchema.updateDashboardSeo,
  updateDashboardEnable: dashboardSchema.updateDashboardEnable,
  updateDashboardLayout: dashboardSchema.updateDashboardLayout,
  updateDashboardSocialLinks: dashboardSchema.updateDashboardSocialLinks,
  updateDashboardNameAlias: dashboardSchema.updateDashboardNameAlias,
  updateDashboardFaqs: dashboardSchema.updateDashboardFaqs,
  updateDashboardHeaderLinks: dashboardSchema.updateDashboardHeaderLinks,
  updateDashboardFooterLinks: dashboardSchema.updateDashboardFooterLinks,
  updateDashboardFooterOnelineLinks: dashboardSchema.updateDashboardFooterOnelineLinks,
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
