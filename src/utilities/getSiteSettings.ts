import config from '@payload-config'
import { getPayload } from 'payload'

export const getSiteSettings = async () => {
  const payload = await getPayload({ config })
  const siteSettings = await payload.findGlobal({
    slug: 'settings',
    select: {
      icon: true,
    },
  })

  return {
    icon: siteSettings?.icon,
  }
}
