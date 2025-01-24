'use client'

/*
 *
 * SEO for different pages
 *
 */

import Head from 'next/head'

import METRIC from '~/const/metric'
import { SITE_URL, SITE_SLOGAN, SITE_NAME } from '~/config'

import useSEO from '~/hooks/useSEO'
import useMetric from '~/hooks/useMetric'

export default () => {
  const metric = useMetric()

  const {
    seoEnable,
    ogTitle,
    ogSiteName,
    ogUrl,
    ogDescription,
    // twitter
    twCard,
    twImageHeight,
    twImageWidth,
    twSite,
    twTitle,
    twImage,
    twDescription,
  } = useSEO()

  switch (metric) {
    case METRIC.HOME: {
      const title = 'Groupher | 让你的产品听见用户的声音'
      const description = SITE_SLOGAN

      return (
        <Head>
          <title>{ogTitle}</title>
          {!seoEnable && <meta name="robots" content="noindex" />}
          <meta property="og:title" content={title} />
          <meta name="description" content={description} />
          <meta property="og:description" content={description} />
          <meta property="og:site_name" content={SITE_NAME} />
          <meta property="og:url" content={SITE_URL} />
          <meta property="og:type" content="website" />
          <meta property="twitter:title" content={title} />
          <meta property="twitter:description" content={description} />
          <meta property="twitter:site" content={SITE_NAME} />

          {/* {twImage && <meta property="twitter:image:src" content={twImage} />}
          {twImageWidth && <meta property="twitter:image:width" content={twImageWidth} />}
          {twImageHeight && <meta property="twitter:image:width" content={twImageHeight} />} */}
          {/* <meta property="twitter:card" content={twCard} /> */}
        </Head>
      )
    }

    default:
      return (
        <Head>
          <title>{ogTitle}</title>
          {!seoEnable && <meta name="robots" content="noindex" />}
          <meta property="og:title" content={ogTitle} />
          <meta name="description" content={ogDescription} />
          <meta property="og:description" content={ogDescription} />
          <meta property="og:site_name" content={ogSiteName} />
          <meta property="og:url" content={ogUrl} />
          <meta property="og:type" content="website" />
          {/* <link rel="icon" href="/favicon.ico" /> */}
          {twTitle && <meta property="twitter:title" content={twTitle} />}
          {twDescription && <meta property="twitter:description" content={twDescription} />}
          {twSite && <meta property="twitter:site" content={twSite} />}

          {twImage && <meta property="twitter:image:src" content={twImage} />}
          {twImageWidth && <meta property="twitter:image:width" content={twImageWidth} />}
          {twImageHeight && <meta property="twitter:image:width" content={twImageHeight} />}
          {twCard && <meta property="twitter:card" content={twCard} />}
        </Head>
      )
  }
}
