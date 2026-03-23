import { Global } from '~/helper'

export const getAnalyticsTag = () => {
  return {
    __html: `
    var _hmt = _hmt || [];
    (function() {
      var hm = document.createElement("script");
      hm.src = "https://hm.baidu.com/hm.js?${process.env.NEXT_PUBLIC_BAIDU_TRACING_ID}";
      var s = document.getElementsByTagName("script")[0];
      s.parentNode.insertBefore(hm, s);
    })();`,
  }
}

export const handleRouteChange = (url: string): void => {
  try {
    Global._hmt.push(['_trackPageview', url])
    // eslint-disable-next-line no-empty
  } catch (e) {}
}
