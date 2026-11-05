/* THIS FILE WAS GENERATED AUTOMATICALLY BY PAYLOAD. */
/* DO NOT MODIFY IT BECAUSE IT COULD BE REWRITTEN AT ANY TIME. */
import configPromise from '@payload-config'
import { RootPage as PayloadPage, generatePageMetadata as generatePayloadPageMetadata } from '@payloadcms/next/views'
import type { Metadata } from 'next'
import { importMap } from '../importMap'
import { isPayloadRoute } from '@/utilities/isPayloadRoute'

type Args = {
  params: Promise<{
    segments: string[]
  }>
  searchParams: Promise<{
    [key: string]: string | string[]
  }>
}



export const generateMetadata = async (props: Args): Promise<Metadata> => {
  const [params, searchParams, config] = await Promise.all([props.params, props.searchParams, configPromise])

  let segments: string[] = params?.segments

  return isPayloadRoute({ config, params })
    ? generatePayloadPageMetadata({ config: configPromise, ...props })
    : {
      title: "Website Lending Page"
    }
}

export default async function (props: Args) {
  const [params, searchParams, config] = await Promise.all([props.params, props.searchParams, configPromise])

  let segments: string[] = params?.segments


  const isPayload = isPayloadRoute({ config, params, searchParams })

  return isPayload
    ? PayloadPage({ config: configPromise, ...props, importMap })
    : <div>Website Lending Page</div>
}